import json
import asyncio
from prompts.reviewer_prompts import FLASHCARD_PROMPT, CLOZE_PROMPT, PRACTICE_PROMPT, SUMMARY_PROMPT

COMPLEX_MODEL = "openai/gpt-oss-120b"
FAST_MODEL = "openai/gpt-oss-20b"

PROMPT_TEMPLATES = {
    "flashcards": (FLASHCARD_PROMPT, COMPLEX_MODEL, 3),
    "cloze": (CLOZE_PROMPT, FAST_MODEL, 2),
    "practice": (PRACTICE_PROMPT, COMPLEX_MODEL, 5),
    "summary": (SUMMARY_PROMPT, FAST_MODEL, 2),
}

DEFAULT_COUNTS = {
    "flashcards": 10,
    "cloze": 5,
    "practice": 5,
}


async def generate_reviewer_stream(groq_pool, lesson_content, lesson_title, reviewer_types, counts, difficulty):
    """
    Generate reviewer content for multiple types in parallel.
    Streams progress events via async generator.
    """
    total = len(reviewer_types)
    completed = 0
    tasks = {}

    # Launch all generation tasks concurrently
    for rtype in reviewer_types:
        template, model, _ = PROMPT_TEMPLATES.get(rtype, (None, COMPLEX_MODEL, 3))
        if template is None:
            continue

        count = counts.get(rtype, DEFAULT_COUNTS.get(rtype, 5))
        prompt = template.format(title=lesson_title, content=lesson_content, count=count)

        yield {"event": "progress", "data": json.dumps({"type": rtype, "status": "generating"})}

        task = asyncio.create_task(
            _call_groq(groq_pool, prompt, model, rtype)
        )
        tasks[rtype] = task

    # Collect results as they complete
    for rtype in reviewer_types:
        if rtype not in tasks:
            continue
        try:
            result = await tasks[rtype]
            items = _parse_result(result, rtype)
            completed += 1
            yield {
                "event": "chunk",
                "data": json.dumps({
                    "type": rtype,
                    "items": items,
                    "completed": completed,
                    "total": total,
                }),
            }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"type": rtype, "error": str(e)}),
            }

    yield {"event": "complete", "data": json.dumps({"status": "done"})}


async def _call_groq(groq_pool, prompt, model, rtype):
    """Make a single Groq API call with proper error handling."""
    loop = asyncio.get_event_loop()

    def _sync_call():
        client, key_num = groq_pool.get_available_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a world-class study material creator. Return ONLY valid JSON. No markdown, no code fences, no explanations."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=4096,
            response_format={"type": "json_object"},
        )
        groq_pool.mark_success(key_num)
        return response.choices[0].message.content

    return await loop.run_in_executor(None, _sync_call)


def _parse_result(content, rtype):
    """Parse the JSON response from Groq into structured items."""
    text = content.strip()
    # Remove markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON array/object within the text
        import re
        array_match = re.search(r'\[.*\]', text, re.DOTALL)
        obj_match = re.search(r'\{.*\}', text, re.DOTALL)
        if rtype == "summary" and obj_match:
            data = json.loads(obj_match.group())
        elif array_match:
            data = json.loads(array_match.group())
        else:
            raise

    if rtype == "summary":
        sections = data.get("sections", [])
        return sections
    elif isinstance(data, dict):
        # Sometimes the response wraps in a key like "flashcards" or "items"
        for key in ("flashcards", "cloze", "questions", "items", "results"):
            if key in data:
                return data[key]
        return list(data.values())[0] if data else []
    elif isinstance(data, list):
        return data
    return []
