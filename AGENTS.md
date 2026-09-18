# InstructAI — project guide for coding agents

AI-powered LMS for programming education, built for Penaranda Senior High School.
Stack: Laravel (backend/, port 8000) · React 19 + Vite (frontend/, port 5173) ·
Python RAG service (instruct-ai-service/) · Kotlin Android app (cognify/).

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

Pages done: landing (Paper & Ink), login, teacher register, student register,
EUNA chatbot section. Next up: teacher dashboard/overview, then the rest of the
app. Old file versions were replaced outright (no V2/V3 suffixes) — keep it that way.

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

## Environment gotchas

- Backend needs **PHP 8.4+** — use Herd (`C:/Users/EDRICK/.config/herd/bin/php.bat`);
  XAMPP's 8.2 fails Composer's platform check. Run: `php artisan serve --port=8000`.
- Frontend dev API URL is pinned in `frontend/.env.local`
  (`VITE_API_URL=http://localhost:8000/api`, gitignored). The committed `.env`
  still points at `instructai.test` (currently not served).
- AutoClaw restarts rewrite `~/.openclaw-autoclaw/.gateway-token` and briefly
  remove it — the skill script re-reads it per call; just retry after a restart.
- Asset matting (white→alpha) tool: `tools/matte/` (`matte.js`, `trim.js`).
- **Scratch files go OUTSIDE the repo.** Never leave test PDFs, response dumps, or
  one-shot scripts in the project or system folders — use `%TEMP%` (outside the
  project) and delete after use. `tools/browser/` (Playwright audit harness) and
  `tools/matte/` are the only allowed tooling; one-shot fix scripts must be
  deleted after they run.
