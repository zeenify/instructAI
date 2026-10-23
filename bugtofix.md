# Bug Log — organized for fixing

How this works now (2026-10-23):

- The pre-pilot fix freeze is **lifted**. Fixes are authorized **label by label** — the user says which label to start, and only that label's bugs get fixed.
- **Every fix is developed and verified on the LOCAL dev stack first** — backend `php artisan serve --port=8000`, frontend `npm run dev` (:5173), AI service `python main.py` (:8001). Do NOT test on the prod URLs (instruct-ai-topaz.vercel.app / instructai-backend.onrender.com / instruct-ai-pnqz.onrender.com).
- Caveat we live with: the local backend points at the **same shared Neon database as prod** (there is only one). So even in dev, keep DB churn minimal — create throwaway records, delete them after, never wipe data.
- Deployment to Vercel/Render happens only after a label's fixes pass dev verification and user review.
- Status values: `open` → `fixing` → `fixed (verify)` → `closed`.
- Entry numbers are stable — refer to bugs by number (`fix #7`), not by section position.

Difficulty labels (user-defined):

- **EASY** — mechanical, contained change; the decision is already made and the blast radius is one surface/function.
- **MEDIUM** — needs real thought, touches several surfaces, or needs a non-trivial reproduction setup — but no structural/system change.
- **HARD** — requires decision-making, structural/schema change, or could be destructive / change the system in a big way — regardless of how small the symptom looks. These get individual user review **before** any fix work starts.

## Order of attack (label by label)

| Label | Bugs |
|---|---|
| **EASY** | #4 max-points default 100 · #7 MC exactly 4 options · #2 material status chip · #10 materials out of To-grade · #11-L leftover: wss connect timeout · #14 join-refresh + empty state |
| **MEDIUM** | #1 gen-studio quiz/lesson tab collision · #9 embed referenced code in questions · #8 code formatting in questions · #12 verify Render CACHE_STORE |
| **HARD** | #3 AiQuestionModal UI/UX redesign · #5 quiz lifecycle redesign (no dates — Close/Reopen) · #6 raise the AI 20-question cap · #13 per-case results in the quiz review screen |

---

# EASY

## 4. Classwork file-submission (assignment) — max points should default to 100

- **Status:** FIXED & VERIFIED (5badd31, 2026-10-23) — backend defaults new file-submission activities to `max_points = 100`; explicit values win, other activity types stay null, existing rows untouched. Verified on dev + prod via API (create/override/cleanup). Side effect noted: gradebook denominators include new file activities from creation — consistent with the existing notdue/missing branches. · **Label: EASY**
- **Found during:** deployment testing, 2026-10-20
- **Area:** Classwork → create/edit a file-submission activity → "Max points" field
- **Symptom / ask:** new file-submission activities start with **empty max points** (`max_points = null`), so teachers must type a number every time (or forget and leave it unset). Expected default: **100**.
- **Where it comes from (traced):**
  - Editor field is blank for a new activity: `frontend/src/pages/teacher/ActivityEditor.jsx:1130` — `value={activity.max_points ?? ''}` (disabled lock/past-due logic on 1130–1131).
  - Backend accepts null: `backend/app/Http/Controllers/Teacher/ClassActivityController.php:196` — `'max_points' => $validated['max_points'] ?? null` (validation at :154 is `nullable`). DB column has no default.
  - `CreateActivityModal.jsx` has no points field at all — the blank value only appears in the editor.
- **Fix direction:** default the initial activity payload to `max_points: 100` for submission-type activities (wherever the blank activity object is built in ActivityEditor), and optionally add a backend fallback of 100 when `max_points` is null on create for file submissions. Check downstream grading math first to make sure a stored 100 behaves identically to today's null (ungraded display, gradebook percentage).
- **Test on dev:** create a file-submission activity locally, confirm 100 prefilled/commits, check gradebook display.

## 7. AI-generated multiple-choice questions sometimes have 5 options — should always be exactly 4

- **Status:** FIXED & VERIFIED (3a9a7c6, 2026-10-23) — prompt now demands exactly 4; service trims overshoot to 4 preserving the correct option; Laravel commit hard-requires exactly 4 (under-filled sets dropped, same trim rule). Verified on dev + prod: generated MC batches all carried 4 options; a hand-crafted 5-option draft committed as 4 with the answer preserved. · **Label: EASY**
- **Found during:** deployment testing, 2026-10-20
- **Area:** Classwork → "Generate questions with AI" → generated multiple-choice questions
- **Symptom:** MC questions default correctly, but some come out with **5 answer options** instead of the standard 4.
- **Root cause (traced):** the classwork AI prompt *explicitly allows 3–5*:
  - `instruct-ai-service/services/qa_service.py:65` — "- multiple_choice: 3-5 options, exactly one correct". Post-processing at line ~280 only strips empty options; nothing normalizes the count.
  - Backend commit accepts it too: `ActivityAiController.php` validates `options: nullable|array|max:10` (:324) and only requires `count >= 2` for multiple_choice (~:437).
  - Meanwhile the generation STUDIO path is already strict — `instruct-ai-service/prompts/content_prompts.py` says "Array of exactly 4 strings" (lines 364, 415) and `config/gen_schemas.py:206` enforces `_str_array(4)`. So the two AI paths disagree on MC option count.
- **Fix direction:**
  1. `qa_service.py:65` — change "3-5 options" → "exactly 4 options, exactly one correct".
  2. Belt-and-suspenders: normalize in `qa_service` post-processing (~line 280 — trim to first 4 or regenerate if ≠4) and/or tighten the backend commit check to exactly 4 for multiple_choice.
  3. Keep the studio path as-is (already 4) so both paths agree.
- **Test on dev:** run the local AI service + backend, generate MC questions through the modal, count options.

## 2. Classwork MATERIALS carry a permanent status chip ("Open"/"Ready"/"To do") — meaningless and cluttery

- **Status:** FIXED & VERIFIED (94519fd, 2026-10-23) — materials render no state chip on either side and live in their own Materials group/section; unpublished still shows Draft for the teacher. Verified on dev + prod with the real class-2 materials. · **Label: EASY**
- **Found during:** deployment testing, 2026-10-20
- **Area:** Classwork (teacher ActivityCard) and student classwork cards — any card for `activity_type = material`
- **Symptom:** A material is always "open" — it has no deadline and no room, so its status chip renders a permanent, never-transitioning state. Because it never changes, the chip carries zero information and permanently clutters every material card (and, on the student side, can park materials in the wrong grouping, e.g. "To do" forever even though there's nothing to do).
- **Code findings (already traced, don't fix yet):**
  - No literal "Open" string exists in the web frontend — the permanent chip resolves to:
    - Teacher card: `activityState()` in `frontend/src/components/teacher/ActivityCard.jsx` (published + no deadline → `'ready'` → label **"Ready"**).
    - Student card: `deriveState()` in `frontend/src/utils/activityState.js` (non-quiz branch, no submission, no deadline → `'todo'` → label **"To do"**) rendered by `frontend/src/components/student/StudentActivityCard.jsx` (stateConfig ~line 13, material special-case line 42). Existing oddity there: line 42 maps material `submitted/graded` → `'graded'`.
- **Chosen fix (option 1, cleanest):** materials get NO state chip — status is for things that transition. Shield the chip render on `activity_type === 'material'`; the type row already says "Material". In grouped classwork views, materials live outside the To do/Done groups (own "Materials" grouping or undeclared).
  (Fallback if a tag is wanted: a dedicated neutral `'material'` state with a muted type-informative label — never "ready/open/to do". Both options edit ONE place — `deriveState()` / `activityState()` — so chip and groupings can't disagree.)
- **Confirm at fix time:** which surface showed the exact word "Open" (web code only emits Ready/To do — check the Cognify Android classwork list; it may literally render "Open").
- **Test on dev:** create a material + activity/quiz(s) locally, check teacher cards, student cards, and grouped views.

## 5. MOVED TO HARD — the deadline rethink absorbed this entry

- **Status:** moved 2026-10-23 · **Label: HARD** — see the #5 entry in the HARD section. What began as "hide the misleading deadline field" became the user's proposal to redesign quiz lifecycle entirely (no dates, teacher Close/Reopen), which needs planning and decisions first.

## 10. Materials land in the teacher's To-grade queue when a student opens them

- **Status:** FIXED & VERIFIED (188d3b5, 2026-10-23) — grading queue + class to_grade_count exclude material activities; read-tracking rows untouched (gradebook already filtered). Dev: 2 material items gone, real file submission still surfaced; prod: queue 0, counter 0. · **Label: EASY**
- **Area:** Teacher sidebar → "To grade" (`/dashboard/teacher/grading`) + whatever endpoint feeds its count
- **Symptom:** opening/reading a classwork **material** counts as a submission waiting for grading. Verified live: the To-grade queue showed exactly 2 items and **both were materials** ("Welcome to Grade 12 - Physical Science", "just hi"), each with a Grade button — for items that have no points and no grading (student card even shows "0/0 · Done").
- **Root family:** same as #2 — materials flowing into grading concepts they don't belong to. The queue/count must exclude `activity_type = material` (or material "submissions" must never be created/counted as awaiting grading).
- **Fix direction:** filter the to-grade query/count to gradable types (file/questions/quiz); hide the Grade affordance for materials; audit the gradebook for the same leak while in there.
- **Test on dev:** open a material as the student (dev), confirm the teacher To-grade count/queue doesn't change; sanity-check gradebook.

## 11-L. Leftover from #11 (FIXED): the live terminal websocket has no connect timeout

- **Status:** FIXED & VERIFIED (cb4fe77, 2026-10-23) — 30s connect clock feeds the wake-retry flow (3 attempts) then resets Run; opened-but-silent gets a 2-min hint without killing interactive waits. Verified on dev against a silent TCP server: timer fired, ladder ran to attempt 3, Run re-enabled. Original entry (bcea038 + follow-ups) remains fixed. · **Label: EASY**
- **Area:** `frontend/src/components/student/InteractiveTerminal.jsx` — websocket to `wss://instruct-execute.onrender.com`
- **Symptom:** the interactive terminal can sit at "> Compiling Java program…" forever when the engine's websocket stalls/hangs (observed again 2026-10-23 during playground verification — a second Run press recovered it). Grading is independent of it since the bcea038 fix, so this is cosmetic — but students do see it hang.
- **Fix direction:** connect/run timeout on the wss client (e.g. 30–45s) → surface a friendly "engine is waking up — press Run to try again" line and reset the session state so Run can retry cleanly.
- **Test on dev:** run the playground terminal locally against the deployed engine; if the wss stalls, the retry message must appear instead of an eternal "Compiling…".

---

# MEDIUM

## 1. AI generation studio — clicking a Quiz opens/highlights the wrong item (a Lesson)

- **Status:** FIXED & VERIFIED (7dd5285, 2026-10-23) — selection now uses type-namespaced keys (`lesson-N` / `quiz-N`). Verified on dev AND prod with a seeded resumed run holding lesson id 9001 + quiz id 9001: quiz click highlights only the quiz and renders the quiz editor; lesson click the reverse. · **Label: MEDIUM**
- **Found during:** deployment testing, 2026-10-20
- **Area:** Teacher → class → AI generation studio → "Lessons & quizzes" tab (`courses → content builder`), while generation is still running
- **Symptom:** The tab strip lists every finished item flat (module 1 lesson/quiz titles, then module 2's…). Clicking a **Quiz** tab both highlights the quiz *and* a Lesson, then shows that Lesson's content instead of the quiz.
- **Reproduction:** Run any multi-module generation (multi-lesson + quiz-heavy course). While items are still generating, click a completed quiz tab and look at which panel renders.
- **Observed mapping pattern** (sequential-id-style misalignment — clicking the k-th quiz opens the k-th lesson overall):
  - Module 1: Quiz 1 → opens Lesson 1; Quiz 2 → opens Lesson 2
  - Module 1 continued: Quiz 1 (of the later batch, still rendering) → opens Lesson 3
  - Module 2: Quiz 2 → opens Module 2's Lesson 1
  - So quiz tabs don't own their own id/selection — the clicked quiz's index collides with a lesson's id. Probably a quiz id minted from a lesson-index counter (quiz n gets lesson n's id), which makes `selectedLessonId === lesson.id` true for two tabs at once.
- **Where to look:** `frontend/src/pages/teacher/GenerationConsole.jsx` — content tab strip renders `completedLessonsList` (lessons + quizzes mixed) with a single `selectedLessonId` state (`setSelectedLessonId(lesson.id)` ~line 473, `isSelected` check ~line 468). Suspect the item `id` values passed into `completedLessonsList` when quiz/lesson results stream in (check how ids are assigned where generation results are inserted/applied, and whether quiz results reuse a lesson-index-based id). Also note: panel only checks `selectedLesson.type` to decide lesson vs quiz render, so a shared id explains everything on screen.
- **Extra clue (2026-10-20, later run):** a different generation with **1 quiz per module worked fine**. The broken run had **2 quizzes per module** — so the bug requires (or first shows with) a module containing 2+ quizzes. That points at something keyed *per module* (a map/count/id field keyed by module id) getting overwritten by the 2nd quiz of the same module, rather than a purely global counter.
- **Fix hints:** give quizzes their own id space (or select by a mutable unique id per item), keep one selection state but verify ids are globally unique, and confirm highlight + panel agree after a quiz completes. When fixing, reproduce with a 2-quizzes-per-module run — the 1-quiz-per-module shape will NOT show it.
- **Test on dev:** needs the local AI service + engine awake; run a 2-quiz-per-module generation locally and click through the tab strip while it streams.

## 9. AI questions reference lesson code without ever showing it — students must recall code they can't see

- **Status:** FIXED & VERIFIED (3a9a7c6 + render 83ccb78, 2026-10-23) — prompt rule: a question whose premise depends on a program/snippet MUST embed it (fenced block / inline code). Dev + prod generations: 3-4 of 4 drafts embedded the lesson's actual code in ```java fences. In-text approach — NO schema change, stays MEDIUM. · **Label: MEDIUM**
- **Area:** AI-generated activity/quiz questions that reference code artifacts — e.g. Activity 1 Q1: *"In the VotingCheck program, what happens when the user enters the age 15?"*
- **Symptom (user's words):** the coding-related question asks about a specific program **without showing the program**. A student won't remember that whole code — the question must show it instead of being vague. (Related but distinct from #8: #8 is about formatting code that IS shown; this is about code that is never shown at all.)
- **Verified live:** student graded view of Activity 1 shows Q1–Q10 referencing named artifacts (VotingCheck, GradeClassifier, ticket-price practice) with no snippet displayed anywhere in the question. The lesson material does contain them, so it's grounded — but a student taking the activity has nothing on screen to reason from.
- **Fix direction:** generator prompt rule — any question whose premise is a specific program/example MUST embed that snippet (fenced, multiline → pairs with #8's rendering work), or a dedicated `code_snippet` field on questions rendered above the question body in quiz room, Q&A viewer, drafts review, and results. Decide in-text-fences vs new column **before** starting (the column needs a migration on the shared Neon DB).
- **Test on dev:** generate a coding-reference activity through the local AI service; verify the snippet shows in take-view and review.

## 8. Code inside AI questions renders as one unreadable paragraph — questions need real formatting (line breaks / code blocks)

- **Status:** FIXED & VERIFIED (83ccb78, 2026-10-23) — shared `FormattedText` renders newlines (pre-wrap), ``` fenced blocks as mono panels, `inline code` as chips; wired into quiz room, module quiz + results, activity take view, editors, draft review, grading and live monitor. Verified on dev + prod with a crafted fenced question (fence panel + inline chips), content restored byte-identical after the test. · **Label: MEDIUM** — formatting/UX improvement
- **Found during:** deployment testing, 2026-10-20
- **Area:** quiz questions of any type, worst for multiple-choice "what's the output?" items — the AI embeds a code snippet inline in the question text as one long prose line; no line breaks, no indentation, hard to read for students and teacher.
- **Traced so far (the blocker is 3 layers deep):**
  1. **Prompt** — `instruct-ai-service/services/qa_service.py` only formats *coding-type* questions (boilerplate/reference_solution rules, line 75-80). For non-coding questions that CONTAIN code (MC "what's the output"), there is zero guidance, so the model writes the snippet as inline prose.
  2. **Storage is NOT the problem** — `question_text` is a string (max 2000) and JSON strings carry `\n` fine; the DB would keep real newlines today.
  3. **Renderers collapse what survives** — student quiz room renders `{question.question_text}` as bare text inside an `<h2>` with NO `white-space: pre-wrap` (`frontend/src/pages/student/QuizRoomView.jsx:1801`, plus ~1897/1971/2031 variants), so any newlines would flatten anyway. Options render the same. Teacher QuizBuilder textarea autosizes (QuizBuilder.jsx:166) but the display side needs pre-wrap too; AiQuestionModal draft review likewise.
- **Fix direction:**
  1. Prompt: tell the model that a question containing code must put the snippet on its own lines (real newlines), blank line between prose and code — ideally a tiny convention like ``` fenced blocks inside question_text/options.
  2. Render: `white-space: pre-wrap` on question text + options everywhere (quiz room, results review, QuizBuilder preview, AiQuestionModal drafts), and style fenced/mono segments as code blocks (light-weight: detect ``` fences or render preformatted when the text is mostly code; no full markdown engine needed).
  3. Check the AI Tutor's quiz-question guardrails display path too if it shows quiz text.
- **Test on dev:** craft a multi-line/fenced question locally (or generate one), verify pre-wrap + fenced rendering in quiz take-view, results, builder preview, and draft review.

## 12. AI Tutor bubble briefly showed a "Python error" reply (on a quiz), then the message vanished

- **Status:** RESOLVED (9277031 hardening + prod probe 2026-10-23) — behavioral check on prod: 6/6 chat-prepare→chat-commit cycles succeeded; with a per-worker `array` cache some commits would 404 the turn token, so the deployed cache is shared. No Render config change needed. · **Label: MEDIUM**
- **Found during:** deployment testing, 2026-10-22 — user was on **quiz 15** (restricted mode) chatting with Ate Kai; the reply contained a python-looking error, and later the message was gone entirely (0 matching turns in `ai_chat_logs` — confirmed by DB query across validation-error / Traceback / `{"error"` patterns).
- **Diagnosis (traced end to end):** the stream generator itself is fully guarded (exceptions yield a friendly "(I lost my train of thought…)" line, `_search` returns a JSON note, guard answers are hardcoded strings, and a persisted answer can never vanish silently). The two holes that can produce and then "lose" a machine-error bubble:
  1. **Raw exception text as a 200 response** — the stream endpoint returned `{"error": str(e)}` (HTTP 200) for bad-request / bad-payload parse failures; `str(e)` carries pydantic/httpx internals, and the frontend renders the response body directly in the bubble. A pydantic error string reads exactly like "a python error".
  2. **Commit-turn cache miss → history never receives the turn** — `chat-prepare` stores the turn token via Laravel cache; a Render free-instance restart/recycle between prepare and commit 404s the token, the frontend only console.warns, so the bubble keeps its text until the next history load erases it — matching "the message is gone now".
- **What was shipped (9277031):**
  - Python: stream parse failures now return proper 400 JSONResponses with a generic message (never `str(e)`); the sync fallback dropped `str(e)` from its payload.
  - Frontend sanitizer: before persisting/displaying, error-shaped stream content (`{"error…`, `Traceback (most recent call last):`, `XxxError:` / `XxxException:`) is replaced with "(I hit a technical snag mid-answer — please send that again.)" and THAT is what commits — no current or future upstream leak can be read by a student.
- **Open verification (this label's work):** confirm the Render backend's `CACHE_STORE` is a real store (`file`/`database`, **not** `array`) — with `array`, each php-fpm worker has its own cache and prepare/commit can land on different workers, permanently breaking tutor-commit persistence. If it is `array`, flipping it on the shared Render instance is a prod-config change the user must approve (may invalidate existing cached state) — do NOT toggle without sign-off. If tutor replies ever vanish routinely, check Render logs for 404s from `/student/ai/chat-commit`.
- **Also possible (unproven, benign):** the model itself emitted error-shaped text (Gemini occasionally does when tool-result JSON or code errors are in context) — the frontend sanitizer covers that case too.

---

## 5. Quiz lifecycle redesign — no deadline dates; teacher Close/Reopen instead

- **Status:** open — **DESIGN LOCKED via user interview 2026-10-23; awaiting build go.** · **Label: HARD** (the engineering — per-student cursors in the live room engine — is the big piece; no decisions remain open)
- **History:** originally logged 2026-10-20 as a UX-clarity item ("the optional date means the moment the quiz stops being takeable, and it's silently dropped for teacher-paced"). Two planning rounds with the user (2026-10-23) turned it into a lifecycle redesign with every decision settled.
- **The design (locked 2026-10-23, user interview):**
  1. **No deadline dates on quizzes — both pacing modes, identical lifecycle.** The only mechanic difference between modes: teacher-paced = the teacher advances the questions, everyone answers in sync; student-paced = each student takes it at their own pace.
  2. **Unifying frame:** teacher-paced = student-paced **with a gate** ("your cursor may not pass the teacher's live question").
  3. **A student-paced quiz ends only when the teacher presses Close** (no auto-end). Close/Reopen available on both modes at any time. Rooms keep the 24h auto-close safety net (`syncExpiredRoom`).
  4. **Reopening a teacher-paced room flips it to self-serve** — absentees take it at their own pace without the teacher re-running anything. Live sync returns only via a fresh live run.
  5. **After a Reopen, only students who never submitted may take it.** Submitted scores stay untouched — reopen is not a retake.
  6. **Late joiners during a live teacher-paced run: always allowed, catch-up style** — they get the questions from Q1 on their own screen at their own pace, then snap into live sync when they reach the teacher's current question. Teacher never re-nexts or reverses. (No per-quiz toggle — always on.)
  7. **Close stops new entrants; in-flight students finish.** Anyone mid-attempt (or inside a live room) completes what they started.
  8. **Post-reopen and catch-up attempts carry a "late" flag** in gradebook/To-grade (the analog of today's soft-deadline late marker) — tardiness stays visible.
  9. **Student-side:** a closed quiz stays on the classwork list with a clear **"Closed" state** (results still viewable if they took it) — never hidden.
  10. **Stored dates:** DB census shows 1 quiz exists, zero dates — the `deadline_at` field for quizzes is ignored/removed outright; nothing existing changes behavior. QUIZZES ONLY: file-submission and questions activities keep deadlines (due dates are the right tool there).
- **What already exists (less work than it sounds):** pacing split is live; rooms auto-close 24h after start via `syncExpiredRoom`; the editor already hides the deadline card for teacher-paced (`ActivityEditor.jsx`: `!isQuiz || pacing_mode === 'student'`); only the create modal wrongly shows it (`CreateActivityModal.jsx:88-91`). Backend deadline enforcement for quizzes lives in `Student/ClassActivityController.php` (hard = block entry/submission ~lines 88, 124, 138, 240, 277; soft = allow + flag late ~149).
- **Fix shape (build plan):**
  1. Remove the deadline UI for quizzes in `CreateActivityModal` + `ActivityEditor`; stop reading `deadline_at` in all quiz gating paths.
  2. Quiz lifecycle state: open / closed / reopened (teacher actions on classwork cards + backend state field) — Close = stop new entrants, in-flight finish; Reopen = self-serve for never-submitted students, marks attempts "late".
  3. Teacher-paced room engine: **per-student question cursor clamped to the live pointer** — on-time students follow teacher nexts; late joiners grind Q1→current self-paced then sync. Biggest single piece (WS events change shape).
  4. Teacher cards get Close/Reopen affordances; student cards get the Closed/Reopened states; gradebook/To-grade keep the late flag fed by the new state transitions instead of the date comparison.
- **Test on dev (when built):** matrix — both pacing modes; close with in-flight attempts; reopen → self-serve catch-up, never-submitted gating, retake locked-out; live run with a late joiner catching up; closed-card student view + results visibility; late flag in gradebook/To-grade; the 24h room auto-close interaction; a legacy check that no quiz gating still reads `deadline_at`.

---

# HARD (continued from the planning split — numbering stable)

## 3. "Generate questions with AI" modal in Classwork — solid function, needs a UI/UX pass

- **Status:** FIXED & VERIFIED on dev (3d608d7, 2026-10-23) — layout redesigned, function untouched. Per user direction the mockup step was skipped ("no need to generate mockups… it's just a UI redesign"), since the modal's flow was already approved; only the presentation changed. Verified at 1280×720 and 390×844: whole-course selection, Automatic→Custom mix switch (total preserved), type counters, Generate gating, and a pinned footer; material tree now scrolls inside its own bounded pane (3-module course) with no clipped lesson rows. Throwaway activity deleted afterwards. · **Label: HARD** (workflow per the workspace UI process: mockups first)
- **Found during:** deployment testing, 2026-10-20
- **Area:** Classwork → activity editor → "Generate questions with AI" (`frontend/src/pages/teacher/AiQuestionModal.jsx` + `AiQuestionModal.css`, ~1100 + ~1060 lines)
- **Current shape:** one 2-phase modal carrying a LOT: setup phase packs the lesson tree (per-module selection, per-lesson text threshold), "use curriculum" toggle, focus textarea, file uploads, question-count stepper (1–20), difficulty, **per-type counts array** (mcq/true-false/etc. via `counts`/`ZERO_COUNTS`), coding-question meta + test-case toggle, and an "advanced" collapsible — then generating (progress line) → review drafts → commit with append/replace mode and discard-confirm. Everything works; the ask is a better experience, not a rebuild.
- **Known UX smells to evaluate at fix time:**
  1. **Wall of controls** in setup — no visual grouping/ordering by decision order (source → shape → generate). Consider a guided 3-step flow or clearly banded sections.
  2. **Two competing count systems** — a simple stepper `count` AND a per-type `counts` array; how they interact (`countsActive`) is invisible to the teacher. One obvious "how many questions" control with an optional per-type breakdown.
  3. Source selection UX: tree + curriculum toggle + files are three parallel sources with OR semantics (`canGenerate = lessons || curriculum || files`) — the enabled/why-disabled state of the Generate button should explain which source satisfies it.
  4. Generating phase is a bare status line — could show per-question progress (progress object already tracks done/total).
  5. Review phase: drafts review + append/replace choice + discard confirm — check hierarchy so "what will replace what" is unmissable when replace is selected (parity with the generation-studio review modal).
- **What shipped (3d608d7):** two bounded panes — left "Class material" (tree + curriculum + reference files, tree height-capped with its own scroll) and a right "Question settings" rail (How many, Difficulty, Custom prompt, Question mix, coding test-case option). The Advanced accordion is gone; Question mix is an Automatic/Custom segmented switch that expands in place, so opening a setting never appends a block at the bottom. Reference files moved out of settings and next to the tree (they are a source and can satisfy the Generate gate alone). Modal widened to 1040px and made flex-bounded (`overflow: hidden`) with a pinned footer; below 820px the panes stack and the setup scrolls. Fixes UX smells 1, 2, 3 and 5 from the list; the generating phase still shows the live preview.
- **Process at fix time (mandatory for this label):** UI work → mockups first (AutoClaw, 3 variants, `design/`) → user picks one → implement → `teacher-eye` critique + `npx impeccable detect src/` limited to this modal's files → user sign-off. **Waived by the user on 2026-10-23** for this entry: keep the existing flow, just fix the layout — no mockups, no rebuild.
- **Test on dev:** full modal flow against the local AI service (setup → generate → review → commit, append AND replace paths on a throwaway class).

## 6. AI quiz generation caps at 20 questions — raise the cap (up to 100)? Decision needed

- **Status:** open — **decision item, not a bug** · **Label: HARD** (pure decision; option B would be a structural change to generation)
- **Found during:** deployment testing, 2026-10-20
- **Area:** Classwork → "Generate questions with AI" (`frontend/src/pages/teacher/AiQuestionModal.jsx` stepper clamps 1–20; per-type counts capped the same) + backend gate `backend/app/Http/Controllers/Teacher/ActivityAiController.php:206-207` — counts summing > 20 get a 422 "Question counts add up to more than 20."
- **The ask:** should teachers be able to generate more — up to 100?
- **Why the cap exists (real constraints, not arbitrary):**
  1. **Generation time** — questions are produced one-by-one through the Python service (Gemini, plus engine-verified test cases for coding questions). 100 questions ≈ a very long single request while the teacher waits in the modal; timeout and Gemini rate-limit risk grow with every item.
  2. **Dev-box single worker** — artisan serve is one worker; a huge run blocks every other request for its whole duration (accepted for AI streams today, worse at 100).
  3. **Review UX** — the modal's review/commit phase isn't designed to skim 100 drafts; the commit is all-at-once.
  4. **Failure cost** — an interrupted 100-question run loses work; the generation STUDIO has pause-resume/continue-missing, this modal does not.
- **Options to weigh (user decides):**
  - **A. Raise the number only** (e.g. 50–100): trivial code change (one clamp + validation), but a 100-question wait-in-modal run will feel broken even when it works.
  - **B. Raise the cap AND make long runs batched/resumable** (per-question progress already exists; add continue-where-it-left-off like the studio): the real fix, more work — structural.
  - **C. Keep 20, lean on append mode**: teachers accumulate larger banks by generating in batches — zero new risk, no code.
  - **D. Reframe:** if the actual need is a big question *bank* (not one quiz of 100), that's a different feature (bank + auto-pick N) — clarify what the 100 is for before building.
- **Recommendation at time of logging:** B if 100 is a real classroom need, C until then.

## 13. Quiz results screen for coding questions — misleading "Expected Answer", and no per-case breakdown (hidden-case failures are unexplainable)

- **Status:** open (observed live 2026-10-22 during pre-pilot testing, quiz 15 Q222) · **Label: HARD** (needs a persistence decision on the shared DB + a design decision about revealing hidden cases)
- **Area:** module-quiz results/review screen for `type = coding` questions (QuizDisplay results view); grading itself is correct
- **Symptom:** after submit, the question shows a single **"Expected Answer: Positive"** — taken from the question-level `expected_output` (case 1's expected) — while actual grading ran **3 per-case tests (2 of them hidden)** and shows only a count chip: "2/3 test cases passed · 0 pts · every test must pass for full points". A student who failed the hidden `input 0 → "Not Positive"` case printed `Positive` and the screen literally says "Expected Answer: Positive" — the feedback contradicts the verdict and gives no way to understand the missing third.
- **DB facts (quiz 15 Q222):** cases `5 → Positive (visible)`, `-3 → Not Positive (hidden)`, `0 → Not Positive (hidden)`. Pre-submit, students see only non-hidden cases (`QuizController@show` filters `hidden=false`, so the Run strip showed 1/1). Post-submit chorus shows the full count but with zero detail.
- **Why HARD:** the honest fix wants **per-case results persisted on the submission/attempt** (schema change + migration on the shared Neon DB — destructive-class by user definition), plus a design decision: do failed HIDDEN cases reveal their input after submission? (Classic judges reveal after submission; teachers may not want that.) Re-running code at review time instead of persisting would dodge the schema but adds an engine dependency + cost + non-determinism — also a decision.
- **Fix direction (once the user picks an approach):** render a per-case table (input, expected, student's output, ✓/✕) on the review screen and drop or replace the single question-level "Expected Answer" line. Determine show-vs-hide rules for hidden cases with the user first.

---

## 14. Student: joining a class needs a manual refresh; zero-class home looks empty

- **Status:** FIXED & VERIFIED (2ef0748, 2026-10-23) · **Label: EASY**
- **Reported:** 2026-10-23, during pre-pilot testing — joining a class only showed up after a refresh, and the home page looked bare/broken for a student with no classes.
- **Root causes:**
  1. `StudentLayout.fetchClasses(true)` skipped the local cache read but still went through the legacy axios GET cache (5-min TTL) — the forced refetch after a successful join was served the PRE-join class list.
  2. `StudentOverview` rendered the heading + a "0 classes · 0 courses" line + an empty grid — no empty-state content at all.
- **Fix:** forced refreshes pass `bypassCache: true`; the overview renders a dashed empty panel (icon, "No classes yet", guidance, "Join a class" CTA wired through the outlet context to the layout's modal) and hides the stats line when empty.
- **Verified on dev AND prod:** joined a real throwaway class in-app — sidebar + grid updated instantly with no reload; a zero-enrollment test student saw the empty state, and its CTA opened the join modal. All fixtures (classes, courses, test user) deleted afterwards.

---
*Closed/mostly-closed history kept for context: #11's original challenge-engine failure chain and its shipped fixes are documented under 11-L above; the legacy-era lesson challenges (22/24/25/27) whose blocks have no stored test cases were explicitly left as-is per user decision ("let's just move on") on 2026-10-22 — options (surgical backfill vs studio regeneration) remain available if revisited.*
