# InstructAI — project guide for coding agents

AI-powered LMS for programming education, built for Penaranda Senior High School.
Stack: Laravel (backend/, port 8000) · React 19 + Vite (frontend/, port 5173) ·
Python RAG service (instruct-ai-service/) · Kotlin Android app (cognify/).

## Commands

- Frontend (from `frontend/`): `npm run dev` (5173) · `npm run build` (vite
  build — run after every frontend change as the verification gate) ·
  `npm run lint` (eslint) · `npm run format` (prettier).
- Backend: `php artisan serve --port=8000` with Herd's PHP 8.4 (see gotchas).
- AI service: `python main.py` from `instruct-ai-service/` (FastAPI, port 8001).

## Roles & admin

Three roles — admin / teacher / student — enforced by `EnsureRole` middleware
(alias `role`, registered in `bootstrap/app.php`). Admin-only whitelist
management gates registration: `/api/admin/student-whitelist` and
`/api/admin/teacher-whitelist` CRUD over the `EnrolledStudent` (student LRN
numbers) and `WhitelistedTeacher` models; UI in `pages/admin/`
(`StudentWhitelist.jsx`, `TeacherWhitelist.jsx`) on the shared `AdminLayout`
with `components/admin/WhitelistManager.jsx`.

## Data layer migration (ACTIVE — read before touching any page's fetching)

We are migrating all data fetching to **TanStack Query** (stale-while-revalidate)
to fix slow/inconsistent refetching across pages. The full plan, phases, progress
tracker, and the rules for future pages live in **`docs/data-layer-plan.md`** —
read it before writing any `useEffect` fetch or touching `services/api.js`
caching. Short version: pages consume data via `src/queries/` hooks; loading
spinners only when no cached data exists — and page-level loading uses
**skeletons** (`components/ui/skeletons.jsx`), circle loaders only for small
inline actions; invalidate by query key after mutations; never add new
`bypassCache` usage.

## Cognify Android app (cognify/) — build & distribution

Official download: `backend/public/downloads/Cognify.apk` — served by Laravel at
`<backend-origin>/downloads/Cognify.apk`; the landing page's Cognify section
(button + QR) and the student sidebar promo card derive that URL from
`VITE_API_URL` (origin swap `/api` → ``). To ship a new version: bump
`versionCode`/`versionName`, run `./gradlew assembleRelease` in `cognify/`
(signing via committed `cognify/keystore.properties`; rotate out of the repo
before a real Play release), copy
`cognify/app/build/outputs/apk/release/app-release.apk`
→ `backend/public/downloads/Cognify.apk`, commit. The old on-device LLM
(mediapipe/litertlm) and Kokoro/sherpa TTS engines were removed from the app
(downloads), keep them out. Voice previews for the narrator picker are real
Fish Audio renders in `cognify/app/src/main/assets/voice_previews/`.

## UI/UX overhaul — active workflow (do not skip steps)

We are redesigning the web app **page by page**, one page at a time:

1. **Mockups first, always.** Before writing any UI code for a page, delegate 3
   distinct full-page design mockups to AutoClaw (the local desktop AI agent) via
   the `autoclaw` skill — user picks one they like. Self-contained briefs; ask for
   an absolute output path under `design/`; verify the file exists; show it.
2. **User confirms the mockup** before implementation. Iterate on it if asked.
3. **Implement in this repo** (never let AutoClaw write code here), then the user
   reviews the running page. Proceed to the next page only after their sign-off.
4. **Commit checkpoints** at meaningful milestones.
5. **Teacher-eye critique before sign-off.** Run the `teacher-eye` skill
   (fresh-agent unbiased teacher critique with screenshots) once a page's UI is
   implemented; relay the verdict and let the user pick which fixes to apply.
6. **Slop lint before sign-off.** Run `npx impeccable detect src/` (free CLI,
   61 deterministic AI-tell rules, no LLM) and fix objective findings **only in
   the page(s) just redesigned** — untouched pages keep their old looks until
   their own pass (they light up on every run; that's expected). Known
   intentional choices to ignore: Inter/Fraunces (Paper & Ink identity) and the
   lesson-prose blockquote's left border (editorial typography, not a slop
   card). Full-site lint happens after the last page is redesigned.

Pages done: landing (Paper & Ink), login, teacher register, student register,
EUNA chatbot section, teacher home/overview, class page + embedded content
builder (ClassDetails + CourseBuilder), lesson editor (LessonEditor: autosave,
preview, insert-between, challenge test cases; `useLesson` hook), quiz editor
(QuizBuilder: autosave, settings cards, per-question pipeline; `useQuiz` hook),
student class page (1:1 course logic), AI generation workflow redo (architect
→ centered Stage-1 design modal → review → content settings → 'AI generation
studio' console, all on gen- styles in CourseBuilder.css; rate-limit
wait-and-retry in the Python service; coding questions/lesson challenges
require stdin-driven programs and engine-verified test cases; language
availability is engine-reported (`GET /teacher/engine-languages` — builders
disable runtimes the server lacks, e.g. a dev box without g++); quiz
regeneration REPLACES questions; ai-commit takes a mode (append = default
keeps existing modules / replace = wipes the course's modules first, chosen
in the review modal when the class already has content); PDF text extraction
falls back from smalot to the pdfplumber /ai/extract-text endpoint when thin; an interrupted run keeps finished items and
offers 'Continue generation' for only the missing ones; the run persists to
localStorage (`ai-run:<courseId>`) so a refresh auto-reopens the studio with
restored progress — a deliberate close clears it; courses carry a
teacher-set `language` (courses.language, picker in the Curriculum modal) that
the AI must use for ALL generated code; the studio is tabbed
(Activity / Lessons & quizzes) with Pause-Resume and builder-parity editing
(add/reorder/delete blocks and questions) in the right pane; HTML challenges
may arrive as files[] projects; html_checks are teacher-only, never
AI-generated). The AI Tutor's vector index is fully automatic — no teacher UI:
`App\Services\LessonIndexer` syncs chunks after lesson saves and publish
changes (published lessons only, sha1 hash of extracted text skips
unchanged content, unpublish/clear removes chunks; runs in the terminating
phase so nothing blocks). Retrieval is course-scoped — `ai-run:<courseId>`
localStorage runs are the generation-resume mechanism. Classwork activities
redesigned + migrated (Classwork tab groups, ActivityCard, CreateActivityModal,
ActivityEditor on ed-/cw-/ae- styles; `queries/classwork.js` polls the list
every 15s while mounted — the legacy axios cache must be bypassed in query
hooks or every poll serves a 5-minute-old copy). Mobile pass done for class
page, content tab/module view, lesson + quiz editors, classwork list/create
modal/editor (mobile top bar in
TeacherLayout replaced
the floating burger; verify pages at 390px with `tools/browser/mobile-audit.mjs`).
Next up: quiz-taking view + remaining student pages (gradebook/grading/results
and the analytics→Progress rethink are DONE — Analytics/Monitor/Settings pages
were removed; Progress is a sidebar page `TeacherProgress.jsx` at
`/dashboard/teacher/progress?class=<id>` with a class switcher wrapping the
embedded ClassPulse, and the sidebar Management section is Overview/Progress/
To grade; quiz live rooms auto-close 24h after start via lazy
`ClassActivity::syncExpiredRoom()`).
Old file versions were replaced outright (no V2/V3 suffixes) — keep it that way.

**Apple retheme (teacher side, done):** per user direction the dashboard now
follows "Apple simple & elegant" — no purple anywhere (purple reads as
AI-generated; iOS blue `#0a84ff` dark / `#0071e3` light is the accent), neutral
Apple grays replace night-navy/morning-paper, Inter replaces Sora, flat glyph
icons (no tinted circles, no resting glows), sentence-case labels (mono kept
only for code/filenames/numbers), hairline borders, easy-read font sizes
(+1px small text, ~5–8% display). The legacy palette vars in `index.css`
(`--bg-primary`, `--accent`, …) share the same values so CourseBuilder and
legacy pages match. Landing/auth/EUNA keep Paper & Ink; Cognify keeps its
purple brand. Fonts must stay BIG and readable — don't shrink them back.

**Student retheme (done):** the whole student side runs on "Morning Paper" —
warm cream `#faf6ef` / ink / sage `#3e8e7e` in light, warm brown "Night Paper"
`#17130d` / cream / sage `#6cc5ad` in dark. Vars live in `Student.css` scoped
to `.student-theme` (which also remaps the `db-*` tokens to paper values inside
the student shell — ClassView's cd-/sv- classes resolve warm there). Focus-mode
pages (CourseViewer, ActivityViewer, QuizRoomView) carry the `student-theme`
class on their root div since they render outside StudentLayout. Display font
in the student shell is Fraunces (greetings, class/lesson titles; loaded
globally in index.css). Legacy standalone `/class/:classId/course/:id` route
was deleted — the builder lives embedded in the teacher class page. The
floating AI-tutor FAB stays glow-free and fails silently when the Python AI
service is down (no error toasts). The sidebar theme toggle is
`ThemeToggle variant="dark-panel"` — the same track/knob switch the teacher
sidebar uses (user-required parity; paper-scoped `side-*` vars in Student.css). Layouts are Apple-pattern (large titles on
canvas, segmented controls, grouped lists) and full-width: the legacy 1400px
`.main-content` cap is overridden in the student shell, all per-page max-width
columns were removed, and below 900px the sidebar becomes an off-canvas drawer
behind a sticky burger top bar (`.sv-mobilebar`/`.sv-backdrop` in Student.css).
Focus-mode routes are wrapped in `.student-theme` at the route level in App.jsx.

Dashboard-side conventions: styles live in \`styles/dashboard.css\` (\`db-\`
prefix, Inter display font, Apple-neutral dark/light themes, iOS blue accent).
Data via \`src/queries/\`
TanStack hooks. Loading = skeletons (\`components/ui/skeletons.jsx\`), never
spinners for page content. Native \`<select>\` is banned in redesigned UIs — use
the shared \`components/ui/Dropdown.jsx\` (\`dd-\` styles in dashboard.css;
supports icon, dashed, fullWidth, menuUp). Unbiased critiques: \`teacher-eye\` /
\`student-eye\` skills before page sign-off.

CSS architecture rule (user-mandated): REUSED styles/components go in the shared
\`dashboard.css\` (or a shared component file); PAGE-SPECIFIC styles live in a
dedicated CSS file next to the page (e.g. \`LessonEditor.css\`, \`CourseBuilder.css\`),
imported by that page/component only. Never pile single-page styles into
dashboard.css.

Parked UX decisions (need user sign-off): grading-queue door from the To-grade
tile; vocabulary pass (Classwork everywhere, Monitor/Analytics renames); floating
AI-tutor button on student pages; light mode as projector default. Due-soon strip
on student Modules tab already shipped.

## Design system — "Paper & Ink" (applies to every redesigned page)

- Palette: cream paper `#faf6ef` (paper-2 `#f3ecdd`, card `#fffdf7`), ink `#16130e`,
  soft ink `#57503f`, vermilion `#ff4b26`, marker yellow `#ffd43b`, sage `#3e8e7e`
  (student accent), chalkboard green `#14342a` + wood `#8b5e34`, purple `#6d5ae0` (Cognify).
- Fonts: **Fraunces** (editorial serif display, roman+italic mixes), **Inter** (body),
  **JetBrains Mono** (labels/kickers/buttons), **Caveat** (hand notes, `.font-hand`),
  **Walter Turncoat** (chalk text, `.font-chalk`). All loaded in `index.css`.
- Motifs: paper texture background (multiply blend), C1 correction-tape strips
  (paper-white, 2px ink border, hard 3px offset ink shadow, dashed vermilion line —
  code it in CSS, do NOT use tape images), oversized chapter numbers, hand-drawn
  arrow/sparkle doodles (assets in `src/assets/landing/`), coffee stains, spin badges,
  sticker cards, chalkboards with chalk tray.
- Auth pages: full-viewport split — paper form band (left) + wooden-framed
  chalkboard (right). On mobile they stack and must scroll (no height locks).
- Landing persona system: choosing teacher/student writes
  `localStorage['instructai-landing-role']` and adapts content; EUNA reads it too.

## AI Tutor (student side, components/student/AITutor.jsx)

- 12 tutors from `instruct-ai-service/config/characters.py`: the barkada
  (Ate Kai, Migs, Eya, Kuya Raf — no art yet, UI renders serif monograms) +
  guest anime cast ported from cognify (Gojo, Toji, Makima, Reze, Miku,
  Marin, Shinobu, Horikita — images in `frontend/public/tutor/`, copied from
  cognify drawables). `/ai/characters` returns each with its selection `key`.
- Streaming flow: Laravel `POST /student/ai/chat-prepare` (enrollment +
  ai_enabled + quiz-question guard, saves student turn, returns a signed
  payload + single-use turn token cached 10 min) → browser streams Python
  `/ai/tutor-chat-stream` DIRECTLY (artisan serve's single worker wedged
  when Laravel proxied chunked streams — don't reintroduce that proxy) →
  `POST /student/ai/chat-commit` persists the AI turn. Python ends the
  stream with a `<<<END_OF_TUTOR>>>` marker (HTTP keep-alive makes stream
  EOF unreliable); frontend strips it. Non-streaming `/student/ai/chat`
  stays as fallback.
- Auth: shared `AI_SERVICE_SECRET` (backend/.env + instruct-ai-service/.env).
  All `/ai/*` routes except `/ai/characters` require the `X-Internal-Auth`
  header (set by `App\Services\AiService` on every Laravel call); the one
  browser-facing route (`tutor-chat-stream`) instead verifies an HMAC over
  the exact payload JSON + timestamp that prepare mints. The stream handler
  and `tutor-chat` are sync def / sync generators — blocking Gemini calls in
  async def froze uvicorn's event loop; don't regress that.
- Retrieval is agentic: the model gets a `search_course_materials(query)`
  tool (max 2 calls, planner pass non-streamed, final pass streamed) instead
  of pre-stuffed RAG chunks. Tool results feed back as a plain user message
  (echoing assistant tool_calls trips Gemini 3.5's thought_signature rule).
  Lesson/quiz context is extracted SERVER-SIDE (client sends only ids +
  question_index); quiz text never includes correct answers. Context blocks
  are char-budgeted with clip logging (lesson 60k, quiz 12k, chunk 4k;
  history 12 turns × 8k per message — sized so ordinary lessons never clip;
  Laravel loads 16 rows to feed the 12-turn window).
- Prompt contract (`rag_tutor_service.py`): persona + mode rules (normal =
  full help; restricted = quiz/challenge guardrails) + topic scope with
  in-character refusal + language policy (ENGLISH default; Taglish only when
  the student writes Tagalog — verified both directions) + length by
  question depth. `TutorChatRequest` carries course_id for course-scoped
  retrieval.
- UI: ink-owl SVG FAB (no robot icon), character sheet (barkada/guests grid,
  monogram placeholders), mode-aware follow-up chips, double-click clear
  chat (`/student/ai/clear`), per-message + per-code-block copy. History is
  per student+class+character; a versioned-request guard keeps slow history
  loads from clobbering the optimistic send (StrictMode double-effects in
  dev make this load-bearing).

## EUNA chatbot (components/landing/EunaChatSection.jsx)

- 3D: `public/euna/euna_chibi.glb` + tex_*.jpg — vanilla three.js ported from the
  working `C:/Users/EDRICK/Desktop/euna/euna3d/viewer` implementation (toon +
  OutlineEffect, texture-swap visemes, bone head-follow clamped to the portrait
  card, organic idle bounce, portrait cam). Pause rendering when scrolled away.
- Chat: `POST /api/chat/message` with `{ message, history, role }` — backend prompt
  is role-aware and strictly scoped to InstructAI (refuses everything else).
- Voice: speaker toggle → `POST /api/euna/tts` (Fish Audio proxy, key stays in
  backend `.env`: FISH_API_KEY / FISH_MODEL_ID) → mp3 → Web Audio analyser drives
  mouth visemes. Reply text shows instantly; chip shows warming/speaking phases.

## Production (the deployed stack — all four live here)

Frontend **Vercel** `instruct-ai-topaz.vercel.app` (build-time VITE_ envs:
VITE_API_URL=https://instructai-backend.onrender.com/api, VITE_AI_SERVICE_URL,
VITE_WS_URL=wss://instruct-execute.onrender.com) · Backend **Render**
`instructai-backend.onrender.com` (env: AI_SERVICE_URL, AI_SERVICE_SECRET,
EXECUTION_ENGINE_URL, GEMINI_API_KEY — EUNA chatbot, FISH_*, CLOUDINARY) ·
AI service **Render** `instruct-ai-pnqz.onrender.com` (env: DATABASE_URL w/
sslmode=require, GEMINI_API, RIVER_API_KEY, AI_SERVICE_SECRET — must MATCH the
backend's, EXECUTION_ENGINE_URL bare no /execute) · Execution engine **Render**
`instruct-execute.onrender.com` (tokenless by design — the AI service's verify
client sends no engine token; ENGINE_TOKEN must stay unset until that client
learns it). **Render CLI is installed and logged in** (v2.31.0 at
`%LOCALAPPDATA%/Programs/render-cli/render.exe`, token in `~/.render/cli.yaml`;
run `render login` again if it expires). Use it before inferring anything about
prod from the outside — `render logs -r <id> --start ... --end ... -o json`
shows per-request app logs (path + duration), `render deploys list <id>`
confirms deploy windows, `render restart <id>` after sign-off. Service ids:
backend `srv-d75s5fa4d50c73cmbud0` · AI service `srv-dba8otfbtjjs73e84vag`
(instruct-ai) · engine `srv-dba8n8brjlhs739ba9b0` (instruct-execute). The
Render MCP server exists but adds nothing over the CLI for us (same API; the
CLI is scriptable with `-o json`).
All on Render's **free** tier: instances sleep after ~15 min idle
and take ~1 min to wake — run `node tools/keep-awake.mjs` during testing /
pilot / defense days (STOPS itself after 12h; don't run 24/7, the free
instance-hour pool is shared across the workspace). **Long AI streams go
browser→Python DIRECTLY, never through a Laravel proxy** — the Render relay
chain silently drops minutes-long SSE mid-run (clean EOF, no error frame)
and each streamed request held a PHP worker (the backend Dockerfile sets
`PHP_CLI_SERVER_WORKERS=4` **and must keep `--no-reload` on the serve
command** — Laravel's ServeCommand silently forces ONE worker without it,
so long requests (batch code runs, exports) would block every other
request on the site; but still don't proxy streams). The AI
Tutor, the studio's content generation, AND classwork question generation
all use the same signed-envelope pattern: Laravel mints an HMAC payload
(classwork: `ai-generate-prepare` → Python `/ai/qa-questions-stream-signed`,
replay-guarded, lesson/curriculum text resolved server-side inside the
signed payload; files ride along raw), the browser streams Python direct,
and the legacy relayed endpoints stay only as fallback.
Embeddings are remote:
Gemini `gemini-embedding-001`, 768-dim (document_chunks migration matches) —
no local torch model anywhere; `document_chunks.embedding` changed 384→768, so
old vectors only match after a wipe/reindex. `migrate:fresh` on the shared
Neon DB = wipe prod (local .env points at the SAME Neon database — there is
only one).

## Environment gotchas

- Backend needs **PHP 8.4+** — use Herd (`C:/Users/EDRICK/.config/herd/bin/php.bat`);
    XAMPP's 8.2 fails Composer's platform check. Run: `php artisan serve --port=8000`.
- **C++ runs via g++** — installed at `%LOCALAPPDATA%\mingw64\bin` (WinLibs gcc
    16.2; also exported in `~/.bashrc`). The engine probes PATH first, then
    well-known MinGW locations (MSYS2/choco/%LOCALAPPDATA%), so engine
    restarts need no PATH setup. Only the deployed DB/frontend/backend exist
    in this project — the execution engine is dev-local only.
    - **Single backend in dev** (port 8000). Artisan serve = 1 worker on
      Windows, so while an AI generation stream is live every other request
      blocks until it finishes — accepted (solo dev box). Production (php-fpm
      worker pool) doesn't have this issue. The old 8010 relay was removed:
      `VITE_AI_RELAY_URL` is gone from `frontend/.env.local` and streams fall
      back to the normal API URL (`CourseBuilder` still supports the var as an
      escape hatch if dev blocking ever becomes a problem again).
- Frontend dev API URL is pinned in `frontend/.env.local`
  (`VITE_API_URL=http://localhost:8000/api`, gitignored). The committed `.env`
  still points at `instructai.test` (currently not served).
- **Python service env drift**: `requirements.txt` pins `numpy<2` — a stray
  `pip install` that pulls numpy 2.x breaks torch 2.2's numpy bridge and the
  embedding service dies with "Numpy is not available". Fix:
  `pip install "numpy<2"` and restart `python main.py`.
- AutoClaw restarts rewrite `~/.openclaw-autoclaw/.gateway-token` and briefly
  remove it — the skill script re-reads it per call; just retry after a restart.
- Asset matting (white→alpha) tool: `tools/matte/` (`matte.js`, `trim.js`).
- Responsiveness/visual audits: `tools/browser/mobile-audit.mjs` (login, real
  ids via API, overflow + off-screen element report, screenshots to gitignored
  `tools/browser/shots-mobile/`).
- **Scratch files go OUTSIDE the repo.** Never leave test PDFs, response dumps, or
  one-shot scripts in the project or system folders — use `%TEMP%` (outside the
  project) and delete after use. `tools/browser/` (Playwright audit harness) and
  `tools/matte/` are the only allowed tooling; one-shot fix scripts must be
  deleted after they run.
