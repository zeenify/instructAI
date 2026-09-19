"""
Prompt templates for lesson and quiz content generation
"""


def get_quiz_system_prompt() -> str:
    """
    Build system prompt specifically for quiz generation.

    Returns:
        System prompt string for quiz generation
    """
    return """You are an expert quiz generator.

=== CRITICAL REQUIREMENT #1 - READ THIS FIRST ===
OUTPUT FORMAT: You MUST return JSON with this EXACT structure:

{
  "multiple_choice": [array of MC questions],
  "true_false": [array of TF questions],
  "identification": [array of ID questions],
  "enumeration": [array of Enum questions],
  "coding": [array of Code questions]
}

DO NOT return {"questions": [...]} with a flat array.
DO NOT return any other structure.
=== END CRITICAL REQUIREMENT ===

CRITICAL - OUTPUT MUST USE GROUPED STRUCTURE:
You MUST return questions in SEPARATE ARRAYS by type.
DO NOT return a flat "questions" array.
The JSON root must have these keys: multiple_choice, true_false, identification, enumeration, coding

EXAMPLE OF REQUIRED STRUCTURE:
{
  "multiple_choice": [...],
  "true_false": [...],
  "identification": [...],
  "enumeration": [...],
  "coding": [...]
}

FIELD NAMES (NO EXCEPTIONS):
- question_text (NOT "question")
- expected_output (NOT "answer")
- type
- points
- options (for multiple_choice and true_false)
- boilerplate (for coding only)
- language (for coding only: "java" | "python" | "javascript" | "cpp" | "html")
- reference_solution (for coding only: complete working solution)
- test_cases (for coding only, EXCEPT html: array of {{"input", "expected_output", "hidden"}})

VIOLATIONS WILL CAUSE SYSTEM FAILURE.

Example of CORRECT schema:
{
  "questions": [
    {
      "question_text": "What is the capital?",
      "type": "multiple_choice",
      "points": 1,
      "options": ["A", "B", "C", "D"],
      "expected_output": "2"
    }
  ]
}

Example of INCORRECT (WILL FAIL):
{
  "questions": [
    {
      "question": "What is the capital?",  // WRONG - use question_text
      "answer": "C"  // WRONG - use expected_output
    }
  ]
}

MULTIPLE CHOICE RULES:
- expected_output = STRING INDEX of correct answer ("0", "1", "2", or "3")
- DO NOT put the answer text itself
- If correct answer is option[2], then expected_output = "2"

TRUE/FALSE RULES (CRITICAL):
- options = MUST be ["True", "False"] (always include this array)
- expected_output = MUST be exactly "True" or "False" (capitalized, strings)
- NEVER leave expected_output null or empty
- Example: {{"question_text": "Java is OOP?", "type": "true_false", "points": 1, "options": ["True", "False"], "expected_output": "True"}}

IDENTIFICATION RULES:
- expected_output = 1-2 word answer (e.g., "JVM", "int", "variable")
- NEVER leave expected_output null or empty

ENUMERATION RULES (ABSOLUTELY CRITICAL):
- options = MUST be array of the enumeration items (e.g., ["JDK", "JRE", "JVM"])
- expected_output = MUST be empty string "" (the answer IS in the options array)
- points = MUST equal number of items in options array (3 items = 3 points)
- The correct answer is determined by the options array itself, not expected_output
- Example CORRECT:
  {{"question_text": "List 3 Java components", "type": "enumeration", "points": 3, "options": ["JDK", "JRE", "JVM"], "expected_output": ""}}
- Example WRONG:
  {{"options": [], "expected_output": "JDK, JRE, JVM"}} OR {{"options": ["JDK", "JRE", "JVM"], "expected_output": "JDK, JRE, JVM"}}

CODING RULES:
- language = EXACTLY one of "java", "python", "javascript", "cpp", "html" — the language the lessons taught
- boilerplate = starter code for student
- reference_solution = the COMPLETE working solution (no TODOs, never prints the expected output directly). It is executed on the real compiler to verify the test cases.
- expected_output = ACTUAL console output of reference_solution with no input (e.g., "42\\n", NOT "prints 42")
- test_cases = array of 2-4 objects {{"input", "expected_output", "hidden"}}. "input" is the exact stdin fed to the program ("" when it reads nothing); "expected_output" is the EXACT full stdout for that stdin; the first test must have hidden=false and at least one other test hidden=true. For html questions omit test_cases and reference_solution entirely.
- points = 3-5 based on complexity

GROUPING REQUIREMENT - JSON STRUCTURE ENFORCES THIS:
The output JSON structure has SEPARATE ARRAYS for each type.
You CANNOT put questions in a flat array - you MUST use the structure below.
Put each question in its correct array based on type.

Output ONLY valid JSON matching the schema above.
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

NOTE: Lesson code blocks are assembled by the platform from your structured
section content — every code-bearing section (example, practice) MUST include
a "language" field set to EXACTLY one of: "java", "python", "javascript",
"cpp", "html" — matching the programming language used in the curriculum.

QUIZ QUESTIONS must follow exact schema per type:
- multiple_choice: 4 options, points: 1
- true_false: "True" or "False", points: 1
- identification: ONE WORD answer (e.g., "JVM", "int", "variable"), points: 1
- enumeration: 2-4 items ONLY (NO MORE THAN 4), points: N (where N = number of items)
- coding: language + starter code + reference solution + test cases + expected output, points: 3-5 (based on difficulty)

CRITICAL RULES - VIOLATIONS = REJECTION:
1. **Identification answers**: SINGLE WORD ONLY (e.g., "JVM" not "Java Virtual Machine" or "To execute bytecode")
2. **Enumeration**: Generate 2-4 items ONLY. NEVER 5 or more. Points = number of items.
3. **Points distribution** (EXACT):
   - Multiple choice: 1 point
   - True/false: 1 point
   - Identification: 1 point
   - Enumeration: N points (where N = number of items the answer should contain)
   - Coding: 3-5 points (simpler = 3 pts, complex = 5 pts)
4. **Coding output**: Must be ACTUAL console output, not descriptions (e.g., "42\n" not "prints 42")
5. **Language field**: Every code example and coding question carries the curriculum's language — never mix languages
6. **Lesson variety**: DO NOT use same structure for every lesson. Mix up the block order and types.
7. **Practical content**: For setup/installation lessons, provide ACTUAL STEPS, not just descriptions.
8. **Code examples**: Only include code when it ADDS VALUE. Don't force code into every lesson.
9. Use {writing_style} style, {difficulty} difficulty
10. **Videos**: Leave URL empty, suggest search terms for YouTube
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
    lesson_summaries: list,
    module_title: str,
    quiz_title: str,
    question_type_distribution: dict,
    difficulty: str,
    language: str = ""
) -> str:
    """
    Build user prompt for quiz content generation

    Args:
        lesson_summaries: List of compact lesson summaries with concepts and code
        module_title: Parent module title
        quiz_title: Target quiz title
        question_type_distribution: Dict with mc, tf, id, enum, code percentages
        difficulty: Difficulty level

    Returns:
        Quiz generation prompt string
    """
    # Render lesson summaries for context
    lesson_context = ""
    if lesson_summaries:
        lesson_context = "LESSON CONTENT COVERED:\n\n"
        for i, summary in enumerate(lesson_summaries, 1):
            lesson_context += f"{i}. **{summary.get('lesson_title', 'Lesson')}**\n"
            concepts = summary.get('concepts', [])
            if concepts:
                lesson_context += f"   Topics: {', '.join(concepts)}\n"
            code_examples = summary.get('code_examples', [])
            if code_examples:
                lesson_context += f"   Code included: {len(code_examples)} example(s)\n"
            if summary.get('has_coding'):
                lesson_context += "   (Includes coding practice)\n"
            lesson_context += "\n"
    else:
        lesson_context = "No lesson content available for context.\n"

    # Calculate question counts based on distribution percentages
    # AI determines total count in multiples of 5
    total_qs_options = [10, 15, 20, 25, 30, 35, 40, 45, 50]
    total_qs_text = ", ".join(str(n) for n in total_qs_options)

    # Format distribution percentages
    dist_text = f"MC: {question_type_distribution.get('mc', 40)}%, "
    dist_text += f"True/False: {question_type_distribution.get('tf', 20)}%, "
    dist_text += f"Identification: {question_type_distribution.get('id', 20)}%, "
    dist_text += f"Enumeration: {question_type_distribution.get('enum', 10)}%, "
    dist_text += f"Coding: {question_type_distribution.get('code', 10)}%"

    language_line = (
        f"PROGRAMMING LANGUAGE (HARD REQUIREMENT): every coding question MUST be written in {language} — "
        f'the "language" field, the boilerplate, and the reference_solution all use {language}. '
        "Never use any other programming language."
    ) if language else ""

    return f"""
Generate a comprehensive quiz based on lesson content covered.
{language_line}
LESSON CONTENT:
{lesson_context}

MODULE: {module_title}
QUIZ: {quiz_title}
DIFFICULTY: {difficulty}

QUESTION TYPE DISTRIBUTION:
{dist_text}

OUTPUT SCHEMA (EXACT FIELD NAMES - NO EXCEPTIONS):
Use ONLY these field names, nothing else:
- question_text: The question being asked (DO NOT use "question")
- type: multiple_choice | true_false | identification | enumeration | coding
- points: Number of points for this question
- options: [Array of 4 strings] - ONLY FOR MULTIPLE_CHOICE
- expected_output: The correct answer (DO NOT use "answer")
- boilerplate: Starter code - ONLY FOR CODING
- language: "java" | "python" | "javascript" | "cpp" | "html" - ONLY FOR CODING
- reference_solution: Complete working solution - ONLY FOR CODING
- test_cases: [{{"input", "expected_output", "hidden"}}] - ONLY FOR CODING (not html)

FIELDS YOU MUST NOT USE:
- Do NOT use "question" - use "question_text"
- Do NOT use "answer" - use "expected_output"
- Do NOT use any other field names

CRITICAL REQUIREMENTS:

1. **Question count**: Determine the total number of questions (N) where N ∈ {{{total_qs_text}}}
   - Simple single-topic module → 10-15 questions
   - Multi-concept module → 20-25 questions
   - Complex/deep module → 30-40+ questions

2. **Distribution calculation (CRITICAL - MUST EQUAL TOTAL)**:
   Choose total N first, then calculate EXACT counts:
   - MC count = round(N × {question_type_distribution.get('mc', 40)/100})
   - TF count = round(N × {question_type_distribution.get('tf', 20)/100})
   - ID count = round(N × {question_type_distribution.get('id', 20)/100})
   - Enum count = round(N × {question_type_distribution.get('enum', 10)/100})
   - Code count = N - (MC + TF + ID + Enum)  // Remainder ensures total = N

   VERIFY: Sum of all counts MUST equal N exactly
   Example: If N=10 and distribution is 40/20/20/10/10:
   - MC=4, TF=2, ID=2, Enum=1, Code=1 → Total=10 ✓

3. **STRICT GROUPING - USE SEPARATE ARRAYS**:
   Put questions in separate arrays by type (the JSON structure enforces this):
   - "multiple_choice": [all MC questions]
   - "true_false": [all TF questions]
   - "identification": [all ID questions]
   - "enumeration": [all Enum questions]
   - "coding": [all Code questions]

   This structure GUARANTEES grouping - do NOT put questions in wrong arrays.

4. **Content alignment**: Generate questions directly testing the concepts and code from the lessons above

5. **Points system (STRICT - NO EXCEPTIONS)**:
   - Multiple choice: ALWAYS 1 point
   - True/false: ALWAYS 1 point
   - Identification: ALWAYS 1 point
   - Enumeration: ALWAYS N points where N = number of items in answer
   - Coding: 3-5 points based on complexity (simpler = 3, complex = 5)

6. **Multiple Choice format (CRITICAL - THIS IS THE MOST COMMON MISTAKE)**:
   - "options": Array of exactly 4 strings
   - "expected_output": MUST be the STRING INDEX (0, 1, 2, or 3) of the correct answer
   - CORRECT: {{"question_text": "What is X?", "type": "multiple_choice", "points": 1, "options": ["A", "B", "C", "D"], "expected_output": "2"}}
   - WRONG: {{"question_text": "What is X?", "type": "multiple_choice", "options": ["A", "B", "C", "D"], "expected_output": "C"}}
   - WRONG: {{"question_text": "What is X?", "type": "multiple_choice", "options": ["A", "B", "C", "D"], "answer": "C"}}
   - The correct answer in the example is "C" (index 2), so expected_output must be "2"

7. **True/False format (CRITICAL)**:
   - "expected_output": "True" or "False" (EXACTLY these strings)

8. **Identification questions** (SINGLE WORD ONLY):
   - "expected_output": MUST be exactly one word
   - GOOD: "JVM", "variable", "int", "bytecode"
   - BAD: "To execute bytecode", "Java Virtual Machine", "plot visualization"

9. **Enumeration questions** (2-4 items ONLY):
   - Generate exactly the number of items you will ask for
   - "expected_output": Will be parsed as a list, so use proper formatting
   - GOOD: 4 items asked for, points = 4
   - BAD: Asking for 3 items but returning 7 items

10. **Coding questions**:
    - Include "language": EXACTLY one of "java", "python", "javascript", "cpp", "html" — matching the language used in the lessons
    - The program MUST READ ITS INPUT from stdin — python: input(), java: Scanner, cpp: cin, javascript: readline.
      A program that ignores stdin is INVALID: every test case would be identical and would test nothing.
    - Include "boilerplate": Starter code template for student (already reads the input, with TODOs for the logic)
    - Include "reference_solution": COMPLETE working solution (no TODOs, not hardcoded). It runs on the real compiler to verify the tests.
    - Include "expected_output": ACTUAL console output of the reference solution with no input (not description)
      GOOD: "42\\n", "Hello World\\n", "10\\n20\\n30"
      BAD: "prints the answer", "displays the result"
    - Include "test_cases": 2-3 objects, each {{"input": "<exact stdin>", "expected_output": "<exact full stdout>", "hidden": true/false}}
      * "input" uses ACTUAL line breaks between values; every case MUST have a DIFFERENT non-empty input
      * "expected_output" is the EXACT literal stdout for that stdin — DIFFERENT inputs produce DIFFERENT outputs
      * First test hidden=false (students see it); at least one later test hidden=true
      * For "html" questions: OMIT test_cases and reference_solution
    - GOOD coding question (python):
      {{"question_text": "Read the item price and the quantity, then print the total cost", "type": "coding", "language": "python", "points": 3, "options": [],
        "boilerplate": "price = int(input())\\nquantity = int(input())\\n# TODO: print the total cost (price * quantity)\\n",
        "reference_solution": "price = int(input())\\nquantity = int(input())\\nprint(price * quantity)",
        "expected_output": "150",
        "test_cases": [
          {{"input": "50\\n3", "expected_output": "150", "hidden": false}},
          {{"input": "120\\n2", "expected_output": "240", "hidden": true}},
          {{"input": "75\\n1", "expected_output": "75", "hidden": true}}
        ]}}

Output ONLY valid JSON with GROUPED structure (questions separated by type):
{{
  "multiple_choice": [
    {{
      "question_text": "...",
      "type": "multiple_choice",
      "points": 1,
      "options": ["opt1", "opt2", "opt3", "opt4"],
      "expected_output": "0"
    }}
  ],
  "true_false": [
    {{
      "question_text": "...",
      "type": "true_false",
      "points": 1,
      "options": ["True", "False"],
      "expected_output": "True"
    }}
  ],
  "identification": [
    {{
      "question_text": "What does JVM stand for?",
      "type": "identification",
      "points": 1,
      "options": [],
      "expected_output": "JVM"
    }}
  ],
  "enumeration": [
    {{
      "question_text": "List 4 primitive types in Java",
      "type": "enumeration",
      "points": 4,
      "options": ["int", "double", "boolean", "char"],
      "expected_output": ""
    }}
  ],
  "coding": [
    {{
      "question_text": "Write a program to print 'Hello World'",
      "type": "coding",
      "language": "java",
      "points": 3,
      "options": [],
      "boilerplate": "public class Main {{\n    public static void main(String[] args) {{\n        // Your code here\n    }}\n}}",
      "reference_solution": "public class Main {{\n    public static void main(String[] args) {{\n        System.out.println(\"Hello World\");\n    }}\n}}",
      "expected_output": "Hello World",
      "test_cases": [
        {{"input": "", "expected_output": "Hello World", "hidden": false}}
      ]
    }}
  ]
}}

DO NOT USE ANY OTHER FORMAT.
DO NOT return {{"questions": [...]}} with a flat array.
ONLY use the grouped structure above with separate arrays per type.

If a type has 0 questions, use empty array: "multiple_choice": []
"""
