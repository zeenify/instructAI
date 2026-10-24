"""
Service for lesson and quiz content generation using Groq API
Multi-stage pipeline for high-quality lesson generation
"""
import json
import asyncio
from config.gen_schemas import QUIZ_FORMAT
from config.models import GEN_CONTENT_MODEL
from utils.ai_client_pool import is_rate_limit_error
import time
from prompts.content_prompts import get_content_system_prompt, get_quiz_system_prompt, build_lesson_prompt, build_quiz_prompt
from services.stage1_outline_service import generate_lesson_outline
from services.stage2_content_service import generate_all_section_contents
from services.stage3_formatter_service import format_all_sections_to_lesson
from utils.logger import log_api_request, log_api_response, log_error, print_metrics_summary
from utils.code_formatter import fix_json_escapes_in_code
from utils.engine_client import verify_test_cases_status, actual_output_for, strip_markdown_fence, execute_code

# Languages the InstructAI IDE understands end to end (mirrors CodeRunner::LANGUAGES).
VALID_LANGUAGES = {"java", "python", "javascript", "cpp", "html"}


def normalize_language(value):
    """Normalize an AI-provided language id to one the IDE knows, else None."""
    if not isinstance(value, str):
        return None
    lang = value.strip().lower()
    if lang == "c++":
        lang = "cpp"
    return lang if lang in VALID_LANGUAGES else None


def harden_coding_questions(quiz_data: dict, language_lock: str = "") -> None:
    """
    Prepare generated coding questions for the platform's test-case grading
    engine, in place:

    - normalize/keep "language" (None -> backend grades as java)
    - unwrap markdown fences from boilerplate/reference_solution
    - EXECUTE reference_solution on the engine against every test case and
      keep only passing ones
    - when verified, rewrite expected_output to the reference's real no-input
      output (or, for interactive programs, the first verified case's output)
      so students and graders agree on the same target
    - html questions carry no tests/reference (checked visually)

    An UNVERIFIABLE question — the reference fails every case, or there is no
    reference/tests to verify at all — is DROPPED while the engine is
    reachable: shipping a coding question the grader can't check (e.g. a GUI
    program that cannot run headless) silently zeroes students. Only a
    genuinely unreachable engine keeps the question with expected-output
    grading as the legacy fallback.
    """
    kept_questions = []
    engine_probed = False
    engine_reachable = True

    for question in quiz_data.get("coding", []) or []:
        if not isinstance(question, dict):
            continue

        language = normalize_language(question.get("language"))
        # The course's language is a hard setting — force the tag so grading
        # and the student IDE always agree with what the teacher picked
        if language_lock and language_lock in ("java", "python", "javascript", "cpp", "html"):
            language = language_lock
        question["language"] = language
        question["boilerplate"] = strip_markdown_fence(
            fix_json_escapes_in_code(str(question.get("boilerplate") or "")))

        reference = strip_markdown_fence(
            fix_json_escapes_in_code(str(question.get("reference_solution") or "")))
        if reference:
            question["reference_solution"] = reference

        tests = question.get("test_cases")
        tests = [t for t in (tests if isinstance(tests, list) else [])
                 if isinstance(t, dict) and str(t.get("expected_output", "") or "")][:5]

        # Drop vacuous duplicates: identical input+expected pairs test nothing
        seen = set()
        unique_tests = []
        for t in tests:
            signature = (str(t.get("input", "")), str(t.get("expected_output", "")))
            if signature not in seen:
                seen.add(signature)
                unique_tests.append(t)
        tests = unique_tests

        if language in (None, "html"):
            question.pop("test_cases", None)
            kept_questions.append(question)
            continue

        if reference and tests:
            kept, engine_reachable_now = verify_test_cases_status(language, reference, tests)
            if kept:
                question["test_cases"] = kept
                actual = actual_output_for(language, reference)
                if actual is not None:
                    question["expected_output"] = actual
                else:
                    # Interactive references crash on the no-input run — the
                    # first verified case's output is the honest target then.
                    question["expected_output"] = str(kept[0].get("expected_output", "") or "")
                print(f"[QUIZ-HARDEN] kept {len(kept)}/{len(tests)} verified test cases")
                kept_questions.append(question)
                continue
            if not engine_reachable_now:
                print(f"[QUIZ-HARDEN] engine unreachable — keeping question with "
                      f"expected-output fallback")
                question.pop("test_cases", None)
                kept_questions.append(question)
                continue
            print(f"[QUIZ-HARDEN] reference failed every test case — dropping question: "
                  f"{str(question.get('question_text', ''))[:70]}")
            continue

        # No reference or no tests: nothing to verify against. Drop it when we
        # know the engine is up; keep the legacy fallback only during outages.
        if not engine_probed:
            probe = execute_code("python", "print(1)")
            engine_reachable = not probe.get("engine_error")
            engine_probed = True
        if engine_reachable:
            print(f"[QUIZ-HARDEN] no reference/tests to verify — dropping question: "
                  f"{str(question.get('question_text', ''))[:70]}")
            continue
        question.pop("test_cases", None)
        kept_questions.append(question)

    quiz_data["coding"] = kept_questions


def _normalize_coding_statement(text) -> str:
    """Lowercase, alphanumeric-only restatement of a coding task."""
    cleaned = "".join(ch if ch.isalnum() else " " for ch in str(text or "").lower())
    return " ".join(cleaned.split())


def _is_duplicate_coding_statement(a: str, b: str) -> bool:
    """
    True when two normalized coding statements are the same task — an exact
    match, or a near match (>= 0.8 token overlap), which catches restatements
    like swapped word order or a dropped clause.
    """
    if not a or not b:
        return False
    if a == b:
        return True
    ta, tb = set(a.split()), set(b.split())
    if not ta or not tb:
        return False
    return len(ta & tb) / len(ta | tb) >= 0.8


HEARTBEAT_INTERVAL_S = 12


def _rss_mb():
    """Resident memory in MB (Linux /proc) — surfaces OOM pressure in the SSE
    heartbeat trail so a mid-generation kill is attributable."""
    try:
        with open('/proc/self/status') as f:
            for line in f:
                if line.startswith('VmRSS:'):
                    return f"{int(line.split()[1]) // 1024}MB"
    except Exception:
        pass
    return '?'


async def run_with_heartbeat(fn, *args, **kwargs):
    """
    Run blocking pipeline work in a worker thread while the async generator
    yields SSE comment heartbeats. Long silent phases (quiz LLM calls, engine
    verification of generated tests) otherwise exceed proxy idle timeouts
    (nginx fastcgi_read_timeout) and kill the stream mid-generation with
    ERR_INCOMPLETE_CHUNKED_ENCODING in the browser.

    Yields {'heartbeat': True, 'rss': <mem>} while waiting, then {'result': <return value>}.
    """
    def _call():
        result = fn(*args, **kwargs)
        if asyncio.iscoroutine(result):
            # async pipeline steps (outline/section services) get their own
            # event loop in the worker thread
            return asyncio.run(result)
        return result

    task = asyncio.create_task(asyncio.to_thread(_call))
    while True:
        done, _ = await asyncio.wait({task}, timeout=HEARTBEAT_INTERVAL_S)
        if done:
            return_data = task.result()
            yield {'result': return_data}
            return
        yield {'heartbeat': True, 'rss': _rss_mb()}


def extract_lesson_summary(formatted_lesson: dict, lesson_title: str, module_title: str) -> dict:
    """
    Extract lightweight summary from formatted lesson for context awareness.
    Used to avoid repetition across lessons in a module.

    Args:
        formatted_lesson: Complete lesson with blocks from Stage 3
        lesson_title: Title of the lesson
        module_title: Parent module title

    Returns:
        Compact summary dict (~200-300 tokens) with topics, videos, concepts
    """
    blocks = formatted_lesson.get('blocks', [])

    # Extract topics from h1 headings (main concepts covered)
    topics_covered = []
    for b in blocks:
        if b['type'] == 'h1':
            topics_covered.append(b['data']['text'])
    topics_covered = topics_covered[:5]  # Max 5 topics

    # Extract videos mentioned
    videos_used = []
    for b in blocks:
        if b['type'] == 'video':
            video_title = b['data'].get('title', '')
            if video_title and video_title not in videos_used:
                videos_used.append(video_title)
    videos_used = videos_used[:3]  # Max 3 videos

    # Extract concepts (same as topics but stored separately for clarity)
    concepts = []
    for b in blocks:
        if b['type'] == 'h2':  # Subheadings also count as concepts
            concepts.append(b['data']['text'])
    concepts = concepts[:5]  # Max 5 concepts

    return {
        'lesson_title': lesson_title,
        'topics_covered': topics_covered,
        'videos_used': videos_used,
        'concepts': concepts,
        'has_coding': formatted_lesson.get('has_code', False)
    }


def extract_quiz_summary(formatted_lesson: dict, lesson_title: str, difficulty: str) -> dict:
    """
    Extract compact summary from formatted lesson for quiz context.

    Args:
        formatted_lesson: Complete lesson with blocks from Stage 3
        lesson_title: Title of the lesson
        difficulty: Difficulty level

    Returns:
        Compact summary dict with concepts, code examples, and difficulty
    """
    blocks = formatted_lesson.get('blocks', [])

    # Extract concepts from h1 headings
    concepts = []
    for b in blocks:
        if b['type'] == 'h1':
            concepts.append(b['data']['text'])
    concepts = concepts[:5]  # Max 5 concepts

    # Extract code snippets (max 3 per lesson)
    code_examples = []
    for b in blocks:
        if b['type'] == 'code' and len(code_examples) < 3:
            code_examples.append({
                'mode': b['data'].get('mode', 'playground'),
                'code': b['data'].get('code', '')[:200],  # First 200 chars
                'has_expected_output': bool(b['data'].get('expected'))
            })

    return {
        'lesson_title': lesson_title,
        'concepts': concepts,
        'code_examples': code_examples,
        'has_coding': formatted_lesson.get('has_code', False),
        'difficulty': difficulty
    }


def parse_distribution(preset_or_custom: str) -> dict:
    """
    Convert preset name or custom string to distribution dict.

    Args:
        preset_or_custom: "balanced" | "coding_heavy" | "theory_focused" | "custom:40,20,20,10,10"

    Returns:
        Dict with mc, tf, id, enum, code percentages
    """
    presets = {
        "balanced": {"mc": 40, "tf": 20, "id": 20, "enum": 10, "code": 10},
        "coding_heavy": {"mc": 20, "tf": 10, "id": 10, "enum": 5, "code": 55},
        "theory_focused": {"mc": 50, "tf": 25, "id": 20, "enum": 5, "code": 0},
        "non_coding": {"mc": 40, "tf": 25, "id": 25, "enum": 10, "code": 0}
    }

    if preset_or_custom in presets:
        return presets[preset_or_custom]

    # Parse custom format: "custom:40,20,20,10,10"
    if preset_or_custom and preset_or_custom.startswith("custom:"):
        try:
            values = [int(v) for v in preset_or_custom.split(":")[1].split(",")]
            return {"mc": values[0], "tf": values[1], "id": values[2], "enum": values[3], "code": values[4]}
        except (ValueError, IndexError):
            return presets["balanced"]

    # Fallback to balanced
    return presets["balanced"]


async def generate_content_stream(
    ai_pool,
    curriculum_structure: list,
    curriculum_context: str,
    difficulty: str,
    content_depth: str,
    code_examples_per_lesson: str,
    writing_style: str,
    question_type_distribution: str,
    include_images: str,
    include_videos: str,
    is_coding: bool = False,
    language: str = ""
):
    """
    Generate full lesson and quiz content for approved curriculum structure

    Args:
        client: Groq API client
        curriculum_structure: List of modules with lesson/quiz IDs
        curriculum_context: Base curriculum document text
        difficulty: Difficulty level
        content_depth: Content depth setting
        code_examples_per_lesson: Number of code examples per lesson
        writing_style: Writing style preference
        question_type_distribution: Question type distribution preset or custom
        include_images: Whether to include images
        include_videos: Whether to include videos

    Yields:
        Server-sent events with content generation progress
    """
    try:
        system_prompt = get_content_system_prompt(
            difficulty=difficulty,
            content_depth=content_depth,
            code_examples_per_lesson=code_examples_per_lesson,
            writing_style=writing_style,
            include_images=include_images,
            include_videos=include_videos
        )

        yield f"data: {json.dumps({'type': 'status', 'message': 'Starting content generation...'})}\n\n"

        all_lessons = []
        all_quizzes = []
        all_lesson_summaries = []  # Collect summaries for quiz context
        # Coding-task statements already shipped in this run — later quizzes
        # get them as a do-not-repeat list, and anything that slips through
        # anyway is dropped here (the M2/M4 "positive/negative/zero" twin).
        used_coding_statements = []
        module_lesson_summaries = []  # Track summaries within current module for context awareness

        # Generate content for each module
        for module_idx, module in enumerate(curriculum_structure):
            module_title = module['title']
            module_lesson_summaries = []  # Reset for each module

            # ===== GENERATE LESSON CONTENT (3-STAGE PIPELINE) =====
            for lesson_idx, lesson in enumerate(module.get('lessons', [])):
                lesson_id = lesson.get('id')
                lesson_title = lesson.get('title')

                yield f"data: {json.dumps({'type': 'status', 'message': f'Planning: {lesson_title}'})}\n\n"

                try:
                    # STAGE 1: Generate outline
                    yield f"data: {json.dumps({'type': 'status', 'message': f'📋 Planning outline: {lesson_title}'})}\n\n"

                    async for msg in run_with_heartbeat(
                        generate_lesson_outline,
                        ai_pool=ai_pool,
                        curriculum_context=curriculum_context,
                        module_title=module_title,
                        lesson_title=lesson_title,
                        difficulty=difficulty,
                        previous_lessons=module_lesson_summaries,
                        is_coding=is_coding
                    ):
                        if 'result' in msg:
                            outline = msg['result']
                        else:
                            yield ': heartbeat rss=' + str(msg.get('rss', '?')) + chr(10) + chr(10)

                    sections = outline.get('sections', [])
                    yield f"data: {json.dumps({'type': 'status', 'message': f'✍️ Writing {len(sections)} sections: {lesson_title}'})}\n\n"

                    # STAGE 2: Generate content for each section (with progress updates and context)
                    section_contents = []
                    previous_sections = []  # Track what's already been covered

                    for idx, section in enumerate(sections, 1):
                        section_title = section.get('title', 'Section')
                        yield f"data: {json.dumps({'type': 'status', 'message': f'Section {idx}/{len(sections)}: {section_title}'})}\n\n"
                        time.sleep(0.1)  # Small delay to separate section start messages

                        from services.stage2_content_service import generate_section_content
                        async for msg in run_with_heartbeat(
                            generate_section_content,
                            ai_pool=ai_pool,
                            curriculum_context=curriculum_context,
                            module_title=module_title,
                            lesson_title=lesson_title,
                            section=section,
                            difficulty=difficulty,
                            content_depth=content_depth,
                            writing_style=writing_style,
                            language_lock=language,
                            previous_sections=previous_sections,  # Pass sections within this lesson
                            previous_lessons=module_lesson_summaries,  # Pass earlier lessons for cross-lesson context
                            is_coding=is_coding  # Override section's needs_code if is_coding is False
                        ):
                            if 'result' in msg:
                                content = msg['result']
                            else:
                                yield ': heartbeat rss=' + str(msg.get('rss', '?')) + chr(10) + chr(10)

                        # Check if rate limit was hit
                        if content.get('rate_limit_error'):
                            yield f"data: {json.dumps({'type': 'error', 'message': content.get('error', 'Rate limit reached')})}\n\n"
                            return

                        section_contents.append(content)

                        # Emit section_progress event so frontend can show real-time progress
                        yield f"data: {json.dumps({'type': 'section_complete', 'data': {'lesson_title': lesson_title, 'section_title': section_title, 'section_index': idx, 'total_sections': len(sections)}})}\n\n"

                        # Build content text from section data (supports multiple content types)
                        content_text = f'<h2 style="font-size: 1.5em; font-weight: bold; margin-bottom: 1em;">{section_title}</h2>\n'

                        # Extract content based on type
                        if content.get('definition'):
                            content_text += f'<p style="font-style: italic; margin-bottom: 1em;"><strong>Definition:</strong> {content.get("definition", "")}</p>\n'

                        if content.get('explanation'):
                            content_text += content.get('explanation', '') + '\n'

                        if content.get('why_it_matters'):
                            content_text += f'<p style="margin-bottom: 1em;"><strong>Why it matters:</strong> {content.get("why_it_matters", "")}</p>\n'

                        if content.get('steps'):
                            content_text += '<ol style="margin-bottom: 1em;">\n'
                            for step in content.get('steps', []):
                                content_text += f'<li style="margin-bottom: 0.5em;">{step}</li>\n'
                            content_text += '</ol>\n'

                        if content.get('key_points'):
                            content_text += '<div style="margin-bottom: 1em;"><strong>Key Points:</strong><ul style="margin-top: 0.5em;">\n'
                            for point in content.get('key_points', []):
                                content_text += f'<li style="margin-bottom: 0.3em;">{point}</li>\n'
                            content_text += '</ul></div>\n'

                        if content.get('real_world_example'):
                            content_text += f'<p style="margin-bottom: 1em;"><strong>Real-world example:</strong> {content.get("real_world_example", "")}</p>\n'

                        if content.get('content'):
                            content_text += content.get('content', '') + '\n'

                        # Emit section_preview with current section content
                        section_block = {
                            'type': 'text',
                            'data': {'text': content_text}
                        }
                        preview_event = {
                            'type': 'section_preview',
                            'data': {
                                'lesson_id': lesson_id,
                                'lesson_title': lesson_title,
                                'section_index': idx,
                                'total_sections': len(sections),
                                'section_block': section_block
                            }
                        }
                        yield f"data: {json.dumps(preview_event)}\n\n"
                        time.sleep(0.15)  # Delay between sections to make progress visible

                        # Add to context for next sections
                        previous_sections.append({
                            'title': section_title,
                            'type': section.get('type'),
                            'covered': True
                        })

                    yield f"data: {json.dumps({'type': 'status', 'message': f'🎨 Adding images and videos: {lesson_title}'})}\n\n"
                    time.sleep(0.2)  # Delay before Stage 3 to let UI catch up

                    # STAGE 3: Format to lesson blocks with real media
                    async for msg in run_with_heartbeat(
                        format_all_sections_to_lesson,
                        section_contents=section_contents,
                        lesson_title=lesson_title,
                        module_title=module_title,
                        include_images=(include_images.lower() == "true"),
                        include_videos=(include_videos.lower() == "true"),
                        previous_lesson_videos=module_lesson_summaries  # Pass previous lesson summaries for video deduplication
                    ):
                        if 'result' in msg:
                            formatted_lesson = msg['result']
                        else:
                            yield ': heartbeat rss=' + str(msg.get('rss', '?')) + chr(10) + chr(10)

                    lesson_content = {
                        "lesson_id": lesson_id,
                        "lesson_title": lesson_title,
                        "blocks": formatted_lesson.get('blocks', [])
                    }
                    all_lessons.append(lesson_content)

                    # Extract lightweight summary for context awareness (to avoid repetition in next lesson)
                    context_summary = extract_lesson_summary(
                        formatted_lesson=formatted_lesson,
                        lesson_title=lesson_title,
                        module_title=module_title
                    )
                    module_lesson_summaries.append(context_summary)

                    # Extract summary for quiz context (includes code examples)
                    quiz_summary = extract_quiz_summary(
                        formatted_lesson=formatted_lesson,
                        lesson_title=lesson_title,
                        difficulty=difficulty
                    )
                    all_lesson_summaries.append(quiz_summary)

                    yield f"data: {json.dumps({'type': 'lesson_complete', 'data': lesson_content})}\n\n"

                    # Add small delay so UI can animate
                    time.sleep(0.5)

                except Exception as e:
                    log_error(f"generate-lesson-{lesson_id}", e)
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Failed to generate {lesson_title}'})}\n\n"

            # ===== GENERATE QUIZ CONTENT =====
            for quiz_idx, quiz in enumerate(module.get('quizzes', [])):
                quiz_id = quiz.get('id')
                quiz_title = quiz.get('title')

                yield f"data: {json.dumps({'type': 'status', 'message': f'Generating: {quiz_title}'})}\n\n"
                time.sleep(0.1)  # Delay to separate quiz start messages

                # Auto-detect if course is programming-related. The endpoint's
                # is_coding flag is authoritative — on a continue-run the
                # in-session summaries are empty (lessons generated in an
                # earlier stream), so the derived flag alone blocks coding.
                is_programming_course = is_coding or any(
                    summary.get('has_coding', False)
                    for summary in all_lesson_summaries
                )

                # Parse distribution preset or custom format
                distribution = parse_distribution(question_type_distribution)
                coding_percentage = distribution.get('code', 0)

                # BLOCK coding questions for non-programming courses
                # Auto-switch to non_coding to prevent bad AI output
                if not is_programming_course and coding_percentage > 0:
                    original_preset = question_type_distribution
                    distribution = parse_distribution("non_coding")
                    block_msg = "Heads up: quiz questions will skip coding because this course isn't marked as a programming course. To allow coding questions, open the Curriculum modal and switch the course type to Programming."
                    print(f"\n[QUIZ-AUTO-BLOCK] {block_msg}\n")
                    yield f"data: {json.dumps({'type': 'info', 'message': block_msg})}\n\n"

                quiz_prompt = build_quiz_prompt(
                    lesson_summaries=all_lesson_summaries,
                    module_title=module_title,
                    quiz_title=quiz_title,
                    question_type_distribution=distribution,
                    difficulty=difficulty,
                    language=language,
                    used_coding_tasks=used_coding_statements
                )

                # Use dedicated quiz system prompt (not the lesson system prompt)
                quiz_system_prompt = get_quiz_system_prompt()

                messages = [
                    {"role": "system", "content": quiz_system_prompt},
                    {"role": "user", "content": quiz_prompt}
                ]

                try:
                    import time as time_module
                    start_time = time_module.time()

                    # Log the request
                    log_api_request(
                        endpoint=f"generate-quiz-{quiz_id}",
                        messages=messages,
                        model=GEN_CONTENT_MODEL
                    )

                    response = None
                    attempt_count = 0
                    cool_downs = 0
                    max_attempts = max(len(ai_pool.clients) * 3, 3)

                    while attempt_count < max_attempts and not response:
                        try:
                            client, key_num = ai_pool.get_available_client()
                            print(f"[QUIZ-{quiz_id}] Using lane {key_num} (model {ai_pool.model_for(key_num)})")
                            # Thread + heartbeat: the quiz LLM call can stay silent
                            # for a minute+, which no proxy in the chain tolerates.
                            call_task = asyncio.create_task(asyncio.to_thread(
                                lambda: client.chat.completions.create(
                                    messages=messages,
                                    model=ai_pool.model_for(key_num),
                                    response_format=QUIZ_FORMAT,
                                    temperature=0.7,
                                    timeout=230,
                                )
                            ))
                            while not call_task.done():
                                await asyncio.sleep(HEARTBEAT_INTERVAL_S)
                                if not call_task.done():
                                    yield ': heartbeat rss=' + str(msg.get('rss', '?')) + chr(10) + chr(10)
                            response = call_task.result()
                            ai_pool.mark_success(key_num)
                        except Exception as e:
                            error_str = str(e).lower()
                            if is_rate_limit_error(e):
                                ai_pool.mark_rate_limited(key_num, backoff_seconds=60)
                                attempt_count += 1
                                if ai_pool.all_rate_limited() and cool_downs < 2:
                                    wait_s = ai_pool.recovery_wait_seconds() or 60
                                    cool_downs += 1
                                    print(f"[QUIZ-{quiz_id}] All keys cooling down — waiting {wait_s:.0f}s (round {cool_downs}/2)")
                                    yield f"data: {json.dumps({'type': 'status', 'message': f'AI quota cooling down — retrying in {int(wait_s)}s…'})}\n\n"
                                    await asyncio.sleep(wait_s)
                                    continue
                                if attempt_count < max_attempts:
                                    print(f"[QUIZ-{quiz_id}] Key {key_num} rate-limited, trying another...")
                                    time.sleep(0.8)
                                else:
                                    print(f"[QUIZ-{quiz_id}] All API keys rate-limited")
                                    duration_ms = (time_module.time() - start_time) * 1000
                                    log_error(f"generate-quiz-all-keys-rate-limited-{quiz_id}", Exception(f"All API keys rate-limited for quiz {quiz_id}"), duration_ms=duration_ms)
                                    raise Exception(f"All API keys rate-limited for quiz {quiz_id}")
                            else:
                                raise

                    if response is None:
                        duration_ms = (time_module.time() - start_time) * 1000
                        log_error(f"generate-quiz-no-response-{quiz_id}", Exception(f"Failed to get response for quiz {quiz_id}"), duration_ms=duration_ms)
                        raise Exception(f"Failed to get response for quiz {quiz_id}")

                    raw_response = response.choices[0].message.content

                    # Log the response with timing
                    duration_ms = (time_module.time() - start_time) * 1000
                    log_api_response(
                        endpoint=f"generate-quiz-{quiz_id}",
                        response_content=raw_response,
                        completion_tokens=len(raw_response) // 4,
                        duration_ms=duration_ms,
                        streaming=False
                    )

                    quiz_data = json.loads(raw_response, strict=False)

                    # Execute generated reference solutions against their test
                    # cases on the real engine before publishing anything.
                    async for msg in run_with_heartbeat(harden_coding_questions, quiz_data, language):
                        if 'result' not in msg:
                            yield ': heartbeat rss=' + str(msg.get('rss', '?')) + chr(10) + chr(10)

                    # Cross-quiz dedupe: the prompt carries every coding task
                    # used so far, but models still repeat themselves — a
                    # near-identical restatement of an earlier task tests
                    # nothing new and gets dropped.
                    fresh_coding = []
                    for question in quiz_data.get("coding", []) or []:
                        statement = _normalize_coding_statement(question.get("question_text", "") if isinstance(question, dict) else "")
                        if statement and any(_is_duplicate_coding_statement(statement, prev) for prev in used_coding_statements):
                            print(f"[QUIZ-DEDUPE] dropping repeated coding task: {statement[:70]}")
                            continue
                        fresh_coding.append(question)
                        if statement:
                            used_coding_statements.append(statement)
                    quiz_data["coding"] = fresh_coding

                    # Pass full quiz data (includes grouped questions + timer settings)
                    quiz_content = {
                        "quiz_id": quiz_id,
                        "quiz_title": quiz_title,
                        **quiz_data  # Include all fields (multiple_choice, true_false, etc., time_limit_minutes, timer_mode)
                    }
                    all_quizzes.append(quiz_content)

                    yield f"data: {json.dumps({'type': 'quiz_complete', 'data': quiz_content})}\n\n"

                    # Add small delay so UI can animate
                    time.sleep(0.5)

                except Exception as e:
                    duration_ms = (time_module.time() - start_time) * 1000 if 'start_time' in locals() else 0
                    log_error(f"generate-quiz-{quiz_id}", e, duration_ms=duration_ms)
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Failed to generate {quiz_title}'})}\n\n"

        # Send final completion
        final_result = {
            "lessons": all_lessons,
            "quizzes": all_quizzes
        }
        yield f"data: {json.dumps({'type': 'complete', 'data': final_result})}\n\n"

        # Print metrics summary after completion
        print("\n")
        print_metrics_summary()

    except Exception as e:
        log_error("generate-content-stream", e)
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        # Print metrics summary even on error
        print("\n")
        print_metrics_summary()
