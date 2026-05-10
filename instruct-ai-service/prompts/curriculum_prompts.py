"""
Prompt templates for curriculum generation
"""


def get_curriculum_system_prompt() -> str:
    """System prompt for curriculum structure generation"""
    return """
Act as a Professional Curriculum Designer.
You MUST output valid JSON following this EXACT schema:
{
    "new_modules":[
        {
            "title": "Module Name",
            "lessons": [{"title": "Lesson Name"}],
            "quizzes":[{"title": "Quiz Name"}]
        }
    ]
}

IMPORTANT LIMITS (to prevent API rate limits):
- Maximum 8 modules total
- Maximum 8 lessons per module
- Maximum total of 64 lessons across all modules

Never deviate from these key names. Generate modules one at a time.
If the user requests more than these limits, generate up to the maximum and note that the limit was reached.
"""


def build_curriculum_user_prompt(
    context_text: str,
    prompt: str,
    difficulty: str,
    module_count: str,
    lessons_per_module: str,
    include_quiz: str,
    include_coding: str,
    pacing: str
) -> str:
    """
    Build user prompt for curriculum generation with parameters

    Args:
        context_text: Content from uploaded file or curriculum document
        prompt: User's curriculum generation instructions
        difficulty: Difficulty level (beginner, intermediate, advanced)
        module_count: Target number of modules (e.g., "3-5")
        lessons_per_module: Target lessons per module (e.g., "3-5")
        include_quiz: Whether to include quizzes ("true" or "false")
        include_coding: Whether to include coding exercises ("true" or "false")
        pacing: Course pacing (fast, standard, slow)

    Returns:
        Formatted user prompt string
    """
    # Log the first 200 chars of context to verify it's being loaded
    context_preview = context_text[:200] if context_text else "(NO CONTEXT)"
    print(f"\n[CURRICULUM-CONTEXT] First 200 chars: {context_preview}...")
    print(f"[CURRICULUM-CONTEXT] Total length: {len(context_text) if context_text else 0} chars\n")

    # Use full context instead of truncating - let Groq handle it
    # The DLL is important, don't cut it short!
    context_digest = context_text if context_text else ""

    param_instructions = f"""
PARAMETERS:
- Difficulty: {difficulty}
- Modules: {module_count} (max 8)
- Lessons/Module: {lessons_per_module} (max 8)
- Quizzes: {include_quiz}
- Coding: {include_coding}
- Pacing: {pacing}

User Instructions: {prompt}
"""

    return f"{context_digest}\n{param_instructions}"
