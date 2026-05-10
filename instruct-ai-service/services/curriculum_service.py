"""
Service for curriculum structure generation using Groq API
"""
import json
from groq import Groq
from schemas import CurriculumResponse
from prompts.curriculum_prompts import get_curriculum_system_prompt, build_curriculum_user_prompt
from utils.logger import log_api_request, log_api_response, log_error, print_metrics_summary


async def generate_curriculum_stream(
    groq_pool,
    context_text: str,
    prompt: str,
    difficulty: str,
    module_count: str,
    lessons_per_module: str,
    include_quiz: str,
    include_coding: str,
    pacing: str
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
        import time as time_module
        start_time = time_module.time()
        log_api_request(
            endpoint="generate-curriculum-stream",
            messages=messages,
            model="llama-3.3-70b-versatile"
        )

        # Send initial status
        yield f"data: {json.dumps({'type': 'status', 'message': 'Analyzing curriculum...'})}\n\n"

        # Try to get an available client from pool
        stream = None
        attempt_count = 0
        max_attempts = len(groq_pool.clients)
        import time as time_module

        while attempt_count < max_attempts and not stream:
            try:
                client, key_num = groq_pool.get_available_client()
                print(f"[CURRICULUM] Using API key {key_num}")
                stream = client.chat.completions.create(
                    messages=messages,
                    model="llama-3.3-70b-versatile",
                    response_format={"type": "json_object"},
                    stream=True
                )
                groq_pool.mark_success(key_num)
            except Exception as e:
                error_str = str(e).lower()
                if "rate_limit" in error_str:
                    groq_pool.mark_rate_limited(key_num, backoff_seconds=60)
                    attempt_count += 1
                    if attempt_count < max_attempts:
                        available_count = groq_pool.get_available_count()
                        if available_count > 0:
                            yield f"data: {json.dumps({'type': 'status', 'message': f'Key {key_num} rate-limited, trying another ({available_count} keys available)...'})}\n\n"
                        else:
                            print(f"[CURRICULUM] All keys rate-limited, waiting before retry...")
                            time_module.sleep(2)  # Wait before retrying a backed-off key
                            yield f"data: {json.dumps({'type': 'status', 'message': 'All keys temporarily rate-limited, retrying...'})}\n\n"
                    else:
                        print("[ERROR] All API keys exhausted")
                        yield f"data: {json.dumps({'type': 'error', 'message': 'All API keys rate-limited. Please wait and try again.'})}\n\n"
                        return
                else:
                    raise

        if not stream:
            yield f"data: {json.dumps({'type': 'error', 'message': 'No available API keys'})}\n\n"
            return

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

        # Log the complete response with timing
        duration_ms = (time_module.time() - start_time) * 1000
        log_api_response(
            endpoint="generate-curriculum-stream",
            response_content=accumulated,
            completion_tokens=len(accumulated) // 4,
            duration_ms=duration_ms,
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

        # Print metrics summary after completion
        print("\n")
        print_metrics_summary()

    except Exception as e:
        log_error("generate-curriculum-stream", e)
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        # Print metrics summary even on error
        print("\n")
        print_metrics_summary()


async def generate_curriculum_legacy(
    groq_pool,
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
        import time as time_module
        start_time = time_module.time()

        # Log the request
        log_api_request(
            endpoint="generate-curriculum",
            messages=messages,
            model="llama-3.3-70b-versatile"
        )

        client, key_num = groq_pool.get_available_client()
        print(f"[CURRICULUM-LEGACY] Using API key {key_num}")

        chat_completion = client.chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"}
        )

        groq_pool.mark_success(key_num)

        raw_output = chat_completion.choices[0].message.content

        # Log the response with timing
        duration_ms = (time_module.time() - start_time) * 1000
        log_api_response(
            endpoint="generate-curriculum",
            response_content=raw_output,
            completion_tokens=len(raw_output) // 4,
            duration_ms=duration_ms,
            streaming=False
        )

        parsed_json = json.loads(raw_output)
        safe_curriculum = CurriculumResponse(**parsed_json)

        return safe_curriculum.dict()

    except Exception as e:
        duration_ms = (time_module.time() - start_time) * 1000
        log_error("generate-curriculum", e, duration_ms=duration_ms)
        return {"new_modules": []}
