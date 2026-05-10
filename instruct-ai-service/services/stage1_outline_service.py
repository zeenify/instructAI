"""
Stage 1: Outline Generation Service
Generates structured outline for each lesson
"""
import json
from groq import Groq
from prompts.stage1_outline_prompts import get_outline_system_prompt, build_outline_prompt
from utils.logger import log_api_request, log_api_response, log_error


async def generate_lesson_outline(
    groq_pool,
    curriculum_context: str,
    module_title: str,
    lesson_title: str,
    difficulty: str,
    previous_lessons: list = None,
    is_coding: bool = True
) -> dict:
    """
    Generate outline for a single lesson

    Args:
        client: Groq API client
        curriculum_context: Full curriculum document
        module_title: Parent module title
        lesson_title: Target lesson title
        difficulty: Difficulty level
        previous_lessons: List of lesson summaries from earlier lessons (for context awareness)
        is_coding: Whether the course supports coding

    Returns:
        Dictionary with lesson outline
    """
    system_prompt = get_outline_system_prompt()
    user_prompt = build_outline_prompt(
        curriculum_context=curriculum_context,
        module_title=module_title,
        lesson_title=lesson_title,
        difficulty=difficulty,
        previous_lessons=previous_lessons,
        is_coding=is_coding  # Pass coding flag to prompt
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        import time as time_module
        start_time = time_module.time()

        log_api_request(
            endpoint=f"stage1-outline-{lesson_title}",
            messages=messages,
            model="llama-3.1-8b-instant"
        )

        client, key_num = groq_pool.get_available_client()
        print(f"[STAGE1-OUTLINE] Using API key {key_num}")

        response = client.chat.completions.create(
            messages=messages,
            model="llama-3.1-8b-instant",
            response_format={"type": "json_object"},
            temperature=0.5
        )

        groq_pool.mark_success(key_num)

        raw_response = response.choices[0].message.content

        # Log the response with timing
        duration_ms = (time_module.time() - start_time) * 1000
        log_api_response(
            endpoint=f"stage1-outline-{lesson_title}",
            response_content=raw_response,
            completion_tokens=len(raw_response) // 4,
            duration_ms=duration_ms,
            streaming=False
        )

        outline_data = json.loads(raw_response)
        return outline_data

    except Exception as e:
        import time as time_module
        duration_ms = (time_module.time() - start_time) * 1000 if 'start_time' in locals() else 0
        log_error(f"stage1-outline-{lesson_title}", e, duration_ms=duration_ms)
        # Return fallback outline
        return {
            "lesson_title": lesson_title,
            "estimated_duration": "15-20 minutes",
            "sections": [
                {
                    "title": "Introduction",
                    "type": "introduction",
                    "focus": "Overview of the topic",
                    "needs_code": False
                },
                {
                    "title": "Main Content",
                    "type": "concept",
                    "focus": "Core concepts and explanations",
                    "needs_code": True
                },
                {
                    "title": "Summary",
                    "type": "summary",
                    "focus": "Key takeaways",
                    "needs_code": False
                }
            ]
        }
