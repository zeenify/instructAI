"""
Stage 2: Section Content Generation Service
Generates detailed content for each section from Stage 1 outline
"""
import json
import asyncio
from groq import Groq
from prompts.stage2_content_prompts import get_section_content_system_prompt, build_section_content_prompt
from utils.logger import log_api_request, log_api_response, log_error


async def generate_section_content(
    client: Groq,
    curriculum_context: str,
    module_title: str,
    lesson_title: str,
    section: dict,
    difficulty: str,
    content_depth: str = "standard",
    writing_style: str = "conversational",
    fallback_client: Groq = None,
    previous_sections: list = None
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

    Returns:
        Dictionary with section content
    """
    section_title = section['title']
    section_type = section['type']
    section_focus = section['focus']

    system_prompt = get_section_content_system_prompt(section_type, writing_style, content_depth, curriculum_context)
    user_prompt = build_section_content_prompt(
        curriculum_context=curriculum_context,
        module_title=module_title,
        lesson_title=lesson_title,
        section_title=section_title,
        section_type=section_type,
        section_focus=section_focus,
        difficulty=difficulty,
        previous_sections=previous_sections or []
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        # Log the request
        log_api_request(
            endpoint=f"stage2-content-{section_type}-{section_title[:30]}",
            messages=messages,
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"},
            temperature=0.7
        )

        response = client.chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"},
            temperature=0.7
        )

        raw_response = response.choices[0].message.content

        # Log the response
        log_api_response(
            endpoint=f"stage2-content-{section_type}-{section_title[:30]}",
            response_content=raw_response,
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
        # Try fallback client on rate limit error
        error_str = str(e).lower()
        if "rate_limit" in error_str and fallback_client:
            print(f"[FALLBACK] Rate limit hit, switching to API key 2 for {section_title[:30]}")
            try:
                response = fallback_client.chat.completions.create(
                    messages=messages,
                    model="llama-3.3-70b-versatile",
                    response_format={"type": "json_object"},
                    temperature=0.7
                )
                raw_response = response.choices[0].message.content
                content_data = json.loads(raw_response)
                content_data['section_title'] = section_title
                content_data['section_type'] = section_type
                await asyncio.sleep(0.8)
                return content_data
            except Exception as fallback_error:
                if "rate_limit" in str(fallback_error).lower():
                    print(f"[ERROR] Both API keys exhausted for {section_title[:30]}")
                    # Return error that will be caught upstream
                    return {
                        "section_title": section_title,
                        "section_type": section_type,
                        "content_type": section_type,
                        "error": "Rate limit reached on both API keys. Please wait a few minutes.",
                        "fallback": True,
                        "rate_limit_error": True
                    }
                log_error(f"stage2-fallback-{section_type}-{section_title[:30]}", fallback_error)

        log_error(f"stage2-content-{section_type}-{section_title[:30]}", e)

        # Return fallback content
        error_message = "Rate limit reached. Please wait and try again." if "rate_limit" in error_str else str(e)
        return {
            "section_title": section_title,
            "section_type": section_type,
            "content_type": section_type,
            "error": error_message,
            "fallback": True,
            "rate_limit_error": "rate_limit" in error_str
        }


async def generate_all_section_contents(
    client: Groq,
    curriculum_context: str,
    module_title: str,
    lesson_title: str,
    sections: list,
    difficulty: str
) -> list:
    """
    Generate content for all sections in a lesson

    Args:
        client: Groq API client
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
            client=client,
            curriculum_context=curriculum_context,
            module_title=module_title,
            lesson_title=lesson_title,
            section=section,
            difficulty=difficulty
        )
        section_contents.append(content)

    return section_contents
