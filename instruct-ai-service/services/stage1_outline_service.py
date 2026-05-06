"""
Stage 1: Outline Generation Service
Generates structured outline for each lesson
"""
import json
from groq import Groq
from prompts.stage1_outline_prompts import get_outline_system_prompt, build_outline_prompt
from utils.logger import log_api_request, log_api_response, log_error


async def generate_lesson_outline(
    client: Groq,
    curriculum_context: str,
    module_title: str,
    lesson_title: str,
    difficulty: str
) -> dict:
    """
    Generate outline for a single lesson

    Args:
        client: Groq API client
        curriculum_context: Full curriculum document
        module_title: Parent module title
        lesson_title: Target lesson title
        difficulty: Difficulty level

    Returns:
        Dictionary with lesson outline
    """
    system_prompt = get_outline_system_prompt()
    user_prompt = build_outline_prompt(
        curriculum_context=curriculum_context,
        module_title=module_title,
        lesson_title=lesson_title,
        difficulty=difficulty
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        # Use cheaper 8B model for outlines - saves 80% tokens, still excellent for structured planning
        # Stage 1 doesn't need 70B intelligence, just good structure
        log_api_request(
            endpoint=f"stage1-outline-{lesson_title}",
            messages=messages,
            model="llama-3.1-8b-instant",
            response_format={"type": "json_object"},
            temperature=0.5  # Lower temperature for structured planning
        )

        response = client.chat.completions.create(
            messages=messages,
            model="llama-3.1-8b-instant",  # TPD: 500K vs 100K for 70B
            response_format={"type": "json_object"},
            temperature=0.5
        )

        raw_response = response.choices[0].message.content

        # Log the response
        log_api_response(
            endpoint=f"stage1-outline-{lesson_title}",
            response_content=raw_response,
            streaming=False
        )

        outline_data = json.loads(raw_response)
        return outline_data

    except Exception as e:
        log_error(f"stage1-outline-{lesson_title}", e)
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
