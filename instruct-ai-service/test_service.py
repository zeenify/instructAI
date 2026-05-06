"""
Quick test script to verify the refactored AI service works
Run this before starting the actual server to catch import errors
"""
import sys

def test_imports():
    """Test all module imports"""
    print("Testing imports...")

    try:
        from schemas import (
            CurriculumResponse,
            LessonContent,
            QuizContent,
            ContentGenerationResponse
        )
        print("[OK] schemas.py")
    except Exception as e:
        print(f"[FAIL] schemas.py: {e}")
        return False

    try:
        from utils.file_handler import extract_text
        print("[OK] utils/file_handler.py")
    except Exception as e:
        print(f"[FAIL] utils/file_handler.py: {e}")
        return False

    try:
        from utils.logger import (
            log_api_request,
            log_api_response,
            log_error,
            print_separator
        )
        print("[OK] utils/logger.py")
    except Exception as e:
        print(f"[FAIL] utils/logger.py: {e}")
        return False

    try:
        from prompts.curriculum_prompts import (
            get_curriculum_system_prompt,
            build_curriculum_user_prompt
        )
        print("[OK] prompts/curriculum_prompts.py")
    except Exception as e:
        print(f"[FAIL] prompts/curriculum_prompts.py: {e}")
        return False

    try:
        from prompts.content_prompts import (
            get_content_system_prompt,
            build_lesson_prompt,
            build_quiz_prompt
        )
        print("[OK] prompts/content_prompts.py")
    except Exception as e:
        print(f"[FAIL] prompts/content_prompts.py: {e}")
        return False

    try:
        from services.curriculum_service import (
            generate_curriculum_stream,
            generate_curriculum_legacy
        )
        print("[OK] services/curriculum_service.py")
    except Exception as e:
        print(f"[FAIL] services/curriculum_service.py: {e}")
        return False

    try:
        from services.content_service import generate_content_stream
        print("[OK] services/content_service.py")
    except Exception as e:
        print(f"[FAIL] services/content_service.py: {e}")
        return False

    print("\n[SUCCESS] All imports successful!")
    return True


def test_logger():
    """Test logger functions"""
    print("\nTesting logger...")

    from utils.logger import log_api_request, log_api_response, log_error

    # Test request logging
    log_api_request(
        endpoint="test-endpoint",
        messages=[
            {"role": "system", "content": "Test system prompt"},
            {"role": "user", "content": "Test user prompt"}
        ],
        model="test-model",
        temperature=0.7
    )

    # Test response logging
    log_api_response(
        endpoint="test-endpoint",
        response_content='{"test": "response"}',
        streaming=False
    )

    # Test error logging
    log_error("test-endpoint", Exception("Test error"))

    print("[OK] Logger functions work correctly")


def test_prompt_builders():
    """Test prompt builder functions"""
    print("\nTesting prompt builders...")

    from prompts.curriculum_prompts import build_curriculum_user_prompt
    from prompts.content_prompts import build_lesson_prompt

    # Test curriculum prompt
    curriculum_prompt = build_curriculum_user_prompt(
        context_text="Test context",
        prompt="Create a test course",
        difficulty="beginner",
        module_count="3",
        lessons_per_module="5",
        include_quiz="true",
        include_coding="true",
        pacing="standard"
    )
    assert "GENERATION PARAMETERS" in curriculum_prompt
    print("[OK] Curriculum prompt builder works")

    # Test lesson prompt
    lesson_prompt = build_lesson_prompt(
        curriculum_context="Test curriculum",
        module_title="Test Module",
        lesson_title="Test Lesson",
        difficulty="beginner",
        content_depth="standard",
        code_examples_per_lesson="3",
        writing_style="conversational",
        include_images="true",
        include_videos="true"
    )
    assert "Generate COMPLETE content" in lesson_prompt
    print("[OK] Lesson prompt builder works")


if __name__ == "__main__":
    print("=" * 80)
    print("InstructAI Service - Refactoring Test Suite")
    print("=" * 80)

    if not test_imports():
        print("\n[FAIL] Import test failed. Fix errors before running server.")
        sys.exit(1)

    test_logger()
    test_prompt_builders()

    print("\n" + "=" * 80)
    print("[SUCCESS] All tests passed! Service is ready to run.")
    print("=" * 80)
    print("\nStart the service with: python main.py")
