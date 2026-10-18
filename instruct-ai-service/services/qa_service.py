"""
Q&A question generation for classwork activities.

One stream = batches of questions. Each batch is ONE structured Gemini call
for a single question type (rotating through the teacher's chosen types),
emitted as a `questions` event the browser previews live. Context arrives
pre-extracted from Laravel (lesson texts, curriculum, uploaded files) — this
service never touches the database or the filesystem.

Event contract (SSE `data: {json}\n\n`, `: heartbeat\n\n` comments):
  {"type": "status", "message"}                    — progress lines
  {"type": "questions", "data": {"questions": []}} — one batch, already shaped
                                                      like ActivityQuestion payloads
  {"type": "complete", "data": {"total": n}}       — all batches done
  {"type": "error", "message"}                     — fatal
"""

import asyncio
import json
import os
import urllib.request

from config.gen_schemas import qa_questions_format
from config.models import GEN_CONTENT_MODEL
from utils.ai_client_pool import AIClientPool, is_rate_limit_error

BATCH_SIZE = 5
HEARTBEAT_INTERVAL_S = 12
MAX_SOURCE_CHARS = 8000    # per source (lesson / file)
MAX_CONTEXT_CHARS = 30000  # total, matching the studio's context budget

TYPE_LABELS = {
    "multiple_choice": "multiple choice",
    "true_false": "true/false",
    "identification": "identification",
    "enumeration": "enumeration",
    "short_answer": "short answer",
    "essay": "essay",
    "coding": "coding",
}

# Per-type default points — the teacher edits them later in the editor, so
# generation never asks. Heavier formats cost more by default.
DEFAULT_POINTS = {
    "multiple_choice": 1,
    "true_false": 1,
    "identification": 1,
    "enumeration": 2,
    "short_answer": 2,
    "essay": 5,
    "coding": 5,
}

DIFFICULTY_HINTS = {
    "easy": "Recall and basic comprehension — definitions, direct facts, single-step reasoning.",
    "medium": "A blend of recall and application — questions that require understanding, not just finding.",
    "hard": "Application and analysis — multi-step reasoning, comparisons, edge cases, 'what happens if…'.",
}

_SYSTEM_PROMPT = """\
You are an expert teacher's assessment writer. You write classroom quiz and \
activity questions grounded STRICTLY in the provided class material.

Rules per type:
- multiple_choice: 3-5 options, exactly one correct; distractors plausible and \
drawn from common misconceptions in the material. "expected_output" is the \
correct option's TEXT verbatim.
- true_false: a clear statement; "expected_output" is exactly "True" or "False". \
Mix both across questions.
- identification: a question whose answer is ONE short canonical term or name \
(auto-graded by exact match, ignoring case). Keep "expected_output" 1-3 words. \
Avoid answers that could reasonably vary.
- enumeration: "How many / list the N …" style; "options" is the list of correct \
items (2-5 items), each a short phrase.
- coding: a small programming task grounded in the material, written in the \
CODE LANGUAGE given in the task. "boilerplate" is starter code for the student — \
signatures, comments and TODO placeholders only; it must NOT contain or reveal \
the solution. "reference_solution" is a complete correct program that solves \
the task and is substantially different from the boilerplate. "expected_output" \
is the exact console output the reference solution prints when run — copy it \
verbatim (a unittest run prints lines like "Ran 1 test in 0.001s" and "OK"); \
it is NEVER empty and never a bare placeholder such as ".". Keep the task \
small enough to finish in a few minutes and fully answerable from the material.
- short_answer: a question answered in one brief sentence or phrase. \
"expected_output" is a canonical phrasing a teacher would accept (auto-graded \
by exact match, so keep it tight and unambiguous).
- essay: open-ended discussion or explanation question that requires 3-6 \
sentences. No "expected_output" — the teacher grades these manually.

General rules:
- Every question MUST be answerable from the provided material — never invent \
facts from outside it.
- Vary the material coverage across questions; don't over-focus on one section.
- Match the requested difficulty. Write in clear classroom English.
- "type" is always exactly the requested type string.
"""


def _clip(text, limit):
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[:limit] + "\n…(truncated)"


def _build_context_block(context_sources):
    """One material block, clipped per source and to the total budget."""
    parts = []
    for src in context_sources:
        title = _clip(str(src.get("title") or "Material"), 120)
        text = _clip(str(src.get("text") or ""), MAX_SOURCE_CHARS)
        label = {
            "lesson": "Lesson",
            "curriculum": "Curriculum file",
            "file": "Uploaded file",
        }.get(str(src.get("source") or "file"), "Material")
        used = sum(len(p) for p in parts)
        remaining = MAX_CONTEXT_CHARS - used
        if remaining <= 500:
            break
        parts.append(f"=== {label}: {title} ===\n{text[:remaining]}")
    return "\n\n".join(parts) if parts else ""


def _build_batch_user_prompt(context_block, qtype, n, difficulty, focus, language=None, with_test_cases=False):
    focus_line = f"\nTEACHER'S FOCUS (honor it): {focus}" if focus else ""
    # Coding tasks are written in the course's language — the same convention
    # the studio uses so generated code never drifts
    language_line = (
        f"\nCODE LANGUAGE: write every line of code strictly in {language}." if qtype == "coding" and language else ""
    )
    test_cases_line = (
        "\nTEST CASES: every coding question MUST also carry a `test_cases` array of 2-3 objects "
        '`{"input", "expected_output"}` — "input" is the exact stdin fed to the program (may be empty only if '
        'the program reads nothing), "expected_output" is the exact stdout YOUR reference_solution prints for '
        "that stdin. Open-ended, no-input programs still get an empty-input test. Copy outputs verbatim; "
        "cover a normal case and at least one different-value case — the teacher will see these and students "
        "are auto-graded against them."
        if qtype == "coding" and with_test_cases else ""
    )
    return (
        f"CLASS MATERIAL:\n{context_block}\n"
        f"\nTASK: Write {n} new {TYPE_LABELS.get(qtype, qtype)} questions grounded ONLY in the "
        f"material above. Difficulty: {difficulty} — {DIFFICULTY_HINTS.get(difficulty, DIFFICULTY_HINTS['medium'])}"
        f"{language_line}{focus_line}{test_cases_line}"
    )


def _plan_batches(types, count, counts=None):
    """Split `count` fairly across the chosen types, then chunk each type's
    share into batches of BATCH_SIZE — every batch stays single-type so the
    strict schema holds, and every chosen type actually gets written.

    `counts` (type → n) is the teacher's explicit mix from Laravel — it wins
    outright and `count` is ignored."""
    if counts:
        batches = []
        for t, n in counts.items():
            if t not in TYPE_LABELS or int(n) <= 0:
                continue
            for start in range(0, int(n), BATCH_SIZE):
                batches.append((t, min(BATCH_SIZE, int(n) - start)))
        return batches
    base = count // len(types)
    extra = count % len(types)
    batches = []
    for i, t in enumerate(types):
        n = base + (1 if i < extra else 0)
        for start in range(0, n, BATCH_SIZE):
            batches.append((t, min(BATCH_SIZE, n - start)))
    return batches


async def _run_batch(ai_pool: AIClientPool, **call_kwargs):
    """One structured LLM call with the pool's wait-and-retry convention,
    executed in a worker thread. Yields ('status', msg) progress items and
    ('heartbeat', None) keepalives; finally ('result', content). Raises on
    fatal errors (including exhausted keys)."""
    queue = asyncio.Queue()

    async def runner():
        attempt_count = 0
        cool_downs = 0
        max_attempts = max(len(ai_pool.clients) * 3, 3)
        while attempt_count < max_attempts:
            client = key_num = None
            try:
                client, key_num = ai_pool.get_available_client()
                lane_kwargs = {**call_kwargs, "model": ai_pool.model_for(key_num), "timeout": 230}
                response = await asyncio.to_thread(
                    lambda c=client, kw=lane_kwargs: c.chat.completions.create(**kw)
                )
                ai_pool.mark_success(key_num)
                await queue.put(("result", (response.choices[0].message.content or "").strip()))
                return
            except Exception as e:
                if not is_rate_limit_error(e):
                    await queue.put(("error", e))
                    return
                if key_num is not None:
                    ai_pool.mark_rate_limited(key_num, backoff_seconds=60)
                attempt_count += 1
                if ai_pool.all_rate_limited() and cool_downs < 2:
                    wait_s = ai_pool.recovery_wait_seconds() or 60
                    cool_downs += 1
                    print(f"[QA] All keys cooling down — waiting {wait_s:.0f}s (round {cool_downs}/2)")
                    await queue.put(("status", f"AI quota cooling down — retrying in {int(wait_s)}s…"))
                    await asyncio.sleep(wait_s)
                    continue
                if attempt_count < max_attempts:
                    available = ai_pool.get_available_count()
                    if available > 0:
                        await queue.put(("status", f"Key rate-limited — switching ({available} available)…"))
                    else:
                        await asyncio.sleep(2)
                        await queue.put(("status", "All keys temporarily rate-limited — retrying…"))
                else:
                    await queue.put(("error", RuntimeError("All API keys are rate-limited. Please wait a minute and try again.")))
                    return

    task = asyncio.create_task(runner())
    try:
        while True:
            try:
                kind, payload = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_INTERVAL_S)
            except asyncio.TimeoutError:
                yield ("heartbeat", None)
                continue
            if kind == "status":
                yield ("status", payload)
                continue
            if kind == "error":
                raise payload
            yield ("result", payload)
            return
    finally:
        if not task.done():
            task.cancel()


def _parse_batch(content, qtype, language=None):
    """Parse one structured batch; tolerate prose-wrapped JSON. Points are
    ALWAYS the server's per-type defaults — the model's guesses are ignored
    (the teacher edits points in the editor, generation never asks)."""
    if not content:
        return []
    text = content.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        data = json.loads(text, strict=False)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1:
            print(f"[QA] unparseable batch ({qtype}): {text[:120]!r}")
            return []
        try:
            data = json.loads(text[start:end + 1], strict=False)
        except json.JSONDecodeError:
            print(f"[QA] unparseable batch ({qtype}) after slice")
            return []

    questions = data.get("questions") if isinstance(data, dict) else None
    if not isinstance(questions, list):
        return []

    out = []
    for q in questions:
        if not isinstance(q, dict):
            continue
        text_field = str(q.get("question_text") or q.get("question") or "").strip()
        if not text_field:
            continue
        options_raw = q.get("options") if isinstance(q.get("options"), list) else []
        item = {
            "type": qtype,
            "question_text": text_field,
            "options": [str(o).strip() for o in options_raw if str(o).strip()],
            "expected_output": str(q.get("expected_output") or "").strip(),
            # Server-owned defaults (1 pt objective, 5 pt essay/coding, …)
            "points": DEFAULT_POINTS.get(qtype, 1),
        }
        if qtype == "coding":
            item["boilerplate"] = str(q.get("boilerplate") or "").strip()
            # Laravel's ActivityQuestion column is reference_code
            item["reference_code"] = str(q.get("reference_solution") or "").strip()
            if language:
                item["language"] = language
            # Proposed IO test cases (optional, only requested by the teacher).
            # They are engine-verified against reference_code AFTER parsing —
            # anything the reference fails never reaches the review.
            tcs = []
            for t in (q.get("test_cases") if isinstance(q.get("test_cases"), list) else []):
                if not isinstance(t, dict):
                    continue
                t_in = str(t.get("input") or "")
                t_out = str(t.get("expected_output") or "").strip()
                if not t_out:
                    continue
                tcs.append({"input": t_in, "expected_output": t_out, "hidden": bool(t.get("hidden"))})
            item["test_cases"] = tcs
            # A coding task without starter code or a runnable expectation is
            # unsavable — skip it here so the teacher never reviews a broken card
            if not item["boilerplate"] or not item["expected_output"]:
                continue
        out.append(item)
    return out


# --- Proposed-test-case verification -----------------------------------------
# The execution engine grades students by running code and comparing stdout;
# a test case the reference solution itself fails would auto-zero a correct
# student. Every proposed test is run against reference_code on the engine
# and only tests the reference passes survive. Engine unreachable -> ship
# the questions WITHOUT test cases (teacher-graded) rather than blind. The
# mirrors CodeRunner::normalizeOutput so grading and verification agree.

def _normalize_output(text):
    text = (text or "").replace("\r\n", "\n")
    lines = [line.rstrip() for line in text.split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def _engine_exec(language, code, stdin):
    engine_url = (os.environ.get("EXECUTION_ENGINE_URL") or "http://localhost:3000").rstrip("/")
    engine_token = os.environ.get("EXECUTION_ENGINE_TOKEN") or ""
    headers = {"Content-Type": "application/json"}
    if engine_token:
        headers["X-Engine-Token"] = engine_token
    req = urllib.request.Request(
        engine_url + "/execute",
        data=json.dumps({"language": language, "code": code, "input": stdin}).encode(),
        headers=headers,
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def _verify_batch_test_cases(questions, language):
    """Keeps only test cases the reference solution actually passes; ships
    questions with zero surviving tests without test cases (teacher-scored)."""
    for q in questions:
        tests = q.get("test_cases") or []
        if not tests or not q.get("reference_code"):
            q["test_cases"] = []
            continue
        kept = []
        for t in tests:
            try:
                run = _engine_exec(language, q["reference_code"], t["input"])
                failed_on_engine = bool((run.get("stderr") or "").strip() or (run.get("compile_output") or "").strip())
                ok = (not failed_on_engine) and _normalize_output(run.get("stdout")) == _normalize_output(t["expected_output"])
            except Exception as e:
                print(f"[QA] test-case verify skipped — engine unreachable: {type(e).__name__}: {e}")
                kept = []
                break
            if ok:
                kept.append(t)
            else:
                print(f"[QA] dropped a proposed test case the reference solution failed")
        q["test_cases"] = kept
        if not kept:
            q.pop("test_cases", None)
    return questions


async def generate_qa_questions_stream(ai_pool: AIClientPool, context_sources, settings):
    """The full stream: plan batches → per-batch structured generation → events.

    `settings.counts` (type → n) is the teacher's explicit mix — Laravel's
    auto-mix also arrives in this shape, so this service only executes plans,
    it never invents one."""
    types = [t for t in (settings.get("types") or []) if t in TYPE_LABELS] or ["multiple_choice"]
    try:
        count = max(1, min(int(settings.get("count", 10)), 20))
    except (TypeError, ValueError):
        count = 10
    difficulty = settings.get("difficulty", "medium")
    focus = _clip(str(settings.get("focus") or ""), 500)
    language = str(settings.get("language") or "").strip() or None
    counts = settings.get("counts") if isinstance(settings.get("counts"), dict) else None
    generate_test_cases = bool(settings.get("generate_test_cases"))

    context_block = _build_context_block(context_sources)
    if not context_block:
        yield f"data: {json.dumps({'type': 'error', 'message': 'No readable context was provided.'})}\n\n"
        return

    yield f"data: {json.dumps({'type': 'status', 'message': f'Reading {len(context_sources)} source(s)…'})}\n\n"

    batches = _plan_batches(types, count, counts=counts)
    total = sum(n for _, n in batches)
    written = []

    for index, (qtype, n) in enumerate(batches):
        done = len(written)
        label = TYPE_LABELS[qtype]
        # Coding batches carry boilerplate + a full reference solution per
        # question — twice the tokens of an objective batch; a 2400 cap
        # truncates the JSON mid-string and the batch parses to zero.
        batch_max_tokens = 4000 if qtype == "coding" else 2400
        with_test_cases = qtype == "coding" and generate_test_cases
        yield f"data: {json.dumps({'type': 'status', 'message': f'Writing {label} questions ({done + 1}–{done + n} of {total})…'})}\n\n"

        recent = "\n".join(f"- {q['question_text'][:140]}" for q in written[-10:])
        user_prompt = _build_batch_user_prompt(
            context_block, qtype, n, difficulty, focus,
            language=language, with_test_cases=with_test_cases,
        )
        if recent:
            user_prompt += f"\n\nALREADY WRITTEN (do not repeat):\n{recent}"

        questions = []
        for attempt in range(2):  # one quiet retry on an empty parse
            content = None
            try:
                async for kind, payload in _run_batch(
                    ai_pool,
                    model=GEN_CONTENT_MODEL,
                    messages=[
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format=qa_questions_format(qtype),
                    temperature=0.6,
                    max_tokens=batch_max_tokens,
                ):
                    if kind == "heartbeat":
                        yield ": heartbeat\n\n"
                    elif kind == "status":
                        yield f"data: {json.dumps({'type': 'status', 'message': payload})}\n\n"
                    else:
                        content = payload
            except Exception as e:
                print(f"[QA] batch {index + 1} failed: {type(e).__name__}: {e}")
                yield f"data: {json.dumps({'type': 'status', 'message': 'That batch hit a snag — trying the next one…'})}\n\n"
                break

            questions = _parse_batch(content, qtype, language=language)
            if questions:
                break
            # A structured reply that parses to zero was invisible — log the
            # head so truncation/shape drift is diagnosable, then retry once.
            print(f"[QA] batch {index + 1} ({qtype}) parsed 0 questions "
                  f"(attempt {attempt + 1}/2) — head: {(content or '')[:200]!r}")
            if attempt == 0:
                yield f"data: {json.dumps({'type': 'status', 'message': 'That batch came back odd — retrying once…'})}\n\n"

        if not questions:
            yield f"data: {json.dumps({'type': 'status', 'message': 'That batch came back empty — trying the next one…'})}\n\n"
            continue

        if with_test_cases and any(q.get("test_cases") for q in questions):
            yield f"data: {json.dumps({'type': 'status', 'message': 'Verifying proposed test cases on the execution engine…'})}\n\n"
            questions = await asyncio.to_thread(
                _verify_batch_test_cases, questions, language or "python"
            )
            kept = sum(len(q.get("test_cases") or []) for q in questions)
            yield f"data: {json.dumps({'type': 'status', 'message': f'{kept} test case(s) survived verification'})}\n\n"

        written.extend(questions)
        yield (
            "data: "
            + json.dumps(
                {
                    "type": "questions",
                    "data": {"questions": questions},
                    "progress": {"done": len(written), "total": total},
                },
                ensure_ascii=False,
            )
            + "\n\n"
        )

    if not written:
        yield f"data: {json.dumps({'type': 'error', 'message': 'The AI could not write questions from that context — try different material or a smaller count.'})}\n\n"
        return

    yield f"data: {json.dumps({'type': 'complete', 'data': {'total': len(written)}})}\n\n"
