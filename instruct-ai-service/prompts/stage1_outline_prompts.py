"""
Stage 1: Outline Generation Prompts
Breaks down a lesson into logical sections
"""


def get_outline_system_prompt() -> str:
    """System prompt for generating lesson outlines"""
    return """You are an expert curriculum architect.

Your job is to break down a lesson into logical, teachable sections.

CRITICAL RULES:
1. Each section should cover ONE clear concept or task
2. Sections should flow logically (simple → complex)
3. **AVOID REDUNDANCY**: Don't create multiple sections covering the same topic
   - BAD: "Setting Up Java" + "Java Installation" (same thing!)
   - GOOD: "Setting Up Java Environment" (covers both in one section)
4. Match the lesson type:
   - Tutorial lessons: Step-by-step sections
   - Concept lessons: Theory → Example → Practice
   - Mixed lessons: Blend of both

5. Section types:
   - "introduction" - Brief overview of what's covered
   - "concept" - Explaining a theory or idea
   - "tutorial" - Step-by-step instructions
   - "example" - Code example with explanation
   - "practice" - Challenge or exercise
   - "summary" - Key takeaways

6. For programming courses: Balance theory and practice
7. For non-programming: Focus on clear explanations and examples
8. **KEEP IT FOCUSED**: 4-5 sections is better than 6-7 if topics overlap

Output ONLY valid JSON following exact schema."""


def build_outline_prompt(
    curriculum_context: str,
    module_title: str,
    lesson_title: str,
    difficulty: str
) -> str:
    """
    Build prompt for outline generation

    Args:
        curriculum_context: Full curriculum document
        module_title: Parent module title
        lesson_title: Target lesson title
        difficulty: Difficulty level

    Returns:
        Outline generation prompt
    """
    return f"""
Generate a detailed outline for this lesson.

CURRICULUM CONTEXT:
{curriculum_context}

MODULE: {module_title}
LESSON: {lesson_title}
DIFFICULTY: {difficulty}

TASK: Break this lesson into 4-5 logical sections (MAXIMUM 5, prefer 4).

For each section, specify:
- title: Clear, descriptive title (must be DISTINCT - no overlap with other sections)
- type: introduction | concept | tutorial | example | practice | summary
- focus: What this section teaches (1 sentence)
- needs_code: true if code examples needed, false otherwise

GUIDELINES:
- Tutorial lessons (setup, installation): Combine related steps into ONE tutorial section
- Concept lessons (variables, OOP): Use "concept" + "example" + "practice"
- Balance theory and hands-on practice
- Each section should take 4-6 minutes (don't split into tiny sections)
- **MERGE overlapping topics**: "Installation" + "Configuration" = ONE section called "Installation and Configuration"

Output ONLY valid JSON:
{{
  "lesson_title": "{lesson_title}",
  "estimated_duration": "15-20 minutes",
  "sections": [
    {{
      "title": "Section Title",
      "type": "introduction|concept|tutorial|example|practice|summary",
      "focus": "What this section covers",
      "needs_code": true|false
    }}
  ]
}}
"""
