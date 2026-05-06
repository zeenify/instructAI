"""
InstructAI Service - AI-powered curriculum and content generation
Refactored modular architecture with debug logging
"""
import os
import json
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from groq import Groq
from dotenv import load_dotenv

# Import modular components
from schemas import CurriculumResponse
from utils.file_handler import extract_text
from services.curriculum_service import generate_curriculum_stream, generate_curriculum_legacy
from services.content_service import generate_content_stream
from services.stage1_outline_service import generate_lesson_outline
from services.stage2_content_service import generate_all_section_contents
from services.stage3_formatter_service import format_all_sections_to_lesson

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="InstructAI Service",
    description="AI-powered curriculum and content generation service",
    version="2.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq clients (primary + fallback)
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
client2 = Groq(api_key=os.getenv("GROQ_API_KEY2")) if os.getenv("GROQ_API_KEY2") else None

print(f"[INIT] Primary API key: {os.getenv('GROQ_API_KEY')[:15]}...")
if client2:
    print(f"[INIT] Fallback API key: {os.getenv('GROQ_API_KEY2')[:15]}...")


# ===== HEALTH CHECK ENDPOINT =====
@app.get("/")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "InstructAI",
        "version": "2.0.0"
    }


# ===== CURRICULUM GENERATION - STREAMING =====
@app.post("/ai/generate-curriculum-stream")
async def curriculum_stream_endpoint(
    prompt: str = Form(...),
    file: UploadFile = File(None),
    curriculum_text: str = Form(None),
    difficulty: str = Form("beginner"),
    module_count: str = Form("3-5"),
    lessons_per_module: str = Form("3-5"),
    include_quiz: str = Form("true"),
    include_coding: str = Form("true"),
    pacing: str = Form("standard")
):
    """
    Streaming endpoint for curriculum structure generation
    Returns server-sent events with module generation progress
    """
    # Build context from curriculum file or uploaded file
    context_text = ""
    if curriculum_text:
        context_text = f"Base curriculum document:\n{curriculum_text[:8000]}\n\n"
    elif file:
        context_text = f"Uploaded document:\n{extract_text(file)[:8000]}\n\n"

    return StreamingResponse(
        generate_curriculum_stream(
            client=client,
            context_text=context_text,
            prompt=prompt,
            difficulty=difficulty,
            module_count=module_count,
            lessons_per_module=lessons_per_module,
            include_quiz=include_quiz,
            include_coding=include_coding,
            pacing=pacing,
            fallback_client=client2
        ),
        media_type="text/event-stream"
    )


# ===== CURRICULUM GENERATION - LEGACY (NON-STREAMING) =====
@app.post("/ai/generate-curriculum")
async def curriculum_legacy_endpoint(
    prompt: str = Form(...),
    file: UploadFile = File(None)
):
    """
    Legacy non-streaming curriculum generation endpoint
    Kept for backwards compatibility
    """
    context_text = ""
    if file:
        context_text = f"Context from uploaded file: {extract_text(file)[:4000]}"

    result = await generate_curriculum_legacy(
        client=client,
        context_text=context_text,
        prompt=prompt
    )

    return result


# ===== CONTENT GENERATION - STREAMING =====
@app.post("/ai/generate-content-stream")
async def content_stream_endpoint(
    curriculum_structure: str = Form(...),  # JSON string of modules with lesson/quiz IDs
    curriculum_text: str = Form(None),
    difficulty: str = Form("beginner"),
    content_depth: str = Form("standard"),
    code_examples_per_lesson: str = Form("3-4"),
    writing_style: str = Form("conversational"),
    questions_per_quiz: str = Form("10"),
    question_type_mix: str = Form("mixed"),
    points_per_question: int = Form(5),
    include_images: str = Form("true"),
    include_videos: str = Form("true")
):
    """
    Generate full content for approved curriculum structure
    Returns server-sent events with lesson and quiz generation progress
    """
    structure = json.loads(curriculum_structure)
    curriculum_context = curriculum_text[:8000] if curriculum_text else ""

    return StreamingResponse(
        generate_content_stream(
            client=client,
            curriculum_structure=structure,
            curriculum_context=curriculum_context,
            difficulty=difficulty,
            content_depth=content_depth,
            code_examples_per_lesson=code_examples_per_lesson,
            writing_style=writing_style,
            questions_per_quiz=questions_per_quiz,
            question_type_mix=question_type_mix,
            points_per_question=points_per_question,
            include_images=include_images,
            include_videos=include_videos,
            fallback_client=client2
        ),
        media_type="text/event-stream"
    )


# ===== TEST ENDPOINT - STAGE 1 OUTLINE =====
@app.post("/ai/test-outline")
async def test_outline_endpoint(
    lesson_title: str = Form(...),
    curriculum_text: str = Form(None),
    module_title: str = Form("Test Module"),
    difficulty: str = Form("beginner")
):
    """
    Test endpoint for Stage 1 outline generation
    """
    curriculum_context = curriculum_text[:8000] if curriculum_text else ""

    outline = await generate_lesson_outline(
        client=client,
        curriculum_context=curriculum_context,
        module_title=module_title,
        lesson_title=lesson_title,
        difficulty=difficulty
    )

    return outline


# ===== TEST ENDPOINT - STAGE 1+2 COMBINED =====
@app.post("/ai/test-full-lesson")
async def test_full_lesson_endpoint(
    lesson_title: str = Form(...),
    curriculum_text: str = Form(None),
    module_title: str = Form("Test Module"),
    difficulty: str = Form("beginner"),
    include_images: str = Form("true"),
    include_videos: str = Form("true")
):
    """
    Test endpoint for full pipeline: Stage 1 + Stage 2 + Stage 3
    """
    curriculum_context = curriculum_text[:8000] if curriculum_text else ""

    # Stage 1: Generate outline
    outline = await generate_lesson_outline(
        client=client,
        curriculum_context=curriculum_context,
        module_title=module_title,
        lesson_title=lesson_title,
        difficulty=difficulty
    )

    # Stage 2: Generate content for each section
    section_contents = await generate_all_section_contents(
        client=client,
        curriculum_context=curriculum_context,
        module_title=module_title,
        lesson_title=lesson_title,
        sections=outline.get('sections', []),
        difficulty=difficulty
    )

    # Stage 3: Format to lesson blocks with real media
    formatted_lesson = format_all_sections_to_lesson(
        section_contents=section_contents,
        lesson_title=lesson_title,
        module_title=module_title,
        include_images=(include_images.lower() == "true"),
        include_videos=(include_videos.lower() == "true")
    )

    return {
        "outline": outline,
        "section_contents": section_contents,
        "formatted_lesson": formatted_lesson
    }


# ===== RUN SERVER =====
if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print("InstructAI Service v2.0.0 - Multi-Stage Pipeline")
    print("=" * 60)
    print("Server: http://localhost:8001")
    print("Debug logging: ENABLED (Groq API requests/responses)")
    print("Test endpoints:")
    print("  - POST /ai/test-outline (Stage 1 only)")
    print("  - POST /ai/test-full-lesson (Stage 1+2)")
    print("=" * 60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8001)
