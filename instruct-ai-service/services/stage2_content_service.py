"""
Stage 2: Section Content Generation Service
Generates detailed content for each section from Stage 1 outline
"""
import json
import asyncio
from groq import Groq
from prompts.stage2_content_prompts import get_section_content_system_prompt, build_section_content_prompt
from utils.logger import log_api_request, log_api_response, log_error


def get_optimal_model(section_type: str) -> str:
    """
    Select model based on section type for cost optimization.
    Critical sections use 70b (quality), others use 8b (speed/cost).
    """
    critical_sections = ["concept", "tutorial"]
    if section_type in critical_sections:
        return "llama-3.3-70b-versatile"
    return "llama-3.1-8b-instant"


async def generate_section_content(
    groq_pool,
    curriculum_context: str,
    module_title: str,
    lesson_title: str,
    section: dict,
    difficulty: str,
    content_depth: str = "standard",
    writing_style: str = "conversational",
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

    system_prompt = get_section_content_system_prompt(section_type, writing_style, content_depth, curriculum_context)
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

    # Try to get a response, cycling through keys on rate limit
    response = None
    attempt_count = 0
    max_attempts = len(groq_pool.clients)
    key_num = None

    while attempt_count < max_attempts and not response:
        try:
            client, key_num = groq_pool.get_available_client()
            model_short = model.split('/')[-1] if '/' in model else model
            print(f"[STAGE2-CONTENT] Using API key {key_num}, model {model_short} (attempt {attempt_count + 1}/{max_attempts})")

            response = client.chat.completions.create(
                messages=messages,
                model=model,
                response_format={"type": "json_object"},
                temperature=0.7
            )

            groq_pool.mark_success(key_num)
            print(f"[STAGE2-CONTENT] Key {key_num} succeeded")

        except Exception as e:
            error_str = str(e).lower()
            if "rate_limit" in error_str:
                groq_pool.mark_rate_limited(key_num, backoff_seconds=60)
                print(f"[STAGE2-CONTENT] Key {key_num} rate-limited, trying next key...")
                attempt_count += 1
                if attempt_count < max_attempts:
                    await asyncio.sleep(0.3)  # Brief delay before retry
                    continue
                else:
                    print(f"[STAGE2-CONTENT] All {max_attempts} keys exhausted for {section_title[:30]}")
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

        content_data = json.loads(raw_response)

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
    groq_pool,
    curriculum_context: str,
    module_title: str,
    lesson_title: str,
    sections: list,
    difficulty: str
) -> list:
    """
    Generate content for all sections in a lesson

    Args:
        groq_pool: Groq client pool
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
            groq_pool=groq_pool,
            curriculum_context=curriculum_context,
            module_title=module_title,
            lesson_title=lesson_title,
            section=section,
            difficulty=difficulty
        )
        section_contents.append(content)

    return section_contents
