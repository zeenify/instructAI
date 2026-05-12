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


def _extract_curriculum_digest(curriculum_context: str) -> str:
    """Extract key info from curriculum instead of sending full text"""
    if not curriculum_context:
        return ""

    # Take first line or first sentence (usually has course title/description)
    first_line = curriculum_context.split('\n')[0].strip()

    # Extract topic keywords from full context (topics usually capitalized)
    keywords = []
    words = curriculum_context.split()
    for word in words[:100]:  # Check first 100 words for efficiency
        if word and word[0].isupper() and len(word) > 3:
            keywords.append(word)

    # Limit to 5 main topics
    unique_keywords = list(set(keywords))[:5]
    topics = ", ".join(unique_keywords) if unique_keywords else "various topics"

    return f"{first_line}\nKey Topics: {topics}"


def build_outline_prompt(
    curriculum_context: str,
    module_title: str,
    lesson_title: str,
    difficulty: str,
    previous_lessons: list = None,
    is_coding: bool = True
) -> str:
    """
    Build prompt for outline generation

    Args:
        curriculum_context: Full curriculum document
        module_title: Parent module title
        lesson_title: Target lesson title
        difficulty: Difficulty level
        previous_lessons: List of lesson summaries from earlier in module (for context awareness)
        is_coding: Whether the course supports coding

    Returns:
        Outline generation prompt
    """
    # Use curriculum digest instead of full text
    curriculum_digest = _extract_curriculum_digest(curriculum_context)

    avoidance_section = ""
    if previous_lessons and len(previous_lessons) > 0:
        covered_topics = []
        covered_videos = []

        for prev in previous_lessons:
            covered_topics.extend(prev.get('topics_covered', []))
            covered_videos.extend(prev.get('videos_used', []))

        # Remove duplicates and limit
        covered_topics = list(set(covered_topics))[:5]
        covered_videos = list(set(covered_videos))[:5]

        # Compact version without excessive repetition
        video_list = ", ".join(covered_videos) if covered_videos else "None"
        avoidance_section = f"""
⚠️  AVOID REPETITION FROM EARLIER LESSONS:
Topics covered: {', '.join(covered_topics) if covered_topics else 'None'}
Videos used: {video_list}

RULES: Don't repeat topics/videos/approaches from earlier lessons. Build on them with fresh angles instead.
"""

    if not is_coding:
        coding_constraint = """
NO CODING/CHALLENGE CONSTRAINT: This course does NOT support coding, challenges, or practice exercises.
- Set needs_code to FALSE for ALL sections
- DO NOT use "practice" or "challenge" section types
- NO interactive exercises, hands-on activities, or "try it yourself" sections
- Use ONLY: introduction | concept | example | summary
- Focus on explanations, definitions, key points, and informational content only
"""
        allowed_types = "introduction | concept | example | summary"
    else:
        coding_constraint = """
CODING SUPPORT: This course supports coding. Use needs_code=true for practice/example sections.
"""
        allowed_types = "introduction | concept | tutorial | example | practice | summary"

    return f"""
Generate a detailed outline for this lesson.

CURRICULUM: {curriculum_digest}
MODULE: {module_title}
LESSON: {lesson_title}
DIFFICULTY: {difficulty}
{avoidance_section}

TASK: Break this lesson into 4-5 logical sections (MAXIMUM 5, prefer 4).

For each section, specify:
- title: Clear, descriptive title (must be DISTINCT - no overlap with other sections)
- type: {allowed_types}
- focus: What this section teaches (1 sentence)
- needs_code: true if section has code/challenges, false otherwise

{coding_constraint}

GUIDELINES:
- Tutorial lessons (setup, installation): Combine related steps into ONE tutorial section
- For coding courses: Include "example" or "tutorial" sections when helpful, but not required every lesson
- For non-coding: Use "concept" + "example" + "summary" structure
- Balance theory with clear explanations and examples
- Each section should take 4-6 minutes
- MERGE overlapping topics into single sections

**WHEN TO INCLUDE EXAMPLE/DEMO CODE**:
- Include if the concept is abstract and needs visual demonstration (how inheritance works, method chaining)
- Include if students need to see syntax in action before they practice (loops, string methods)
- Skip if the concept is straightforward (variable declaration, basic syntax)
- Skip if the lesson is purely theoretical (OOP principles, design patterns explanation)
- Think: Does this concept NEED a code example, or can explanation alone suffice?

**WHEN TO INCLUDE PRACTICE CHALLENGES**:
- Include if the lesson teaches a skill that needs hands-on practice (loops, conditionals, methods)
- Skip if the lesson is conceptual/theoretical (explaining Java syntax, understanding OOP principles)
- Skip if the lesson is introductory/setup (installing JDK, environment setup, understanding IDEs)
- Think: Does this lesson teach something students need to TRY, or just UNDERSTAND?

**SECTION ORDERING** - Build complexity step by step:
- Section 1 (Introduction): Set context, don't teach yet
- Section 2 (Concept): Teach new idea/syntax ONLY
- Section 3 (Example/Tutorial): Show how to use what was just taught
- Section 4 (Practice): Challenge using sections 2-3 material ONLY, no new concepts
- Section 5 (Summary): Review what was learned

CODING COURSE SECTION STRUCTURE (when is_coding=true):
1. Introduction - Hook + learning objectives (needs_code: false)
2. Concept - Explain the theory/idea (needs_code: false)
3. Example OR Tutorial - Show code/demo with explanation (needs_code: true) - **OPTIONAL: only include if concept needs visual demo**
4. Practice - Challenge/exercise for students (needs_code: true) - **OPTIONAL: only include if lesson is practical/skill-based**
5. Summary - Key takeaways (needs_code: false)

TYPICAL LESSON STRUCTURES:
- Skill-focused with demo (loops, conditionals, methods): Intro → Concept → Example → Practice → Summary (5 sections)
- Skill-focused without demo (simple syntax): Intro → Concept → Practice → Summary (4 sections, no example)
- Conceptual with demo (abstract ideas): Intro → Concept → Example → Summary (4 sections, no practice)
- Conceptual without demo (straightforward): Intro → Concept → Summary (3 sections, no example/practice)
- Setup/Tutorial (environment, tooling): Intro → Tutorial → Summary (3 sections, no example/practice)

**CRITICAL**: If you include a Practice section, it MUST only use concepts from Concept or Example sections.
- If the lesson teaches "variables", practice should be about variables
- If the lesson teaches "for loops", practice should use for loops
- Do NOT create a challenge about arrays if arrays weren't introduced
- Each practice challenge should be achievable using ONLY what was just taught

Output ONLY valid JSON:
{{
  "lesson_title": "{lesson_title}",
  "estimated_duration": "15-20 minutes",
  "sections": [
    {{
      "title": "Section Title",
      "type": "{allowed_types}",
      "focus": "What this section covers",
      "needs_code": false
    }}
  ]
}}
"""
