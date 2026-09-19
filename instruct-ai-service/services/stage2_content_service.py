"""
Stage 2: Section Content Generation Service
Generates detailed content for each section from Stage 1 outline
"""
import json
from config.gen_schemas import section_format
from config.models import GEN_CONTENT_MODEL
from utils.ai_client_pool import is_rate_limit_error
import asyncio
from prompts.stage2_content_prompts import get_section_content_system_prompt, build_section_content_prompt, is_programming_context
from utils.logger import log_api_request, log_api_response, log_error


def get_optimal_model(section_type: str) -> str:
    """
    Select model based on section type for cost optimization.
    Critical sections use 70b (quality), others use 8b (speed/cost).
    """
    critical_sections = ["concept", "tutorial"]
    if section_type in critical_sections:
        return GEN_CONTENT_MODEL
    return GEN_CONTENT_MODEL


async def generate_section_content(
    ai_pool,
    curriculum_context: str,
    module_title: str,
    lesson_title: str,
    section: dict,
    difficulty: str,
    content_depth: str = "standard",
    writing_style: str = "conversational",
    language_lock: str = "",
    previous_sections: list = None,
    previous_lessons: list = None,
    is_coding: bool = True
) -> dict:
    """
    Generate detailed content for a single section

    Args:
        client: Groq API client
        curriculum_context: Full curriculum document
        module_title: Parent module
        lesson_title: Parent lesson
        section: Section dict from Stage 1 (title, type, focus, needs_code)
        difficulty: Difficulty level
        content_depth: How detailed the content should be
        writing_style: Tone of the writing
        previous_sections: Sections already covered in this lesson
        previous_lessons: Lessons already covered in this module (for cross-lesson context)

    Returns:
        Dictionary with section content
    """
    section_title = section['title']
    section_type = section['type']
    section_focus = section['focus']

    # Override needs_code based on course setting - if course is not coding, disable code regardless of section type
    needs_code = section.get('needs_code', False) and is_coding

    # A course explicitly flagged as coding stays programming even when no
    # curriculum document was uploaded (the keyword check alone would see "").
    is_programming = is_coding or is_programming_context(curriculum_context)

    system_prompt = get_section_content_system_prompt(section_type, writing_style, content_depth, curriculum_context, is_programming)
    user_prompt = build_section_content_prompt(
        curriculum_context=curriculum_context,
        module_title=module_title,
        lesson_title=lesson_title,
        section_title=section_title,
        section_type=section_type,
        section_focus=section_focus,
        difficulty=difficulty,
        previous_sections=previous_sections or [],
        previous_lessons=previous_lessons or [],
        needs_code=needs_code  # Pass the enforced flag
    )

    # The course language is a HARD requirement — every code block in the
    # section must be this language, whatever the section prompt defaults to
    if language_lock and needs_code:
        user_prompt += (
            "\n\nLANGUAGE REQUIREMENT (override everything else): every code "
            "example, starter code, reference solution, and test case in this "
            f"section MUST be written in {language_lock}. Do not use any other "
            "programming language."
        )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    # Determine optimal model for this section type
    model = get_optimal_model(section_type)
    import time as time_module
    start_time = time_module.time()

    # Log the request
    log_api_request(
        endpoint=f"stage2-content-{section_type}-{section_title[:30]}",
        messages=messages,
        model=model
    )

    # Try to get a response, cycling through keys on rate limit. When EVERY
    # key is cooling down, wait for recovery instead of killing the lesson —
    # a 429 storm must cost the teacher a pause, not the whole run.
    response = None
    attempt_count = 0
    cool_downs = 0
    max_attempts = max(len(ai_pool.clients) * 3, 3)
    key_num = None

    while attempt_count < max_attempts and not response:
        try:
            client, key_num = ai_pool.get_available_client()
            model_short = model.split('/')[-1] if '/' in model else model
            print(f"[STAGE2-CONTENT] Using API key {key_num}, model {model_short} (attempt {attempt_count + 1}/{max_attempts})")

            response = client.chat.completions.create(
                messages=messages,
                model=model,
                response_format=section_format(section_type, is_programming),
                temperature=0.7
            )

            ai_pool.mark_success(key_num)
            print(f"[STAGE2-CONTENT] Key {key_num} succeeded")

        except Exception as e:
            error_str = str(e).lower()
            if is_rate_limit_error(e):
                ai_pool.mark_rate_limited(key_num, backoff_seconds=60)
                attempt_count += 1
                if ai_pool.all_rate_limited() and cool_downs < 2:
                    wait_s = ai_pool.recovery_wait_seconds() or 60
                    cool_downs += 1
                    print(f"[STAGE2-CONTENT] All keys cooling down — waiting {wait_s:.0f}s (round {cool_downs}/2) for {section_title[:30]}")
                    await asyncio.sleep(wait_s)
                    continue
                if attempt_count < max_attempts:
                    await asyncio.sleep(0.3)  # Brief delay before retry
                    continue
                else:
                    print(f"[STAGE2-CONTENT] All {max_attempts} attempts exhausted for {section_title[:30]}")
                    duration_ms = (time_module.time() - start_time) * 1000
                    log_error(f"stage2-content-all-keys-exhausted-{section_type}-{section_title[:30]}", e, duration_ms=duration_ms)
                    return {
                        "section_title": section_title,
                        "section_type": section_type,
                        "content_type": section_type,
                        "error": "All API keys rate-limited. Please wait and try again.",
                        "fallback": True,
                        "rate_limit_error": True
                    }
            else:
                # Non-rate-limit error, don't retry
                duration_ms = (time_module.time() - start_time) * 1000
                log_error(f"stage2-content-{section_type}-{section_title[:30]}", e, duration_ms=duration_ms)
                return {
                    "section_title": section_title,
                    "section_type": section_type,
                    "content_type": section_type,
                    "error": str(e),
                    "fallback": True,
                    "rate_limit_error": False
                }

    if not response:
        duration_ms = (time_module.time() - start_time) * 1000
        log_error(f"stage2-content-no-response-{section_type}-{section_title[:30]}", Exception("No response received"), duration_ms=duration_ms)
        return {
            "section_title": section_title,
            "section_type": section_type,
            "content_type": section_type,
            "error": "Failed to get response from API",
            "fallback": True,
            "rate_limit_error": False
        }

    try:
        raw_response = response.choices[0].message.content

        # Log the response with timing
        duration_ms = (time_module.time() - start_time) * 1000
        log_api_response(
            endpoint=f"stage2-content-{section_type}-{section_title[:30]}",
            response_content=raw_response,
            completion_tokens=len(raw_response) // 4,
            duration_ms=duration_ms,
            streaming=False
        )

        content_data = json.loads(raw_response, strict=False)

        # Add metadata
        content_data['section_title'] = section_title
        content_data['section_type'] = section_type

        # Add rate limit delay to avoid hitting TPM (12K tokens/min)
        # With ~2K tokens per section, delay prevents bursts
        await asyncio.sleep(0.8)  # Spreads 6 sections over ~5 seconds

        return content_data

    except Exception as e:
        duration_ms = (time_module.time() - start_time) * 1000
        log_error(f"stage2-content-parse-{section_type}-{section_title[:30]}", e, duration_ms=duration_ms)
        return {
            "section_title": section_title,
            "section_type": section_type,
            "content_type": section_type,
            "error": f"Failed to parse response: {str(e)}",
            "fallback": True,
            "rate_limit_error": False
        }


async def generate_all_section_contents(
    ai_pool,
    curriculum_context: str,
    module_title: str,
    lesson_title: str,
    sections: list,
    difficulty: str
) -> list:
    """
    Generate content for all sections in a lesson

    Args:
        ai_pool: Groq client pool
        curriculum_context: Full curriculum document
        module_title: Parent module
        lesson_title: Parent lesson
        sections: List of section dicts from Stage 1
        difficulty: Difficulty level

    Returns:
        List of section content dicts
    """
    section_contents = []

    for section in sections:
        content = await generate_section_content(
            ai_pool=ai_pool,
            curriculum_context=curriculum_context,
            module_title=module_title,
            lesson_title=lesson_title,
            section=section,
            difficulty=difficulty
        )
        section_contents.append(content)

    return section_contents
