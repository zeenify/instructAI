"""
Prompt templates for lesson and quiz content generation
"""


def get_content_system_prompt(
    difficulty: str,
    content_depth: str,
    code_examples_per_lesson: str,
    writing_style: str,
    include_images: str,
    include_videos: str
) -> str:
    """
    Build system prompt for content generation

    Args:
        difficulty: Difficulty level
        content_depth: Content depth setting
        code_examples_per_lesson: Number of code examples
        writing_style: Writing style preference
        include_images: Whether to include images
        include_videos: Whether to include videos

    Returns:
        System prompt string
    """
    return f"""You are an expert curriculum content generator.

CRITICAL - ABSOLUTE REQUIREMENTS (VIOLATIONS WILL CAUSE REJECTION):
1. ALL content MUST be derived EXCLUSIVELY from the CURRICULUM CONTEXT provided below
2. Use ONLY the programming language, topics, and examples from the curriculum
3. If curriculum mentions Java, generate ONLY Java code - no Python, C#, or generic examples
4. NEVER invent topics, examples, or concepts not explicitly in the curriculum
5. Match the exact difficulty level and teaching style described in the curriculum
6. Reference specific examples and concepts mentioned in the curriculum

OUTPUT FORMAT: Valid JSON matching the exact schema provided.

LESSON BLOCKS must follow this structure:
- h1: {{"type": "h1", "data": {{"text": "Heading Text"}}}}
- text: {{"type": "text", "data": {{"text": "<p>HTML content with <strong>formatting</strong></p>"}}}}
- code (playground): {{"type": "code", "data": {{"mode": "playground", "code": "Java code...", "expected": ""}}}}
- code (challenge): {{"type": "code", "data": {{"mode": "challenge", "code": "Java starter code...", "expected": "Expected output"}}}}
- image: {{"type": "image", "data": {{"url": "https://source.unsplash.com/800x400/?KEYWORD1,KEYWORD2,KEYWORD3", "caption": "Descriptive caption"}}}}
  * IMPORTANT: Replace KEYWORD1,KEYWORD2,KEYWORD3 with 2-3 keywords relevant to THIS SPECIFIC LESSON TOPIC
  * Examples: "variables,programming,syntax" or "loops,coding,algorithm" or "design,graphics,ui"
- video: {{"type": "video", "data": {{"url": "", "title": "Suggested: [Topic] Tutorial - Search on YouTube", "description": "Teacher should find and add YouTube URL"}}}}
- link: {{"type": "link", "data": {{"url": "https://docs.oracle.com/javase/tutorial/", "title": "Official Documentation"}}}}

QUIZ QUESTIONS must follow exact schema per type:
- multiple_choice: 4 options, points: 1
- true_false: "True" or "False", points: 1
- identification: ONE WORD answer (e.g., "JVM", "int", "variable"), points: 1
- enumeration: 2-4 items ONLY (NO MORE THAN 4), points: 2
- coding: starter code + expected output, points: 5-10 (higher for complex tasks)

CRITICAL RULES - VIOLATIONS = REJECTION:
1. **Identification answers**: ONE WORD ONLY (e.g., "JVM" not "Java Virtual Machine" or "To execute bytecode")
2. **Enumeration**: Generate 2-4 items ONLY. NEVER 5 or more.
3. **Points distribution**:
   - Multiple choice, true/false, identification: 1 point
   - Enumeration: 2 points
   - Coding: 5-10 points based on difficulty
4. **Lesson variety**: DO NOT use same structure for every lesson. Mix up the block order and types.
5. **Practical content**: For setup/installation lessons, provide ACTUAL STEPS, not just descriptions.
6. **Code examples**: Only include code when it ADDS VALUE. Don't force code into every lesson.
7. Use {writing_style} style, {difficulty} difficulty
8. **Images**: Use Unsplash Source URLs with relevant keywords:
   - Format: https://source.unsplash.com/800x400/?keyword1,keyword2,keyword3
   - Choose keywords relevant to lesson topic (e.g., "java,programming,code" or "computer,software,development")
   - Images are real educational photos, not placeholders
9. **Videos**: Leave URL empty, suggest search terms for YouTube
"""


def build_lesson_prompt(
    curriculum_context: str,
    module_title: str,
    lesson_title: str,
    difficulty: str,
    content_depth: str,
    code_examples_per_lesson: str,
    writing_style: str,
    include_images: str,
    include_videos: str
) -> str:
    """
    Build user prompt for lesson content generation

    Args:
        curriculum_context: Base curriculum document text
        module_title: Parent module title
        lesson_title: Target lesson title
        difficulty: Difficulty level
        content_depth: Content depth setting
        code_examples_per_lesson: Number of code examples
        writing_style: Writing style preference
        include_images: Whether to include images
        include_videos: Whether to include videos

    Returns:
        Lesson generation prompt string
    """
    return f"""
Generate COMPLETE content for this lesson following the curriculum document.

CURRICULUM CONTEXT (MUST FOLLOW STRICTLY):
{curriculum_context}

MODULE: {module_title}
LESSON: {lesson_title}
DIFFICULTY: {difficulty}
CONTENT DEPTH: {content_depth}
CODE EXAMPLES: {code_examples_per_lesson} (ONLY if topic requires code - skip for theory-only lessons)
WRITING STYLE: {writing_style}

IMPORTANT: Base all content on the curriculum document above. Use the exact programming language, topics, examples, and teaching approach specified in the curriculum.

LESSON STRUCTURE - VARY THE FORMAT:

**For setup/installation lessons**:
- 1 h1 heading
- Brief intro (1 paragraph)
- Step-by-step instructions as bullet lists or numbered lists
- Code example showing the result
- Troubleshooting tips if applicable

**For concept lessons**:
- 1 h1 heading
- 1-2 explanation paragraphs
- Code example demonstrating the concept
- 1-2 more paragraphs explaining the code
- Challenge code block for practice

**For practical lessons**:
- 1 h1 heading
- Brief theory (1 paragraph)
- Multiple small code examples (not just one big one)
- Mix playground and challenge modes
- Focus on DOING, not reading

**Include only if relevant**:
- Images: when visual diagrams help understanding
- Videos: when concept is complex and benefits from video
- Links: always include official docs

**DO NOT**:
- Use the same h1 → 3 paragraphs → 1 code → image → video → link pattern
- Write fluff or filler content
- Force code examples where they don't add value

CRITICAL FOR IMAGES:
- Format: https://source.unsplash.com/800x400/?keyword1,keyword2,keyword3
- Generate 2-3 keywords SPECIFIC to this lesson's topic
- DO NOT use generic "programming,java,code" for every lesson
- Match keywords to lesson content:

Examples based on lesson topic:
  * "Variables and Data Types" → "variables,data,programming"
  * "Installing Java JDK" → "computer,software,installation"
  * "Object-Oriented Programming" → "objects,classes,programming"
  * "Loops and Iteration" → "loops,algorithm,iteration"
  * "UI Design Basics" → "design,interface,user-experience"
  * "Color Theory" → "colors,palette,design"
  * "Database Queries" → "database,sql,data"

CRITICAL FOR VIDEOS:
- NEVER make up YouTube URLs
- Leave url="" and put search suggestion in title field

Output ONLY valid JSON:
{{
  "blocks": [array of blocks with proper id, type, data fields]
}}
"""


def build_quiz_prompt(
    curriculum_context: str,
    module_title: str,
    quiz_title: str,
    questions_per_quiz: str,
    question_type_mix: str,
    points_per_question: int,
    difficulty: str
) -> str:
    """
    Build user prompt for quiz content generation

    Args:
        curriculum_context: Base curriculum document text
        module_title: Parent module title
        quiz_title: Target quiz title
        questions_per_quiz: Number of questions to generate
        question_type_mix: Question type distribution setting
        points_per_question: Points per question
        difficulty: Difficulty level

    Returns:
        Quiz generation prompt string
    """
    return f"""
Generate COMPLETE quiz questions based on the curriculum document.

CURRICULUM CONTEXT (MUST FOLLOW STRICTLY):
{curriculum_context}

[VALIDATION: Curriculum length = {len(curriculum_context)} chars]
{"⚠️  WARNING: Empty curriculum context - generation will be generic!" if len(curriculum_context) < 50 else "✓ Curriculum context loaded successfully"}

MODULE: {module_title}
QUIZ: {quiz_title}
NUMBER OF QUESTIONS: {questions_per_quiz} (GENERATE EXACTLY THIS MANY - NO MORE, NO LESS)
QUESTION TYPE MIX: {question_type_mix}
POINTS PER QUESTION: {points_per_question}
DIFFICULTY: {difficulty}

CRITICAL: All questions must be directly based on topics, concepts, and examples from the curriculum document above. Use the exact programming language and terminology specified. DO NOT generate more or fewer questions than specified.

QUESTION TYPE DISTRIBUTION:
- If "all_multiple_choice": all questions are multiple_choice
- If "mixed": 50% multiple_choice, 20% true_false, 20% identification, 10% enumeration
- If "coding_focused": 40% coding, 30% multiple_choice, 30% mixed other types

STRICT REQUIREMENTS FOR EACH TYPE:
1. **Identification**: Answer must be 1-2 words MAX (e.g., "JVM", "variable", "int")
   - BAD: "To execute Java bytecode"
   - GOOD: "JVM"

2. **Enumeration**: Generate 2-4 items ONLY, never 5 or more
   - BAD: ["int", "double", "boolean", "char", "byte", "short", "long", "float"]
   - GOOD: ["int", "double", "boolean", "char"]

3. **Points assignment**:
   - Multiple choice: 1 point
   - True/false: 1 point
   - Identification: 1 point
   - Enumeration: 2 points
   - Coding: 5-10 points (based on complexity)

Generate EXACTLY {questions_per_quiz} questions following exact schema for each type.

Output ONLY valid JSON:
{{
  "questions": [array of question objects with all required fields]
}}
"""
