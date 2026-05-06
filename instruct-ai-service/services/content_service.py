"""
Service for lesson and quiz content generation using Groq API
Multi-stage pipeline for high-quality lesson generation
"""
import json
import time
from groq import Groq
from prompts.content_prompts import get_content_system_prompt, build_lesson_prompt, build_quiz_prompt
from services.stage1_outline_service import generate_lesson_outline
from services.stage2_content_service import generate_all_section_contents
from services.stage3_formatter_service import format_all_sections_to_lesson
from utils.logger import log_api_request, log_api_response, log_error


async def generate_content_stream(
    client: Groq,
    curriculum_structure: list,
    curriculum_context: str,
    difficulty: str,
    content_depth: str,
    code_examples_per_lesson: str,
    writing_style: str,
    questions_per_quiz: str,
    question_type_mix: str,
    points_per_question: int,
    include_images: str,
    include_videos: str,
    fallback_client: Groq = None
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
        questions_per_quiz: Number of questions per quiz
        question_type_mix: Question type distribution
        points_per_question: Points per question
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

        # Generate content for each module
        for module_idx, module in enumerate(curriculum_structure):
            module_title = module['title']

            # ===== GENERATE LESSON CONTENT (3-STAGE PIPELINE) =====
            for lesson_idx, lesson in enumerate(module.get('lessons', [])):
                lesson_id = lesson.get('id')
                lesson_title = lesson.get('title')

                yield f"data: {json.dumps({'type': 'status', 'message': f'Planning: {lesson_title}'})}\n\n"

                try:
                    # STAGE 1: Generate outline
                    yield f"data: {json.dumps({'type': 'status', 'message': f'📋 Planning outline: {lesson_title}'})}\n\n"

                    outline = await generate_lesson_outline(
                        client=client,
                        curriculum_context=curriculum_context,
                        module_title=module_title,
                        lesson_title=lesson_title,
                        difficulty=difficulty
                    )

                    sections = outline.get('sections', [])
                    yield f"data: {json.dumps({'type': 'status', 'message': f'✍️ Writing {len(sections)} sections: {lesson_title}'})}\n\n"

                    # STAGE 2: Generate content for each section (with progress updates and context)
                    section_contents = []
                    previous_sections = []  # Track what's already been covered

                    for idx, section in enumerate(sections, 1):
                        section_title = section.get('title', 'Section')
                        yield f"data: {json.dumps({'type': 'status', 'message': f'Section {idx}/{len(sections)}: {section_title}'})}\n\n"

                        from services.stage2_content_service import generate_section_content
                        content = await generate_section_content(
                            client=client,
                            curriculum_context=curriculum_context,
                            module_title=module_title,
                            lesson_title=lesson_title,
                            section=section,
                            difficulty=difficulty,
                            content_depth=content_depth,
                            writing_style=writing_style,
                            fallback_client=fallback_client,
                            previous_sections=previous_sections  # Pass context
                        )

                        # Check if rate limit was hit
                        if content.get('rate_limit_error'):
                            yield f"data: {json.dumps({'type': 'error', 'message': content.get('error', 'Rate limit reached')})}\n\n"
                            return

                        section_contents.append(content)

                        # Add to context for next sections
                        previous_sections.append({
                            'title': section_title,
                            'type': section.get('type'),
                            'covered': True
                        })

                    yield f"data: {json.dumps({'type': 'status', 'message': f'🎨 Adding images and videos: {lesson_title}'})}\n\n"

                    # STAGE 3: Format to lesson blocks with real media
                    formatted_lesson = format_all_sections_to_lesson(
                        section_contents=section_contents,
                        lesson_title=lesson_title,
                        module_title=module_title,
                        include_images=(include_images.lower() == "true"),
                        include_videos=(include_videos.lower() == "true")
                    )

                    lesson_content = {
                        "lesson_id": lesson_id,
                        "lesson_title": lesson_title,
                        "blocks": formatted_lesson.get('blocks', [])
                    }
                    all_lessons.append(lesson_content)

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

                quiz_prompt = build_quiz_prompt(
                    curriculum_context=curriculum_context,
                    module_title=module_title,
                    quiz_title=quiz_title,
                    questions_per_quiz=questions_per_quiz,
                    question_type_mix=question_type_mix,
                    points_per_question=points_per_question,
                    difficulty=difficulty
                )

                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": quiz_prompt}
                ]

                try:
                    # Log the request
                    log_api_request(
                        endpoint=f"generate-quiz-{quiz_id}",
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
                        endpoint=f"generate-quiz-{quiz_id}",
                        response_content=raw_response,
                        streaming=False
                    )

                    quiz_data = json.loads(raw_response)
                    quiz_content = {
                        "quiz_id": quiz_id,
                        "quiz_title": quiz_title,
                        "questions": quiz_data.get('questions', [])
                    }
                    all_quizzes.append(quiz_content)

                    yield f"data: {json.dumps({'type': 'quiz_complete', 'data': quiz_content})}\n\n"

                    # Add small delay so UI can animate
                    time.sleep(0.5)

                except Exception as e:
                    log_error(f"generate-quiz-{quiz_id}", e)
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Failed to generate {quiz_title}'})}\n\n"

        # Send final completion
        final_result = {
            "lessons": all_lessons,
            "quizzes": all_quizzes
        }
        yield f"data: {json.dumps({'type': 'complete', 'data': final_result})}\n\n"

    except Exception as e:
        log_error("generate-content-stream", e)
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
