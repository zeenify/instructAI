"""
Client for the instruct-execute engine (the same engine students run code on).

Used to VERIFY generated content before it reaches students: reference
solutions are executed against generated test cases, and lesson challenge
"expected output" is replaced with the real program output. This keeps bad AI
output (uncompilable code, wrong expected results) out of the platform.
"""
import os
import re
import time

import requests

ENGINE_URL = os.getenv("EXECUTION_ENGINE_URL", "http://localhost:3000")
EXECUTE_TIMEOUT_S = 45


def normalize_output(output: str) -> str:
    """
    Mirrors CodeRunner::normalizeOutput in the Laravel backend exactly:
    CRLF -> LF, trailing whitespace per line stripped, trailing blank
    lines removed. Grading compares normalized output on both sides.
    """
    if output is None:
        return ""
    output = output.replace("\r\n", "\n")
    lines = [line.rstrip() for line in output.split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def strip_markdown_fence(text: str) -> str:
    """Remove a leading/trailing ``` fence if the model wrapped code in one."""
    if not text:
        return text
    text = text.strip()
    match = re.match(r"^```[a-zA-Z0-9_+-]*\n(.*)\n```$", text, re.DOTALL)
    if match:
        return match.group(1)
    return text


def _execute_once(language: str, code: str, stdin: str = None) -> dict:
    try:
        response = requests.post(
            f"{ENGINE_URL}/execute",
            json={"language": language, "code": code, "input": stdin},
            timeout=EXECUTE_TIMEOUT_S,
        )
        if response.status_code == 503:
            return {"stdout": "", "stderr": "", "compile_output": "",
                    "timed_out": False, "engine_error": True, "error": response.json().get("error", "runtime missing")}
        if response.status_code == 429:
            return {"stdout": "", "stderr": "", "compile_output": "",
                    "timed_out": False, "engine_error": True, "error": "engine busy"}
        data = response.json()
        data.setdefault("stdout", "")
        data.setdefault("stderr", "")
        data.setdefault("compile_output", "")
        data.setdefault("timed_out", False)
        data["engine_error"] = False
        return data
    except Exception as e:
        return {"stdout": "", "stderr": "", "compile_output": "",
                "timed_out": False, "engine_error": True, "error": str(e)}


def execute_code(language: str, code: str, stdin: str = None) -> dict:
    """
    Run code on the execution engine. Always returns a dict with stdout,
    stderr, compile_output, timed_out, engine_error keys — engine_error marks
    infrastructure problems (engine down/busy) rather than bad student code.
    """
    run = _execute_once(language, code, stdin)
    if run.get("engine_error"):
        # The engine sleeps on Render's free tier — a cold container rejects
        # the first call in about a second while a boot takes 30-50s. Without
        # this retry, every challenge generated right after a quiet stretch
        # silently lost its verified test cases (and degraded to an ungraded
        # block). Runs inside a worker thread, so SSE heartbeats keep flowing
        # while we wait.
        time.sleep(25)
        run = _execute_once(language, code, stdin)
    return run


def verify_test_cases(language: str, reference_code: str, test_cases: list) -> list:
    """
    Execute the reference solution once per test case and return only the test
    cases whose expected output matches the actual normalized stdout. A test
    case is also dropped if its input is not a string.
    """
    kept = []
    for test_case in test_cases or []:
        if not isinstance(test_case, dict):
            continue
        expected = str(test_case.get("expected_output", "") or "")
        stdin = test_case.get("input") or None
        run = execute_code(language, reference_code, stdin)
        if run.get("engine_error") or run.get("timed_out"):
            # Infrastructure problem: keep nothing — caller falls back to
            # expected-output grading rather than shipping unverified tests.
            return []
        if normalize_output(run["stdout"]) == normalize_output(expected):
            kept.append(test_case)
    return kept


def actual_output_for(language: str, code: str) -> str | None:
    """
    Run code with no stdin and return its normalized stdout, or None when the
    engine is unavailable / the program fails / it times out.
    """
    run = execute_code(language, code, None)
    if run.get("engine_error") or run.get("timed_out"):
        return None
    if normalize_output(run["stderr"]) and not run["stdout"]:
        return None
    return normalize_output(run["stdout"])
