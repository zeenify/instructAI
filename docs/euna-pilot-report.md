# EUNA Pilot — "Take the wheel" agent for the teacher dashboard

**Phase: gather-info → implementation report.** Everything below was captured live from
Tencent Cloud's console assistant (internal codename **"Helix"**, service host
`kiki.tencentcloud.com`, widget bundle `cloud-helix-assistant-umd.js`, DOM prefix `qcaa-`)
by driving it in a logged-in session and instrumenting the page. Part 1 is how Tencent
built it (with the receipts). Part 2 is how we build ours on Laravel + React + the
Python Gemini service + EUNA.

---

## Part 1 — How Tencent's takeover chatbot actually works

### 1.1 What it looks like

A floating panel ("Cloud Assistant") lives on every console page. At the bottom of the
input there is a **mode selector with exactly two options**:

| Mode | Subtitle | Meaning |
|---|---|---|
| **UI Mode** | "Visual execution" | The AI operates the real page in front of you |
| **Pro Mode** | "Visual + Cloud API calls" | Same, plus it can call cloud APIs directly |

You type a task ("Check my unpaid bill details for this account"). What happens:

1. **Recon phase (silent, read-only).** The model runs tools like *Preparing for
   operation → Checking site information → Searching the console sitemap for the
   Transactions page entry*. These render as a live checklist inside the chat, each row
   getting a spinner that flips to a green check when done.
2. **Plan + consent gate.** It streams a plan ("Here's the plan: open your Billing
   Center's bill page and look at the unpaid items. You can interrupt me anytime."),
   then shows a big CTA: **"Operate for me"**. The input box locks with the placeholder
   *"Please confirm 'Operate for me' first"*. Its own words: *"I will ask you to take
   over for important steps or missing information."*
3. **The takeover.** After you click the CTA, the agent drives the real page:
   - a **virtual cursor** (animated arrow with a sparkle at the tip) glides to the target;
   - the target element gets a **rotating 4-color gradient border with a blurred aura**;
   - on click, a **64px pulse ripple** fires and the cursor does a little recoil;
   - every action is narrated live in the chat ("Expanding the Payment Management menu to
     find the unpaid bill entries") with the tool-checklist UI;
   - the URL actually changes (it navigated us to `/expense/bill`), and the panel +
     conversation survive the navigation.
4. **Reading results.** It reads values off the page (balances, table rows) and writes a
   grounded final answer — including a **markdown table** of the numbers it saw —
   followed by generated follow-ups ("You can continue: Set bill alarm / Top up balance /
   Export bills") and thumbs up/down.
5. **Failure path.** If a client step throws, the run stops with *"Something went wrong.
   Please try again later"* + a **"Continue for me"** link. Clicking it literally sends
   "Continue for me" as a *user message* — the retry is just another user turn.

### 1.2 The backend surface (from resource timing + response capture)

| Endpoint | Purpose |
|---|---|
| `GET /api/available` | feature flag / availability probe at widget boot |
| `GET /api/whoami` | → `{uid, profileId: "cloud-intl"}` (identity for the agent session) |
| `GET /api/fork` | mints a "fork ticket" used to carry the session across page navigations |
| `GET /api/suggest` | the suggested starter tasks (LLM-generated, ~2.5s) |
| `GET /api/chat?user=…` | **the agent stream** — long-lived SSE (observed 11.8s) |
| `GET /api/v2/history?sessionId=…&url=<page url>` | conversation history **keyed per page URL** — the assistant remembers conversations in the context of where you are |
| `POST /api/client-event` | client → server event sync (element registry, page state) during a run |
| `POST /api/client-error` | client-side execution errors reported back (`{ok:true}`) |

Navigation initiated by the agent appends a signed token to the URL:
`/expense/bill?__qcai_handover=EkY8JncV`. The bundle shows it asks the server for a
ticket (`broker.acquireTicket(location.href)` → `safetyNet.arm(ticket)`, refreshed every
4.5 min) — the next page load presents the token and the session **forks** onto it, so
the agent keeps talking mid-task across full page loads.

### 1.3 The wire protocol (captured verbatim)

`GET /api/chat` returns **SSE** (`data: {json}\n\n` lines, terminated by `data: [DONE]`).
The event names are the **Vercel AI SDK v5 UI-message-stream protocol** — they built the
backend on the `ai` npm package with an OpenAI-compatible model (tool-call IDs look like
`call_00_RkXSobFs2et6mYckMDqH3908`, OpenAI Responses-API style):

```
data: {"type":"start","messageId":"636ce999-…"}
data: {"type":"start-step"}
data: {"type":"reasoning-start","id":"reasoning-0"}
data: {"type":"text-start","id":"txt-0"}
data: {"type":"reasoning-end","id":"reasoning-0"}
data: {"type":"tool-input-start","toolCallId":"call_00_…","toolName":"invokeClient"}
data: {"type":"tool-input-available","toolCallId":"call_00_…","toolName":"invokeClient",
       "input":{"explain":"Opening the Transactions page to review recent payment records.",
                "skill":"tcloud-navigator",
                "command":"goto /expense/transactions"}}
data: {"type":"text-delta","id":"txt-0","delta":"I"}
data: {"type":"text-delta","id":"txt-0","delta":"'ll"}
data: {"type":"text-end","id":"txt-0"}
data: {"type":"finish-step"}
data: {"type":"finish","finishReason":"tool-calls"}
data: [DONE]
```

**The single most important design decision:** the model has exactly one tool —
`invokeClient` — and its arguments are `{explain, skill, command}` (or
`{explain, commands: [c1, c2, …]}` for batches, min 2). The server never touches the
page. It streams the command; **the browser executes it**, posts the result back, and the
server continues the loop (`finishReason: "tool-calls"` → client executes → next
`/api/chat` round-trip with the tool result).

### 1.4 The command vocabulary (from the SDK bundle)

Skills: `tcloud-navigator` (UI ops) · `tcloud-sitemap` / `tcloud-sitemap-intl` (site map
lookup) · `tcloud-query` · `tcloud-knowledge-qa` · `tcloud-history-qa` · `tcloud-api`
(Pro Mode's direct API path).

Commands (validated in the bundle):

| Command | Args | Notes |
|---|---|---|
| `goto` | `path_or_url` | goes through `handoverOrchestrator.prepareNavigation({targetUrl})` → handover token |
| `click` | `ref` (element index) | timeout 8s |
| `hover` | `ref` | used before click for the visual glide |
| `input` | `ref`, `inputValue` | aliases accepted: `fill`, `type` |
| `select` | `ref`, `selectValue` | |
| `scroll` | `ref?`, `scrollDirection`, `scrollDistance` | timeout 1s |
| `snapshot` / `screenshot` | — | **the state extractor** (below) |

The model doesn't guess CSS selectors. A `snapshot` produces a numbered
accessibility-style tree (`extractDOM().treeSnapshot`); the model addresses elements by
**ref number** (`"click 17"`). If the ref is stale the executor replies
*"ref not found — suggest snapshot to re-fetch the page"* and the model re-snapshots.
That's the same ref-index pattern browser agents (browser-use, Operator) use.

### 1.5 Safety machinery (from the bundle)

- **Consent gate** — read-only recon runs without permission; anything that operates the
  UI waits for the "Operate for me" CTA. Input box locks until confirmed.
- **Handoff on missing info** — "I will ask you to take over for important steps or
  missing information."
- **safetyNet + broker + tickets** — armed around navigations so the agent can't lose
  control mid-page-load (and presumably so unsaved-state risks are handled).
- **Judge** — a completion judge runs when the loop goes idle or is interrupted
  (`sendJudge`, `judgeReason: "interruption"`, `maybeStartCompletionJudge()`) — a
  model-based check of whether the task actually succeeded, feeding the retry/suggest UX.
- **Repeat detection** — `repeatDetected` aborts loops (agent stuck clicking the same
  thing).
- **Cursor color states** — the cursor has `blue-out`/`red-in` crossfade keyframes:
  it turns **red for dangerous actions**.
- **Stop button** — the send button becomes a stop button during a run ("You can
  interrupt me anytime").

### 1.6 The takeover visuals (CSS/HTML captured — this is the "wow" recipe)

**Virtual cursor `qcaa-cursor-helix`** — a 64×64 fixed-position layer moved purely with
`transform: translate3d(x, y, 0)`:

- arrow: a 40×40 **base64 PNG** (`__arrow`), transform-origin at the tip;
- click recoil keyframes: dips to `scale(0.72)` at 18–28% then overshoots to 1.04 —
  `cubic-bezier(0.22, 1, 0.36, 1)`, 0.36s;
- a **label pill** can ride next to the arrow (gradient
  `linear-gradient(154.5deg, #1966ff, #00aee8 35.7%, #60d8a8)`, white 14px text,
  1px white border, radius 3.6px, text-shadow) — that's how it shows what it's doing;
- a tiny sparkle star sits at the arrow tip;
- enter/leave: `translateY(40px) scale(0.92) → identity`, 0.3s ease-out.

**Target highlight `qcaa-target-highlight`** — fixed, `pointer-events: none`, sized to
the target rect via inline style (`top/left/width/height`), appearing with
`scale(1.13) → 1` + fade (0.3s). The border is an **SVG rect stroked with an animated
rotating gradient** — two stacked copies:

```html
<div class="qa-colorful-boundary-wrapper" style="--qa-border-width: 2px; --qa-animate-duration: 4s">
  <div class="qa-colorful-boundary-rect qa-colorful-boundary-rect--blur" style="filter: blur(17px)">
    <svg viewBox="0 0 256 52">
      <defs><linearGradient …>
        <stop offset="0%"  stop-color="#56f1ff"/>   <!-- cyan   -->
        <stop offset="33%" stop-color="#5fbcff"/>   <!-- sky    -->
        <stop offset="66%" stop-color="#3974ff"/>   <!-- blue   -->
        <stop offset="100%" stop-color="#fe6da5"/>  <!-- pink   -->
        <animateTransform attributeName="gradientTransform" type="rotate"
            from="0 128 26" to="360 128 26" dur="4s" repeatCount="indefinite"/>
      </linearGradient></defs>
      <rect … fill="none" stroke="url(#gradient)" stroke-width="3.2"/>
    </svg>
  </div>
  <div class="qa-colorful-boundary-rect">…same gradient, stroke-width 2.2, no blur…</div>
</div>
```

Blurred copy = aura glow; sharp copy = crisp edge. Rotation comes free from SMIL.

**Click pulse `qcaa-click-pulse`** — 64×64 fixed layer,
`transition: transform 0.25s cubic-bezier(0.4,0,0.2,1)`.

**Chat-side UI** — `qcaa-status-strip` ("Analyzing…"), `qcaa-structured-message__tool-item`
with `tool-icon--success`, `qcaa-cta-button` ("Operate for me"),
`qcaa-task-suggestions` ("You can continue: …"), `qcaa-md-table-wrap` (results as
markdown tables). The panel survived page navigations because it's mounted at
`<body>` level by the SDK, outside the app's router root.

---

## Part 2 — Building ours: **EUNA Pilot** on the teacher dashboard

Same product shape, our stack. Names used below: **EUNA Pilot** (feature), panel =
`EunaPilot.jsx`, "Take the wheel" = the consent CTA.

### 2.1 Architecture (mapped 1:1 to ours)

| Tencent | InstructAI |
|---|---|
| kiki.tencentcloud.com (separate service) | `instruct-ai-service/` FastAPI (already hosts the tutor) |
| OpenAI-compatible model + `ai` SDK stream | **Gemini function calling** in the Python service (same place `rag_tutor_service.py` lives) |
| `GET /api/chat` SSE | `POST /ai/pilot-stream` SSE from FastAPI, **browser connects directly** (same reason as the tutor: artisan serve = 1 worker, don't wedge Laravel mid-stream) |
| `whoami` + cookies | Laravel `POST /teacher/ai/pilot-prepare` (auth + role + enrollment of context, single-use turn token, mirrors `chat-prepare`) and `POST /teacher/ai/pilot-commit` |
| `/api/v2/history?sessionId&url` | per **teacher + page-route** history tables (or reuse the tutor history pattern with a `page_route` column) |
| `__qcai_handover` + fork tickets | **mostly unnecessary for us**: we're a react-router SPA — `goto` = `navigate()` + state carried in a Zustand/Context store; for the few full reloads, persist run state to `localStorage['euna-run:<id>']` and rehydrate (same trick as `ai-run:<courseId>`) |
| `invokeClient` executed by their SDK | `invoke_client` executed by **our React executor** — we own the dashboard DOM, so this is *more* reliable for us than for them |
| `snapshot` registry | our own `buildElementSnapshot()` util (2.3) |
| Pro Mode (`tcloud-api`) | Phase C: "Direct mode" — same agent calls Laravel APIs instead of driving UI |

**The loop** (identical shape to theirs):

```
Teacher types task
  → Laravel pilot-prepare (auth, save user turn, mint token)
  → browser opens SSE to Python /ai/pilot-stream (carries task, page route, snapshot, history id)
      Python loop (Gemini):
        stream text deltas → UI renders narration
        model calls invoke_client {explain, commands:[…]}
        stream emits tool-input event, then finish(tool-calls)
  → React executor runs the commands (cursor + highlight + click/input/goto…)
  → executor collects per-command results
  → browser re-POSTs continuation (tool results) to /ai/pilot-stream (same conversation)
  → loop until finish(stop) → Laravel pilot-commit (save AI turn, audit rows)
```

Two streams per step is exactly what Tencent does (each `/api/chat` call ends at
`finishReason: tool-calls`; the client continues with a fresh call). It keeps the Python
loop stateless-ish and survives interruptions naturally.

### 2.2 Gemini specifics

- One declared tool, mirroring theirs:

  ```json
  { "name": "invoke_client",
    "description": "Execute UI actions in the teacher's dashboard. Only what the user asked for.",
    "parameters": { "type": "OBJECT",
      "properties": {
        "explain":  { "type": "STRING", "description": "One friendly sentence: what you're about to do and why." },
        "commands": { "type": "ARRAY", "items": { "type": "OBJECT", "properties": {
          "action": { "type": "STRING", "enum": ["goto","click","hover","input","select","scroll","snapshot"] },
          "ref": { "type": "INTEGER" }, "value": { "type": "STRING" },
          "direction": { "type": "STRING", "enum": ["up","down"] } } } }
      }, "required": ["explain", "commands"] } }
  ```

- **Function calling mode:** normal auto function-calling; the *agentic* part is our
  server loop (call Gemini → if it emitted `invoke_client`, END the stream with the tool
  event and wait for the client result, then feed it back as the function response).
  This is the same tool-loop shape as the tutor's `search_course_materials` — just with
  the "tool" executing on the other side of the wire.
- **Thought signatures:** we already handle the Gemini-3.5 thought-signature rule in the
  tutor (never echo assistant tool_calls back as plain messages). Same rule here: replay
  history as proper function-call/function-response pairs, never stringify them.
- **System prompt contract** (mirror theirs): EUNA persona + "you operate the InstructAI
  teacher dashboard" + scope guard (refuse anything outside the dashboard, in character)
  + the consent rule: *recon freely; before the first mutating command, emit a
  `request_consent` event and stop streaming until the client confirms* (implemented as
  its own event type rather than a special tool, so the gate is structural, not prompt
  hope) + language policy (English default, Taglish when the teacher writes Tagalog).

### 2.3 The element snapshot (our `click 17`)

Because we own the React app this is easy and stable:

1. Walk the visible DOM inside the dashboard shell (skip the panel itself, skip
   `aria-hidden`, zero-size, disabled).
2. For each interactive element (`a, button, input, textarea, [role=button],
   [role=tab], [role=menuitem], [contenteditable], our `dd-` Dropdown triggers), emit:
   `{ ref, role, name (accessible name / visible text, 40 chars), placeholder?, value?,
      tag, href? (route links) }` — max ~80 elements, cap ~4k chars (tutor's
   char-budgeting discipline applies).
3. Elements get `data-euna-ref` attributes while a run is active (executor needs to
   resolve refs fast; also lets us draw the highlight without re-querying).
4. Re-snapshot after every navigation/mutation (the model is told: *"after any goto or
   click that changes the view, take a snapshot before the next action"* — same
   "suggest snapshot" recovery Tencent uses when a ref goes stale).

Our custom `Dropdown.jsx` needs a two-command idiom (`click trigger` → snapshot →
`click option`), which the batch `commands[]` supports — same as Tencent handling their
own non-native widgets.

**React quirk to respect:** setting input values on controlled components requires the
native setter + `dispatchEvent(new Event('input', {bubbles:true}))` (standard
React-controlled-input workaround). Buttons: `el.click()` works; for extra fidelity
dispatch pointerdown/mousedown/up/click so every handler fires.

### 2.4 The executor + takeover visuals (the shock-and-awe layer)

New shared module `frontend/src/pilot/`:

- `elementSnapshot.js` — registry builder (2.3).
- `executor.js` — command runner: resolves ref → scrolls into view → moves cursor →
  highlights → clicks/inputs → collects `{ok, message, data}` per command. `goto`
  calls react-router `navigate()` and awaits the route transition. `snapshot` returns a
  fresh registry to feed the next model turn.
- `overlay.jsx` + `pilot.css` — cursor + highlight + pulse, reimplemented in our palette:

  - cursor: inline SVG arrow (no base64 PNG), 40px, tip as transform-origin, same
    recoil keyframes; a label pill with a **sage→vermilion gradient** for our identity;
    sparkle star kept (it's 80% of the charm);
  - highlight: same two-copy SVG trick (blurred aura + crisp stroke), gradient recolored
    — e.g. sage `#6cc5ad` → sky `#5fbcff` → ink-blue `#3974ff` → vermilion `#ff4b26`;
    CSS `@property` + conic-gradient is the alternative, but the SMIL-rotated SVG
    gradient is simpler and matches what we captured;
  - destructive-action cursor turns **red** (their blue-out/red-in idea — adopt it).
- Movement: animate the cursor along a 2-segment path (ease-out glide, ~400–700ms) by
  updating `transform: translate3d()` in a rAF loop. Never block on it — execution
  continues after the *click*, the cursor is theater.

**Execute mutations through the real UI, not hidden API calls.** Every action the agent
takes goes through the same components and Laravel endpoints a teacher's click would —
so `EnsureRole` middleware, policies, validation, autosave, and audit trails all apply
for free. This is Tencent's design too and it's the right safety default.

### 2.5 Consent, interruption, and safety (non-negotiables)

1. **Structural consent gate:** the Python stream emits `{"type":"consent-request",
   "explain": …}` before the first mutating batch; the React client shows the
   **"Take the wheel"** CTA and locks the input until clicked (exact Tencent pattern).
   Recon + navigation + reading may proceed without it.
2. **Stop button:** send ⇄ stop during runs; aborting closes the SSE and posts
   `run_aborted` to commit so history stays consistent.
3. **Danger confirmation:** destructive verbs (`delete`, `replace`, `unpublish`,
   anything the UI itself confirms) always re-confirm in the panel — even after
   "Take the wheel". Red cursor while armed.
4. **Server-side cap:** max N commands per run and per turn (like the tutor's budgeted
   tool calls) + repeat detection (same action+ref 3× → abort with an honest message —
   their `repeatDetected`).
5. **Audit:** every executed command → `pilot_audit` rows (teacher_id, route, command
   JSON, result, timestamp) written at commit. Free compliance win for a school product.
6. **Scope guard:** the model can only emit our 7 verbs; there is no "call arbitrary
   API" tool in Pilot mode (that's Direct mode, later, and it would go through Laravel
   routes with policies anyway).
7. **Fails silently when the Python service is down** (same rule as the AI-tutor FAB).

### 2.6 Panel UX (what we copy, what we EUNA-ify)

Copy the skeleton: header (avatar, dark toggle, collapse, new chat) · streaming
narration · tool-item checklist (spinner → check) · status strip · consent CTA ·
markdown answers with tables · "You can continue:" suggestions · thumbs feedback ·
per-route memory.

EUNA-ify: ink-owl avatar + Paper&Ink/Apple-neutral styling on `db-` tokens (it sits on
the teacher dashboard — no purple), serif monogram touches, Caveat hand-note for the
"Operate for me" hint text if it fits. The floating entry point is the existing
AI-tutor FAB pattern (glow-free, silent failure).

### 2.7 Build phases

- **Phase A — pure frontend shock demo (no backend risk):** `elementSnapshot.js` +
  `overlay.jsx/pilot.css` + `EunaPilot.jsx` panel shell with a scripted demo loop
  (fake SSE driving real cursor/highlight/scroll over e.g. the class page). This alone
  demos the "whoa" to anyone.
- **Phase B — real loop:** `invoke_client` tool + loop in the Python service;
  `pilot-prepare/commit` in Laravel (+ `pilot_audit` table); read-only verbs
  (goto/click/hover/scroll/snapshot + input only inside forms the teacher asked to
  fill); consent gate; per-route history; stop button; continue-on-error ("Continue
  for me" = re-ask as user message).
- **Phase C — autonomy:** write verbs unlocked behind consent (create class, build
  activity, enroll whitelist rows via the real UI), task suggestions, completion judge
  (cheap second Gemini call: "did it succeed? what's the next best step?"), Direct mode
  (agent calls Laravel APIs via `AiService` instead of UI theater — useful for bulk
  work), mobile pass at 390px.

### 2.8 Honest differences vs. Tencent (so nobody's surprised)

- They're multi-page; we're an SPA — our handover problem is *much* smaller (react-router
  state + localStorage rehydrate covers it; no fork tickets needed).
- Their model sees a generic a11y tree; we can pre-label key controls
  (`aria-label`/`data-euna-name`) during the redesign passes, so our snapshots are
  cleaner and cheaper than theirs can ever be.
- artisan serve's single worker means the SSE **must** terminate in Python (established
  tutor pattern), and Laravel only sees tiny prepare/commit POSTs.
- Their GET-with-`user=N_characters` query param is a privacy-redaction curiosity of
  theirs, not something we need; ours is a plain POST with a turn token.

---

## Appendix — evidence index

- Streaming capture (verbatim SSE): first `invoke_client` =
  `{explain:"Opening the Transactions page to review recent payment records.",
    skill:"tcloud-navigator", command:"goto /expense/transactions"}`;
  continuation used `command:"click 17"`.
- Command verbs parsed from bundle: `["click","hover","input","select","scroll","goto",
  "screenshot"]` + alias map `{fill:"input", type:"input"}`; batch min 2; per-command
  timeouts 8s (click/input/select/goto) / 1s (scroll/snapshot).
- Skills in bundle: tcloud-navigator, tcloud-sitemap, tcloud-sitemap-intl, tcloud-query,
  tcloud-knowledge-qa, tcloud-history-qa, tcloud-api.
- Bundle also shows: `handoverOrchestrator.prepareNavigation`, `safetyNet.arm(ticket)` +
  `broker.acquireTicket` (refresh 270s), `sendJudge`/`maybeStartCompletionJudge`,
  `repeatDetected`, `pendingSubmissionAcceptanceSettlers` (submit gating),
  `extractDOM().treeSnapshot`, `enableFollowUpSuggestions`.
- Overlays captured live: `qcaa-target-highlight` (dual SVG rect, rotating
  `#56f1ff→#5fbcff→#3974ff→#fe6da5` gradient, blur 17px aura, stroke 3.2/2.2),
  `qcaa-click-pulse` (64px), `qcaa-cursor-helix` (base64 arrow PNG + label pill +
  click-recoil + enter/leave keyframes + blue→red crossfade pair).
- Endpoints observed: available, fork, whoami, suggest, chat (SSE, 11.8s),
  v2/history?sessionId&url, client-event, client-error.
- Live runs: full bill-check task (consent → navigate → close notice → expand menu →
  read balances → markdown-table answer → follow-ups) and a transactions-navigation run;
  one induced failure showing the "Something went wrong / Continue for me" recovery.
