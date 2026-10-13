"""
EUNA Pilot — the agentic loop (one stream turn per call).

Architecture (mirrors the tutor service's conventions):
- The browser connects DIRECTLY to FastAPI; Laravel signs each turn's payload
  with the shared secret (HMAC) and persists turns around the stream.
- Each call is ONE Gemini streaming turn with the invoke_client/request_data
  tools. When the model calls a tool, the stream ends (finish: tool-calls),
  the BROWSER executes the tool against the real page, and the client opens
  the next stream with the results. The server never touches the page.
- Tool results come back as plain user-turn content (not echoed assistant
  tool_calls) — same Gemini thought-signature workaround the tutor uses.

Events yielded (SSE-framed by main.py):
  {"type": "status", "text"}            transient phase text
  {"type": "narration-delta", "delta"}  EUNA's streamed speech
  {"type": "tool", "explain", "commands", "toolCallId"}
  {"type": "lookup-request", "query", "params", "requestId"}
  {"type": "finish", "reason"}          stop | tool-calls | error
  {"type": "error", "message"}
"""

import json
import os

from openai import OpenAI

from config.models import GEN_CONTENT_MODEL, PILOT_MODEL, RIVER_BASE_URL
from config.pilot_capabilities import (
    HISTORY_TURNS,
    MAX_HISTORY_MSG_CHARS,
    MAX_SNAPSHOT_CHARS,
    PILOT_TOOLS,
    build_system_prompt,
)
from utils.ai_client_pool import AIClientPool


def _clip(text, limit, label=None):
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    if label:
        print(f"[PILOT] {label} clipped {len(text)} -> {limit} chars")
    return text[:limit] + "\n…(truncated)"


def _coerce_commands(raw):
    """Normalize the model's command list; tolerate a single 'command' key."""
    if isinstance(raw, dict):  # model put fields at the top level
        raw = [raw]
    if not isinstance(raw, list):
        return []

    commands = []
    for item in raw:
        if isinstance(item, str):  # shorthand "click 17" / "goto /dashboard/…"
            parts = item.strip().split(None, 1)
            cmd = {"action": parts[0].lower()}
            if len(parts) > 1:
                rest = parts[1].strip()
                if cmd["action"] == "goto":
                    cmd["path"] = rest
                elif rest.isdigit():
                    cmd["ref"] = int(rest)
                else:
                    cmd["value"] = rest
            commands.append(cmd)
            continue
        if not isinstance(item, dict):
            continue
        action = str(item.get("action", "")).strip().lower()
        if not action:
            continue
        cmd = {"action": action}
        if item.get("ref") is not None:
            try:
                cmd["ref"] = int(item["ref"])
            except (TypeError, ValueError):
                pass
        if item.get("path"):
            cmd["path"] = str(item["path"])
        if item.get("value") is not None:
            cmd["value"] = str(item["value"])
        if item.get("direction") in ("up", "down"):
            cmd["direction"] = item["direction"]
        if item.get("risk") in ("read", "mutate", "dangerous"):
            cmd["risk"] = item["risk"]
        commands.append(cmd)
    return commands


KNOWN_TOOL_NAMES = ("invoke_client", "request_data")


def _split_concat_json(raw):
    """Split '{"a":1}{"b":2}' into [{'a':1},{'b':2}] — Gemini's OpenAI-compat
    stream can merge parallel tool calls into one slot, concatenating args."""
    decoder = json.JSONDecoder()
    parts = []
    idx = 0
    raw = (raw or "").strip()
    while idx < len(raw):
        while idx < len(raw) and raw[idx] in " \n\r\t":
            idx += 1
        if idx >= len(raw):
            break
        try:
            obj, end = decoder.raw_decode(raw, idx)
        except json.JSONDecodeError:
            return []
        parts.append(obj)
        idx = end
    return parts


def _salvage_merged_slot(name, raw_args):
    """Detect a slot where N parallel calls were merged (name repeated, args
    concatenated) and reduce it to the FIRST call so the run keeps moving."""
    for tool in KNOWN_TOOL_NAMES:
        if name.startswith(tool) and len(name) > len(tool):
            parts = _split_concat_json(raw_args)
            if parts and isinstance(parts[0], dict):
                print(f"[PILOT] salvaged merged parallel tool calls ({len(parts)}x {tool}) — keeping the first")
                return tool, json.dumps(parts[0], ensure_ascii=False)
    return None


def _parse_tool_args(name, raw_args):
    try:
        args = json.loads(raw_args or "{}")
        if not isinstance(args, dict):
            args = {}
    except json.JSONDecodeError:
        print(f"[PILOT] unparseable tool args for {name}: {raw_args[:200]!r}")
        args = {}

    if name == "invoke_client":
        commands = _coerce_commands(args.get("commands") or args.get("command"))
        return {"explain": str(args.get("explain") or "On it."), "commands": commands}
    if name == "request_data":
        params = args.get("params") or {}
        return {
            "query": str(args.get("query") or ""),
            "params": params if isinstance(params, dict) else {},
        }
    return args


def _trail_block(data: dict) -> str:
    trail = (data.get("recent_calls") or [])[-10:]
    if not trail:
        return ""
    lines = "\n".join(f"- {t}" for t in trail)
    return (
        "\nRECENT ACTIONS & FINDINGS THIS RUN (the facts below are yours to "
        "reuse — never repeat a lookup that's already listed):\n"
        f"{lines}\n"
    )


def _build_turn_content(payload: dict) -> str:
    """The user-role content for this turn, by kind."""
    kind = payload.get("kind", "start")
    route = payload.get("route") or "/"
    snapshot = _clip(payload.get("snapshot"), MAX_SNAPSHOT_CHARS, "snapshot")
    classes = payload.get("classes") or []
    consent_note = "consent already granted this run" if payload.get("consent") else "no consent yet this run"

    classes_block = ""
    if classes:
        listed = ", ".join(f"{c.get('name')} (id {c.get('id')})" for c in classes[:12])
        classes_block = f"\nTEACHER'S CLASSES: {listed}"

    if kind == "start":
        task = _clip(payload.get("task"), 2000, "task")
        return (
            f"CURRENT PAGE: {route}{classes_block}\n"
            f"CONSENT STATE: {consent_note}\n\n"
            f"PAGE ELEMENTS (address by [ref]):\n{snapshot}\n\n"
            f"TEACHER REQUEST: {task}\n"
            "(The earlier conversation is background context only. THIS "
            "request is the live question — ground your answer in data you "
            "fetch this turn, especially for stats that change: rankings, "
            "counts, scores, submissions.)"
        )

    if kind == "tool-result":
        data = payload.get("data") or {}
        results = data.get("results") or []
        lines = ["RESULTS of your last command batch:"] if results else []
        for r in results:
            status = "BLOCKED" if r.get("blocked") else ("ok" if r.get("ok") else "failed")
            lines.append(f"- {r.get('action')}" + (f" ref {r.get('ref')}" if r.get('ref') is not None else "") + f" → {status}: {r.get('message', '')}")
        # Restate the run's own task: server-side history can carry older
        # threads, and 'continue' must never mean 'finish an earlier ask'
        task = _clip(payload.get("task"), 500)
        task_line = f"\nCURRENT TASK: {task}\nWrap up THAT task — not anything earlier in history.\n" if task else ""
        nudge_line = (
            "NOTE: your last reply CLAIMED an action (\"I'm opening…\", "
            "\"I'll explain…\") but sent NO tool call and didn't deliver the "
            "words. Fix it NOW, in this reply: send the tool call (point/"
            "scroll/snapshot run freely; a goto or click lands at the "
            "teacher's approval gate — the gate asks, so don't ask in words "
            "too), OR actually deliver the explanation/answer you promised, "
            "OR ask the teacher a question. Never claim without doing. If "
            "the teacher's request already approved exactly this read-only "
            "action, send the tool call — do not re-ask.\n"
            if data.get("nudge")
            else ""
        )
        return (
            "\n".join(lines)
            + ("\n" if results else "")
            + f"{task_line}"
            + f"{nudge_line}"
            + _trail_block(data)
            + f"CURRENT PAGE: {data.get('route') or route}{classes_block}\n"
            f"CONSENT STATE: {consent_note}\n\n"
            f"PAGE ELEMENTS (address by [ref]):\n{snapshot}\n\n"
            "Continue the task. If it's done, give a short wrap-up answering the "
            "original request — no tool call needed."
        )

    if kind == "lookup-result":
        data = payload.get("data") or {}
        result = json.dumps(data.get("result"), ensure_ascii=False)[:4000]
        task = _clip(payload.get("task"), 500)
        task_line = f"CURRENT TASK: {task}\n" if task else ""
        repeat_line = (
            "NOTE: you already ran this EXACT lookup earlier this run — what "
            "follows is the same cached data. Do not call it again; use it.\n"
            if data.get("repeated")
            else ""
        )
        streak_line = (
            "SEVERAL lookups in a row have failed. Do NOT call request_data "
            "again this turn — ask the teacher a concrete clarifying question "
            "(which class? which student?) or answer from data you already "
            "have.\n"
            if data.get("failed_streak")
            else ""
        )
        raw_result = data.get("result")
        error_line = (
            "NOTE: this lookup FAILED (see the error above). It never ran — "
            "never claim you searched or checked anything. Say what you "
            "couldn't check and ask for the missing detail (e.g. which "
            "class), or offer to check each class one by one.\n"
            if isinstance(raw_result, dict) and "error" in raw_result
            else ""
        )
        return (
            f"DATA for {data.get('query')} (params: {json.dumps(data.get('params') or {})}) "
            f"returned:\n{result}\n\n"
            f"{task_line}"
            f"{repeat_line}"
            f"{streak_line}"
            f"{error_line}"
            f"{_trail_block(data)}"
            f"CURRENT PAGE: {data.get('route') or route}{classes_block}\n"
            f"CONSENT STATE: {consent_note}\n\n"
            "This is tool data, NOT a new teacher message. Respond to CURRENT TASK "
            "with it: if the data answers the question, answer; if it only partly "
            "answers or can't (e.g. it has no failing-student data), say what you "
            "DO know, be honest about the gap, and offer the closest next step. "
            "NEVER greet, never say the message was empty or didn't come through."
        )

    return f"CURRENT PAGE: {route}\n\n{json.dumps(payload.get('data') or {}, ensure_ascii=False)[:2000]}"


class PilotService:
    def __init__(self):
        self.ai_pool = AIClientPool()
        self._system_prompt = build_system_prompt()
        # The pilot is a conversational agent, not a content pump — it gets
        # its own model (DeepSeek via River) and its own bill. The Gemini
        # pool stays as the fallback when River is unavailable.
        river_key = os.getenv("RIVER_API_KEY")
        self._river = (
            OpenAI(api_key=river_key, base_url=RIVER_BASE_URL, timeout=120, max_retries=1)
            if river_key else None
        )

    def _open_stream(self, messages):
        """River first; on any pre-stream failure fall back to the Gemini
        pool. Fallback only happens before the first chunk — a stream that
        dies mid-run surfaces its error to the teacher like normal."""
        if self._river is not None:
            try:
                return self._river.chat.completions.create(
                    model=PILOT_MODEL,
                    messages=messages,
                    tools=PILOT_TOOLS,
                    temperature=0.25,
                    max_tokens=1400,
                    stream=True,
                ), None
            except Exception as e:
                print(f"[Pilot] River unavailable ({type(e).__name__}: {str(e)[:160]}) — Gemini pool fallback")
        client, key_num = self.ai_pool.get_available_client()
        return client.chat.completions.create(
            model=GEN_CONTENT_MODEL,
            messages=messages,
            tools=PILOT_TOOLS,
            temperature=0.25,
            max_tokens=1400,
            stream=True,
        ), key_num

    def _build_messages(self, payload: dict) -> list:
        messages = [{"role": "system", "content": self._system_prompt}]

        # Persisted cross-run history (start turns only) — tool/lookup traffic
        # inside a run travels in the turn content, not the history
        for h in (payload.get("history") or [])[-HISTORY_TURNS:]:
            role = "assistant" if h.get("sender") == "ai" else "user"
            text = _clip(h.get("message"), MAX_HISTORY_MSG_CHARS)
            if text:
                messages.append({"role": role, "content": text})

        messages.append({"role": "user", "content": _build_turn_content(payload)})
        return messages

    def stream_turn(self, payload: dict):
        """One agent turn → generator of event dicts."""
        messages = self._build_messages(payload)

        tool_calls = {}
        finish_reason = None
        produced = False
        pool_key = None

        try:
            stream, pool_key = self._open_stream(messages)

            for chunk in stream:
                if not getattr(chunk, "choices", None):
                    continue
                choice = chunk.choices[0]
                delta = choice.delta

                if delta and delta.content:
                    if not produced:
                        produced = True
                        yield {"type": "status", "text": ""}
                    produced = True
                    yield {"type": "narration-delta", "delta": delta.content}

                if delta and getattr(delta, "tool_calls", None):
                    for tc in delta.tool_calls:
                        slot = tool_calls.setdefault(tc.index, {"id": "", "name": "", "args": ""})
                        if tc.id:
                            slot["id"] = tc.id
                        if tc.function:
                            if tc.function.name:
                                slot["name"] += tc.function.name
                            if tc.function.arguments:
                                slot["args"] += tc.function.arguments

                if choice.finish_reason:
                    finish_reason = choice.finish_reason

            if pool_key is not None:
                self.ai_pool.mark_success(pool_key)
        except Exception as e:
            if pool_key is not None:
                self.ai_pool.mark_rate_limited(pool_key, backoff_seconds=30)
            print(f"[Pilot Stream Error] {type(e).__name__}: {e}")
            yield {"type": "error", "message": "I hit a snag talking to my brain — try again in a moment."}
            yield {"type": "finish", "reason": "error"}
            return

        if tool_calls:
            emitted = False
            for idx in sorted(tool_calls):
                slot = tool_calls[idx]
                name = slot["name"]
                raw_args = slot["args"]
                # Parallel-call merges collapse into one mangled slot —
                # reduce to a single well-formed call instead of failing
                salvaged = _salvage_merged_slot(name, raw_args)
                if salvaged:
                    name, raw_args = salvaged
                parsed = _parse_tool_args(name, raw_args)
                if emitted:
                    # One tool event per turn — the client acts on one batch;
                    # the trail tells the model to continue with the rest
                    print(f"[PILOT] dropped extra tool call in same turn: {name}")
                    continue
                if name == "invoke_client":
                    if not parsed["commands"]:
                        continue
                    emitted = True
                    yield {
                        "type": "tool",
                        "toolCallId": slot["id"] or f"call_{idx}",
                        "explain": parsed["explain"],
                        "commands": parsed["commands"],
                    }
                elif name == "request_data" and parsed["query"]:
                    emitted = True
                    yield {
                        "type": "lookup-request",
                        "requestId": slot["id"] or f"lookup_{idx}",
                        "query": parsed["query"],
                        "params": parsed["params"],
                    }

            if emitted:
                yield {"type": "finish", "reason": "tool-calls"}
            else:
                # The model meant to act but produced garbage — say so honestly
                yield {"type": "error", "message": "I couldn't form that action — rephrase and I'll try again."}
                yield {"type": "finish", "reason": "error"}
            return

        yield {"type": "finish", "reason": "stop"}


pilot_service = PilotService()
