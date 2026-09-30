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

from config.models import GEN_CONTENT_MODEL
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
            f"TEACHER REQUEST: {task}"
        )

    if kind == "tool-result":
        data = payload.get("data") or {}
        lines = ["RESULTS of your last command batch:"]
        for r in data.get("results") or []:
            status = "BLOCKED" if r.get("blocked") else ("ok" if r.get("ok") else "failed")
            lines.append(f"- {r.get('action')}" + (f" ref {r.get('ref')}" if r.get("ref") is not None else "") + f" → {status}: {r.get('message', '')}")
        return (
            "\n".join(lines)
            + f"\n\nCURRENT PAGE: {data.get('route') or route}{classes_block}\n"
            f"CONSENT STATE: {consent_note}\n\n"
            f"PAGE ELEMENTS (address by [ref]):\n{snapshot}\n\n"
            "Continue the task. If it's done, give a short wrap-up answering the "
            "original request — no tool call needed."
        )

    if kind == "lookup-result":
        data = payload.get("data") or {}
        result = json.dumps(data.get("result"), ensure_ascii=False)[:4000]
        return (
            f"DATA for {data.get('query')} (params: {json.dumps(data.get('params') or {})}) "
            f"returned:\n{result}\n\n"
            f"CURRENT PAGE: {data.get('route') or route}{classes_block}\n"
            f"CONSENT STATE: {consent_note}\n\n"
            "Answer the teacher's question from this data. Offer to navigate to "
            "the relevant page if that's the natural next step."
        )

    return f"CURRENT PAGE: {route}\n\n{json.dumps(payload.get('data') or {}, ensure_ascii=False)[:2000]}"


class PilotService:
    def __init__(self):
        self.ai_pool = AIClientPool()
        self._system_prompt = build_system_prompt()

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
        """One Gemini streaming turn → generator of event dicts."""
        messages = self._build_messages(payload)
        client, key_num = self.ai_pool.get_available_client()

        tool_calls = {}
        finish_reason = None
        produced = False

        try:
            stream = client.chat.completions.create(
                model=GEN_CONTENT_MODEL,
                messages=messages,
                tools=PILOT_TOOLS,
                temperature=0.4,
                max_tokens=1400,
                stream=True,
            )

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

            self.ai_pool.mark_success(key_num)
        except Exception as e:
            self.ai_pool.mark_rate_limited(key_num, backoff_seconds=30)
            print(f"[Pilot Stream Error] {type(e).__name__}: {e}")
            yield {"type": "error", "message": "I hit a snag talking to my brain — try again in a moment."}
            yield {"type": "finish", "reason": "error"}
            return

        if tool_calls:
            emitted = False
            for idx in sorted(tool_calls):
                slot = tool_calls[idx]
                name = slot["name"]
                parsed = _parse_tool_args(name, slot["args"])
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
