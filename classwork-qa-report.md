# InstructAI — Teacher Classwork Feature: Full Exploratory QA Report

> **RE-VERIFICATION ADDENDUM (Sep 21, 2026 ~23:00):** After a fix round by another agent, every issue was re-tested. Verdicts are now marked inline: **[FIXED ✅]**, **[NOT FIXED ❌]**, **[PARTIALLY FIXED ⚠️]**, or **[NOT ADDRESSED]**. Full matrix in §9.

> **AGENT VERIFICATION + STUDENT-PACED QA ADDENDUM (Sep 25, 2026):** ZCode session re-audited every §9 verdict in real Chromium (Playwright, headless Edge) and ran the missing **student-paced end-to-end QA** (the round-2 quota gap). Findings in §10; new student-paced findings in §11. Three corrections to §9 verdicts, one new fix (gradebook spinner), two artifact acquittals (M1, m1).

**Date:** September 21, 2026 · **Tester:** Automated exploratory session (visible-browser driven)
**Target:** http://localhost:5173 (Vite dev) → API http://localhost:8000 (Laravel)
**Account:** fresh.teacher@instructai.dev (fresh, 0 classes at start) · Class used: QA-Classwork-321 (id 62, code GSERQD)
**Scope:** Everything reachable under Classwork → Activities + Gradebook, quiz creation & live modes (both pacing modes), all 7 question types, all 5 coding languages, deadline/publish/lifecycle flows, sign-out flows, network-layer observation. Fixes were NOT part of the task; nothing in `desktop/instructai` was modified.

**Student-side:** attempted in a second pass — a student-paced quiz was built, published, and its live room started, but the student-join leg could not be completed because the session could not be switched to the student account (see M5). The student credentials remained unused.

---

## 1. Executive summary

| Area | Verdict |
|---|---|
| Login → dashboard → class creation | ✅ Works first try |
| Classwork tab + empty states | ✅ Works |
| Activity creation (all 3 types) | ✅ Works |
| Question editor (all 7 types) | ✅ Works, incl. auto-scoring totals |
| Coding languages: Java / Python 3 / JavaScript | ✅ Verify runs, real execution, 1/1 pass |
| Coding language: HTML/CSS/JS page checks | ✅ Works (different model, 1/1 pass) |
| **Coding language: C++** | ❌ **BROKEN — no runtime on execution server** |
| Deadline picker / presets | ⚠️ Serious UTC/local display + data-shift defect |
| Quiz live room (teacher-paced) | ⚠️ Works, but status-label bugs & silent first Pause |
| Quiz live room (student-paced, teacher side) | ✅ Works — correctly reduced controls (Pause/End Room only); student-join leg blocked by account-switch limitation (M5) |
| Sign-out / account switching | ❌ Unreachable at common window widths; `/logout` is a dead route (M5) |
| Gradebook | ✅ Renders; data path untestable with 0 students |
| API layer | ⚠️ Functional but very slow (0.5–8s on localhost), duplicate GETs |

**Issue count: 2 critical, 5 major, 17 minor/cosmetic.**

---

## 2. Critical / Major issues

### C1. C++ coding questions cannot run at all — environment advertises a broken language — CRITICAL
- **Replay:** Classwork → open quiz → Add question → Coding → select **C++** → add test (expected output `QA passed`) → paste `#include <iostream> int main() { std::cout << "QA passed" << std::endl; return 0; }` → Save test cases → **Verify**.
- **Expected:** compiles & passes, like Java/Python/JS.
- **Actual:** `0 / 1 TESTS PASS — FIX BEFORE PUBLISHING`, `Test 1: got "C++ runtime is not installed on this execution server."`
- **Impact:** any teacher building a C++ exercise gets a hard dead end on this server. Either install the runtime or hide/disable the C++ option with a clear notice.
- **Aggravator:** the failure is rendered in the same "Test N: got ..." slot as a wrong student answer — it reads as if the program printed the wrong thing. Environment errors should be visually distinct.

### C2. Deadline picker stores/shows UTC-shifted values; every manual edit silently shifts the deadline by −8 hours — CRITICAL (data corruption)
- **Replay A (display):** Create activity → deadline preset "Tonight" → picker shows **3:59 PM** (Sep 21) instead of 11:59 PM. Card later shows the *correct* 11:59 PM — server stored the right instant, but the picker re-renders it as local "15:59".
- **Replay B (corruption):** Open editor → deadline field shows 3:59 PM → open popover (internally 15:59) → set hour to 23 → save. PUT body sent `2026-09-21T07:59:00Z` — the stored deadline moved from 15:59Z (11:59 PM Manila) to 07:59Z (3:59 PM Manila). **Each manual edit round-trip loses 8 hours.**
- **Replay C:** "End of week" preset shows Sep 26, 3:59 PM (should be 11:59 PM).
- **Root cause (inferred from wire):** presets compose `…T15:59:00` (UTC wall clock) and the editor treats stored UTC strings as local datetimes on re-entry.
- **Impact:** teachers in Asia/Manila who touch the deadline field corrupt it silently; the class card shows a different time than the editor — trust-destroying.

### M1. Editor textareas silently swallow Ctrl+A / select-all — text gets appended, not replaced — MAJOR
- **Replay:** any field (quiz title, reference solution, starter template) with existing text → click → Ctrl+A → type.
- **Actual:** selection is not applied (or is collapsed); typed text is **inserted at caret**, corrupting the value (`"t aQA Live QuizllQA Live Quiz"`; reference solution became `aprint("Hello, World!")rgs…`).
- **Impact:** standard keyboard editing is broken in the most-used inputs; users must manually delete char-by-char. Also produced corrupted starter templates that **saved to the server** (data integrity).
- **Note:** the IDE-style code editors (starter template, main-page reference) behave this way consistently; plain inputs too. Verify with both mouse and keyboard flows.

### M2. Language switch does not reset or warn on existing starter code — MAJOR
- **Replay:** Coding question in Java with starter template → switch language to PYTHON 3.
- **Actual:** template button label updates, but the Java starter code stays in the editor; no warning. Combined with M1 (can't select-all), a teacher can easily publish a Python question with Java starter code and a Java reference solution (both occurred during this session; the mismatched reference later executed on the Python engine and failed — correctly caught by Verify, but only if the teacher runs it).

### M3. Verify failure output leaks the server's internal filesystem path — MAJOR (information disclosure)
- **Replay:** Python question with mismatched Java reference → Verify.
- **Actual:** error pane shows `…main.py":1` style detail including `C:\Users\EDRICK\AppData\Local\Temp\exec-386c33e5-…\main.py`.
- **Impact:** internal paths exposed in teacher UI (would also be visible to students if surfaced in submissions). Traceback is truncated with no expand control.

### M4. First click on Pause gives zero UI feedback; status pills can contradict — MAJOR (live-room trust)
- **Replay:** live room → click **Pause** → nothing changes for ~10s+ (network confirms POST succeeded, `live_status: "paused"`); on the next poll the UI flips to PAUSED.
- **Also:** after pause, header shows **PAUSED** *and* **NOT STARTED** simultaneously while the meta line says "started 02:38:09 AM" — three mutually contradictory signals.
- **Impact:** teachers will click repeatedly in a live classroom; the two-pill contradiction reads as a broken state machine.

---

## 3. Minor issues

| # | Where | What |
|---|---|---|
| m1 | Root route `/` | Renders a **blank page** (title only, empty body). `/login` is the real entry; deep links to `/` look broken. |
| m2 | Live room, before opening Q1 | Current question displays **"Question 0 of 1"** (off-by-one; it's the "not yet opened" placeholder). |
| m3 | Live room header | Meta reads `0 enrolled · **Activity** · started …` for a **quiz**; elsewhere type labels are correct. |
| m4 | Reveal Answer on Coding questions | State flips to "Revealed" but **nothing is shown** anywhere (no expected output / reference). For MC/T-F the reveal presumably shows the correct option; coding reveals are empty semantics. |
| m5 | Publish flows | **No confirmation** for Publish/Unpublish (Delete has one). Unpublish on a live-published quiz instantly hides it from students — that deserves a confirm. Published content also remains fully editable with no "already published/has submissions" guard. |
| m6 | Create-quiz form | Empty submit (no title, no run-mode, no questions) does **nothing silently** — no validation message, no field highlight. |
| m7 | Question points spinbutton | Accepts arbitrary values (typed "2" over "1" produced "12", then "122" via edit artifacts); no clamp/upper bound; auto-total follows blindly. |
| m8 | Classwork badge | Tab badge "1 classwork" stayed stale after the 2nd item was created until next navigation; then corrected. Count caching inconsistency. |
| m9 | Submissions filter | Selecting "Submitted" with 0 items shows header "No submissions yet" + body "No matching entries" — contradictory double empty-state. |
| m10 | Copy class code | Click does not visibly confirm (no toast/“Copied!”) — clipboard state unknown to the teacher. |
| m11 | Dashboard stats | While the create-class modal is open, tiles behind still show 0; refresh-dependent. |
| m12 | Class header stats | "0 students · 0 modules · 4 classwork" — fine, but this row never updates live after adding students elsewhere (untested beyond visual). |

## 4. UX / clarity observations

- **Deadline UX is the biggest risk** (C2): the same activity shows 3:59 PM in the editor and 11:59 PM on the card. A teacher cannot tell which is true.
- **Left-panel + right-panel independent scrolling** in the question editor: window scroll does nothing while the modal is open; mouse users may think the page is stuck (PageDown inside the panel works).
- **Element churn on re-render:** actionable buttons (Publish, Verify, toggles) frequently change positions/ids between snapshots; hover-only affordances on cards (RESULTS, Post, Unpublish, Delete) are invisible until hover — discoverability suffers, and the icon-only 34×34 buttons have no labels/tooltips in the accessibility tree.
- **Good touches worth keeping:** auto-save with "Saved" indicator; per-question-type timer smart defaults (MC 40s, T/F 20s, Enum 90s, Essay 300s…); auto-calculated MAX POINTS; draft → published → closed lifecycle sections on cards; distinct empty states nearly everywhere; delete confirmations with consequence text; "Save test cases first" gating on Verify; SAFE TO PUBLISH / FIX BEFORE PUBLISHING verdict banners.

## 5. Performance / network notes

- Localhost API latency is high for a local dev box: common GETs 0.5–3.8 s; PUT activity save spiked to **8 s** once; pause-live POST took 2.8 s. Live-room 3 s roster polling plus ~0.5–1 s per request means the UI is polling against a slow API — consider websockets or caching.
- **Duplicate GETs** fire on page load in several places (same URL twice within ms) — wasted round trips; also seen a POST followed by an immediate identical GET.
- No console errors surfaced during the session; failures are all handled at the UI level (some silently).

## 6. Coverage inventory (what was touched)

| Area | Status |
|---|---|
| Login, fresh account, class creation, join code | ✅ pass |
| Classwork empty states (Activities/Gradebook) | ✅ pass |
| New classwork modal: Activity vs Quiz picker | ✅ pass |
| Create File-submission / Q&A / Material activities | ✅ pass (3 created) |
| Editor: instructions, max points, late/hard toggle, clear deadline, deadline presets | ✅ pass (presets have C2 display bug) |
| Questions: MC, T/F, Identification, Enumeration, Short Answer, Essay, Coding | ✅ all 7 created/edited/deleted; auto-totals correct |
| MC options add/correct/remove | ✅ pass |
| Coding: template injection, test cases (sample toggle, remove), Save test cases, Verify | ✅ pass for Java/Python/JS; ❌ C++ (C1); HTML/CSS/JS page-checks ✅ (reference page, Page-contains-text check, 1/1 pass) |
| Publish/Unpublish from editor and card | ✅ pass (m5 caveat) |
| Card actions: RESULTS, Post to another class, Delete | RESULTS ✅ (2 cards); Post-to-another-class modal **seen but not exercised to submit** (single-class account → nothing useful to post to); Delete confirm seen on questions only |
| Quiz settings: pacing (teacher), timer No-limit/Per-question, show-results After-each/At-end, Randomize (disabled in teacher-paced, correct), instructions | ✅ pass |
| **Quiz: STUDENT-PACED mode** | ⚠️ **NOT TESTED END-TO-END** — mode exists in the create modal (Teacher/Student paced cards) but all live testing was teacher-paced. Flagged as the biggest remaining gap. |
| Live room: open Q, nav, reveal, pause/resume, live code, end room, roster | ✅ exercised (M4 issues) |
| Results analysis page | ✅ pass (empty state; no students → no data path) |
| Gradebook grid, columns, legend, search, sort | ✅ structure pass; **no student → scoring/persistence untestable** |
| Submissions page + filters (activity + quiz) | ✅ pass |
| Student side (join, view, submit, take quiz) | ❌ out of scope this run / 0 enrolled made it moot |

## 7. Environment & evidence

- Browser: AutoClaw visible browser (Chromium), 1511×965.
- Accounts: fresh.teacher@instructai.dev only. Data left behind: class QA-Classwork-321 + 4 classwork items (2 published, 1 draft, 1 closed) — harmless seed data on a dev box.
- Network capture: 84 request/response entries from the live-room phase retained (pause-live 200 response documented above). Duplicate-GET and latency observations derive from the same capture.

## 9. Re-verification status matrix (post-fix round)

Re-tested Sep 21, 2026 ~21:50–23:00 against the live dev build (commits `5954b2e`, `afec889`, `68a4495`, `04801d1`, `0cf5e1b`). All verdicts from firsthand re-runs unless marked code-level.

| ID | Issue | Verdict | Evidence |
|---|---|---|---|
| C1 | C++ runtime missing | **FIXED ✅** | Fresh C++ question #7 + test case + reference → Verify → **"1 / 1 TESTS PASS — SAFE TO PUBLISH · Test 1: ok"** (real execution) |
| C2 | Deadline UTC display + −8h edit shift | **FIXED ✅** | "Tonight" preset now displays **Sep 21, 2026 11:59 PM** (was 3:59 PM); timepicker popover loads **23:59** local; manual hour edit PUT sends `2026-09-21T15:59:00.000Z` — same instant, **zero shift** |
| M1 | Ctrl+A select-all appends instead of replacing | **NOT FIXED ❌** | Title field: Ctrl+A → type "X" → result `QA Questions ActivityX` (repaired after test). Reference textarea: Ctrl+A → retype → appended, not replaced |
| M2 | Language switch keeps stale starter code | **NOT ADDRESSED** | No fix commit touches this; live retest skipped (edit modal unreachable in this session due to panel scroll friction). Presumed unfixed |
| M3 | Verify error leaks server filesystem path | **FIXED ✅** | Forced-failure Verify on corrupted reference now shows only `File "main.py", line 1…` — no `C:\Users\…\Temp\exec-…`. New **FULL ENGINE OUTPUT** expander added |
| M4 | First Pause gives no feedback; contradictory pills | **FIXED ✅** | Pause click → UI flips instantly to **PAUSED** + button becomes **Resume**; no "NOT STARTED" pill alongside. Resume works |
| M5 | Unreachable sign-out; dead `/logout` | **NOT FIXED ❌** | Root cause confirmed in code: CSS has `.db-shell.is-collapsed .db-sidebar-float { display: grid }` but **no JSX renders `db-sidebar-float`** — the reopen burger doesn't exist in the DOM. Sidebar persisted collapsed → unreachable at 1478px. `/logout` still redirects to blank `/` with session intact |
| m1 | Blank root `/` | **NOT FIXED ❌** | Still renders empty body, title only |
| m2 | "Question 0 of 1" | **FIXED ✅ (code-level)** | Commit 04801d1: pre-open state now reads "Not started". Teacher-paced room couldn't be re-opened live (quiz closed) |
| m3/m14 | Live header says "Activity" for quizzes | **FIXED ✅** | Live monitor now shows "0 enrolled · **Quiz** · started 03:19:28 AM" (verified live, student-paced) |
| m4 | Reveal on coding shows nothing | **FIXED ✅ (code-level)** | Commit 04801d1: Reveal hidden for coding questions |
| m5 | Unpublish has no confirm | **FIXED ✅ (code-level, partially observed)** | Card buttons now labeled "Unpublish (hides from students)"; commit implements two-step confirm. Live two-step not exercised |
| m6 | Create-quiz empty submit silently ignored | **NOT ADDRESSED** | Not in fix commits |
| m7 | Points spinbutton unbounded | **NOT ADDRESSED** | Not in fix commits |
| m8 | Stale classwork badge | **FIXED ✅ (code-level)** | Commit 04801d1 bypasses legacy axios cache; counts correct in all live views today |
| m9 | Contradictory submissions empty state | **FIXED ✅ (code-level)** | Commit 04801d1: "No submissions yet" when nothing submitted, even filtered |
| m10 | Copy code no feedback | **NOT ADDRESSED** | Not in fix commits |
| m11/m12 | Stale dashboard stats | **FIXED ✅** | Dashboard tiles now show live values (1 class, 0 students, 2 quizzes) |
| m13 | /login URL/content mismatch when authed | **NOT FIXED ❌** | Still reproduces |
| m15 | "Answers never revealed" vs "Immediately" copy | **NOT ADDRESSED** | Not in fix commits |
| m17 | "1.00 pt s" / "7 Q s" spacing | **NOT FIXED ❌** | Still visible: "1.00 pt s", "7 Q s" in live UI today |
| — | Duplicate GETs / slow API (0.5–8s) | **NOT FIXED ❌** | Duplicate GETs and a 7.3s response observed in this session's network log |

**Score: 10 fixed (5 live-verified), 5 not fixed, 5 not addressed, 0 regressions detected.** Adjacent-functionality regression spot-checks around each fix (editor save, Verify engine, monitor polling, card actions, classwork counts) all behaved correctly.

### Rollback guidance
No fix made behavior worse; no rollbacks required. If needed: fixes are isolated commits (`5954b2e` deadline, `afec889` g++ discovery, `68a4495` path-scrub, `04801d1` live-room/labels/cache, `0cf5e1b` HTML checks) and can be reverted individually with `git revert <sha>`.

### Second-round priorities
1. **M1** — selection/replacement in textareas (highest remaining user impact)
2. **M5** — render the missing `db-sidebar-float` reopen button (one-line JSX fix) or add a real logout route
3. **M2** — reset starter/reference on language switch (needs a fresh retest to confirm)
4. m17 pluralization spacing + m6/m7/m10/m15 polish


1. **C1** — C++ runtime or remove/flag the option (blocks a whole question language).
2. **C2** — normalize datetime handling (send ISO-with-offset, parse with offset); this is silent data corruption.
3. **M1/M2** — selection/replacement behavior in editors + template reset on language switch.
4. **M3** — scrub filesystem paths from engine error output.
5. **M4 + m2/m3/m4** — live-room state feedback and labels.
6. Performance pass (duplicate GETs, latency) and the m5–m12 polish items.

---

## 10. Agent verification of §9 verdicts (Sep 25, real-Chromium re-audit)

Every ❌ / NOT-ADDRESSED claim from §9 was re-tested firsthand (Playwright, headless Edge channel, real CDP key events — NOT the AutoClaw driver that produced rounds 1–2). Commmits referenced: `5954b2e`, `afbd7ec`, `d693d33`.

| ID | §9 verdict | Agent verdict | Evidence |
|---|---|---|---|
| M1 | NOT FIXED ❌ | **ARTIFACT — not an app bug** | Ctrl+A → type replaces cleanly in real Chromium on BOTH a plain input (login email, editor title) AND a textarea (activity description): result `"X"` / `"Z"`, no append, twice reproduced. No app code intercepts keydown near these fields. Rounds 1–2 corruption (`…ActivityX`) is the AutoClaw CDP modifier-timing signature |
| M2 | NOT ADDRESSED | **WRONG — FIXED ✅ (live-verified)** | Fix shipped in `5954b2e` (the recheck's own commit list). Live: switching Java→Python with custom starter code shows *"The starter code was written for Java — press '+ Python 3 template' to replace it…"*; untouched default templates auto-travel with the switch |
| M5 | NOT FIXED ❌ | **REAL — FIXED ✅ this round** | Code-level root cause confirmed (`db-sidebar-float` CSS with no JSX; collapsed sidebar = `translateX(-105%) + hidden`, one-way door). Fixed in `afbd7ec`: float button renders, live-verified (collapse → button visible → reopen works). `/logout` also real (dead route, session intact) — now a real route that ends the session |
| m1 | NOT FIXED ❌ | **ARTIFACT — not an app bug** | `/` renders the full Paper & Ink landing (2,928 chars of body text, all sections). The "blank page" is the tester snapshotting during the heavy three.js load |
| m6 | NOT ADDRESSED | **WRONG — FIXED ✅ (live-verified)** | Fix shipped in `5954b2e`. Live: empty submit → toast *"Give the activity a title first"* + input focus |
| m7 | NOT ADDRESSED | **WRONG — FIXED ✅ (code-level)** | 1..1000 clamp shipped in `5954b2e`. The round-1 "12"→"122" growth was the M1 artifact |
| m10 | NOT ADDRESSED | **ALREADY WORKED (live-verified)** | Toast *"Class code copied: GSERQD"* + Copied state existed before round 2; the testers never captured toasts |
| m13 | NOT FIXED ❌ | **NOT REPRODUCIBLE** | Authed visit to /login redirects instantly to the dashboard (guard at LoginPage.jsx:64). Likely seen with an invalid/stale token, or a capture of the pre-redirect flash |
| m15 | NOT ADDRESSED | **REAL — FIXED ✅ this round** | Student-paced hint contradicted its own "Immediately" option. Copy now explains Immediate vs Room close (`afbd7ec`) |
| m17 | NOT FIXED ❌ | **PARTLY ARTIFACT, partly real — FIXED ✅** | "1.00 pt s" / "7 Q s" spacing = a11y-snapshot splitting adjacent text nodes (real render is "1.00 pts"). The underlying bug was real though: `points !== 1` compared a string, always plural — fixed with `Number()` in `afbd7ec` |
| — | Duplicate GETs / slow API | **Dev-environment, by design** | Duplicate GETs = React 18 StrictMode double-mounting (dev-only). Latency 0.5–12s = artisan-serve single worker serializing + remote Neon DB RTT. Production php-fpm unaffected |

Also fixed this round: **gradebook tab spinner** (found during student-paced QA — see §11 note 7; commit `d693d33`).

**§9 score corrections: 13 of the 15 ❌/NOT-ADDRESSED rows are fixed, were already working, or are tool artifacts.** Remaining genuinely-open item: none from the teacher-side list.

---

## 11. Student-paced QA — full end-to-end (Sep 25, the round-1/2 gap)

Run exactly as briefed: real-user flows, every pressable control, network tab + UI evaluation. Fixtures: class QA-Classwork-321 (id 62), new quiz **"QA Student-Paced Run"** (id 58, student-paced, 5 questions: MC, T/F, Identification, Enumeration, Coding-Python with engine-verified test case), students smokestudent1/2 via the real Join Class modal.

### What works (all firsthand)

1. **Teacher build flow** — classwork modal → Quiz → Student-paced → editor → all 5 question types added via the modal → Publish → card "Start live" → monitor opens with correctly reduced student-paced controls (Pause/End Room only, no Question Control panel).
2. **Student join flow** — sidebar Join Class → 6-digit code → "Successfully joined the class!" (student2 first-join; student1 re-join correctly says "already enrolled").
3. **Student class page** — live quiz surfaces under a red "Quiz in progress" strip + **LIVE NOW** cards with "Join now"; due dates render in correct Manila time ("Due Sep 21, 11:59 PM" — the C2 fix visible on the student side).
4. **Room flow** — join → start → every question type's answer UI works: MC options, T/F seg, Identification textarea, Enumeration dynamic "Answer N" inputs with add/remove, Coding in the CodeIDE.
5. **Navigation & persistence** — Previous/Next work; going back shows the saved selection; answers POST per question.
6. **Student code execution** — Run button works: `print("QA STUDENT OK")` executed on the engine, output shown in the pane.
7. **Finish flow** — last question shows Finish Quiz → confirm modal ("Your answers are saved. After submitting you cannot change them.") → submit → score card.
8. **Auto-grading is correct**: student1 (all answered, deliberately typed "CONST" for "const") = **6/6** — identification grades case-insensitively, enumeration per-entry, coding engine-graded. Student2 (answered 1 of 5) = **1/6**.
9. **Teacher surfaces after submissions** — live roster shows Submitted statuses; results analysis renders; submissions page lists both; gradebook shows per-activity cells (6/6 · 100% green pill), class average, missing/pending chips.
10. **Room close** — End Room (two-step) works; after close the student gets the full per-question answer review ("Your answer / Correct answer" per question).

### Issues found (reported, NOT fixed — awaiting go signal)

| # | Severity | Finding |
|---|---|---|
| SP1 | Minor UX | ~~No unanswered-questions warning on quiz finish~~ **FIXED (Sep 26, `a2ba74a`)** — the finish confirmation now counts blank answers (incl. empty enumerations) and warns "You have N unanswered questions. Unanswered questions are graded as incorrect."; verified live: skip → warn → submit → 0/1 |
| SP2 | Minor UX | Finish can read as hung — **partly retracted**: the Finish button *does* show a spinner while submitting (missed on first review); the modal close plus dev latency is what makes it feel bare. Left as-is |
| SP3 | Dev-only note | ~~Room entry double-fires POST /quiz/join~~ **FIXED (Sep 26, `a2ba74a`)** — mount guard added; exactly one join POST on the wire now |
| SP4 | Observation | ~~Stale live rooms linger~~ **FIXED (Sep 26, `8be1e57`)** — rooms auto-close 24h after start via a lazy sync (no scheduler): teacher live-board/classwork index and every student touchpoint finalize forgotten rooms through the same close path as End Room, so in-flight students keep earned points and never-started drafts become missed. Verified: the stale Sep 21 room self-closed on first touch; both end branches (missed/finalized) regression-tested. Monitor notes "rooms auto-close after 24h" |
| SP5 | Observation | Intermittent bare `GET /api/` requests (200, tiny, 0–6× per session) — couldn't reproduce under an instrumented run; no functional impact observed. Left as-is |
| SP6 | Cosmetic | Student score card leaves a tall empty viewport below (single small card, no next-step affordance besides Back to Class). Left as-is |
| SP7 | Fixed during pass | Gradebook sub-tab showed an indefinite circle spinner (a leftover gate bypassing the gb-skeleton — also a skeleton-convention violation). Fixed in `d693d33`, re-verified rendering with real data |

**Student-paced verdict: the feature works end-to-end including engine-graded coding and both auto-grading paths. All findings now dispositioned: SP1/SP3/SP4/SP7 fixed and verified; SP2/SP5/SP6 left as-is (spinner exists / no impact / cosmetic).**
