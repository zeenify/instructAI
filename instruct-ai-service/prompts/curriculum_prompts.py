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
        include_quiz: Whether to include coding exercises ("true" or "false")
        pacing: Course pacing (fast, standard, slow)

    Returns:
        Formatted user prompt string
    """
    param_instructions = f"""
GENERATION PARAMETERS:
- Difficulty Level: {difficulty}
- Module Count: {module_count} (absolute max: 8 modules)
- Lessons per Module: {lessons_per_module} (absolute max: 8 lessons per module)
- Include Quiz per Module: {include_quiz}
- Include Coding Exercises: {include_coding}
- Pacing: {pacing}

Generate a curriculum that strictly adheres to these parameters.
Stay within the absolute maximum limits to prevent rate limiting issues.
"""

    return f"{context_text}{param_instructions}\nUser Instructions: {prompt}"
