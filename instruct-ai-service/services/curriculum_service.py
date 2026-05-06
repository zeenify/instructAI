"""
Service for curriculum structure generation using Groq API
"""
import json
from groq import Groq
from schemas import CurriculumResponse
from prompts.curriculum_prompts import get_curriculum_system_prompt, build_curriculum_user_prompt
from utils.logger import log_api_request, log_api_response, log_error


async def generate_curriculum_stream(
    client: Groq,
    context_text: str,
    prompt: str,
    difficulty: str,
    module_count: str,
    lessons_per_module: str,
    include_quiz: str,
    include_coding: str,
    pacing: str,
    fallback_client: Groq = None
):
    """
    Generate curriculum structure with streaming support

    Args:
        client: Groq API client
        context_text: Content from uploaded file or curriculum document
        prompt: User's curriculum generation instructions
        difficulty: Difficulty level
        module_count: Target number of modules
        lessons_per_module: Target lessons per module
        include_quiz: Whether to include quizzes
        include_coding: Whether to include coding exercises
        pacing: Course pacing

    Yields:
        Server-sent events with curriculum generation progress
    """
    try:
        system_prompt = get_curriculum_system_prompt()
        user_prompt = build_curriculum_user_prompt(
            context_text=context_text,
            prompt=prompt,
            difficulty=difficulty,
            module_count=module_count,
            lessons_per_module=lessons_per_module,
            include_quiz=include_quiz,
            include_coding=include_coding,
            pacing=pacing
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        # Log the request
        log_api_request(
            endpoint="generate-curriculum-stream",
            messages=messages,
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"},
            stream=True
        )

        # Send initial status
        yield f"data: {json.dumps({'type': 'status', 'message': 'Analyzing curriculum...'})}\n\n"

        # Try with primary client, fallback to secondary on rate limit
        active_client = client
        try:
            stream = client.chat.completions.create(
                messages=messages,
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"},
                stream=True
            )
        except Exception as e:
            error_str = str(e).lower()
            if "rate_limit" in error_str and fallback_client:
                print("[FALLBACK] Rate limit on curriculum generation, switching to API key 2")
                yield f"data: {json.dumps({'type': 'status', 'message': 'Switching to backup API key...'})}\n\n"
                active_client = fallback_client
                try:
                    stream = fallback_client.chat.completions.create(
                        messages=messages,
                        model="llama-3.3-70b-versatile",
                        response_format={"type": "json_object"},
                        stream=True
                    )
                except Exception as fallback_error:
                    if "rate_limit" in str(fallback_error).lower():
                        print("[ERROR] Both API keys hit rate limit")
                        yield f"data: {json.dumps({'type': 'error', 'message': 'Rate limit reached on both API keys. Please wait a few minutes and try again.'})}\n\n"
                        return
                    else:
                        raise fallback_error
            elif "rate_limit" in error_str and not fallback_client:
                print("[ERROR] Rate limit hit, no fallback available")
                yield f"data: {json.dumps({'type': 'error', 'message': 'Rate limit reached. Please wait a few minutes and try again.'})}\n\n"
                return
            else:
                raise

        accumulated = ""
        last_module_count = 0

        for chunk in stream:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                accumulated += content

                # Try to parse partial JSON to detect new modules
                try:
                    # Clean up partial JSON
                    test_json = accumulated
                    if not test_json.strip().endswith('}'):
                        test_json += ']}}' # Close JSON structure

                    parsed = json.loads(test_json)

                    if 'new_modules' in parsed:
                        current_count = len(parsed['new_modules'])

                        # New module detected!
                        if current_count > last_module_count:
                            new_module = parsed['new_modules'][-1]
                            yield f"data: {json.dumps({'type': 'module', 'data': new_module})}\n\n"
                            last_module_count = current_count
                except:
                    # Partial JSON not yet valid, continue accumulating
                    pass

        # Log the complete response
        log_api_response(
            endpoint="generate-curriculum-stream",
            response_content=accumulated,
            streaming=True
        )

        # Final validation and send complete result
        yield f"data: {json.dumps({'type': 'status', 'message': 'Finalizing curriculum...'})}\n\n"

        try:
            parsed_json = json.loads(accumulated)
            safe_curriculum = CurriculumResponse(**parsed_json)
            yield f"data: {json.dumps({'type': 'complete', 'data': safe_curriculum.dict()})}\n\n"
        except Exception as e:
            log_error("generate-curriculum-stream (validation)", e)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Failed to parse AI response'})}\n\n"

    except Exception as e:
        log_error("generate-curriculum-stream", e)
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


async def generate_curriculum_legacy(
    client: Groq,
    context_text: str,
    prompt: str
) -> dict:
    """
    Legacy non-streaming curriculum generation endpoint

    Args:
        client: Groq API client
        context_text: Content from uploaded file
        prompt: User's curriculum generation instructions

    Returns:
        Dictionary with curriculum structure
    """
    system_prompt = get_curriculum_system_prompt()

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"{context_text}\n\nUser Command: {prompt}"}
    ]

    try:
        # Log the request
        log_api_request(
            endpoint="generate-curriculum",
            messages=messages,
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"}
        )

        chat_completion = client.chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"}
        )

        raw_output = chat_completion.choices[0].message.content

        # Log the response
        log_api_response(
            endpoint="generate-curriculum",
            response_content=raw_output,
            streaming=False
        )

        parsed_json = json.loads(raw_output)
        safe_curriculum = CurriculumResponse(**parsed_json)

        return safe_curriculum.dict()

    except Exception as e:
        log_error("generate-curriculum", e)
        return {"new_modules": []}
