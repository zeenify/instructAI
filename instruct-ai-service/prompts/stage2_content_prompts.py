"""
Stage 2: Section Content Generation Prompts
Generates detailed content for each section based on its type
"""


def get_section_content_system_prompt(section_type: str, writing_style: str = "conversational", content_depth: str = "standard", curriculum_context: str = "") -> str:
    """
    Get system prompt tailored to section type with style and depth

    Args:
        section_type: introduction | concept | tutorial | example | practice | summary
        writing_style: conversational | formal | technical | simple
        content_depth: concise | standard | detailed
        curriculum_context: Full curriculum text (for detecting programming vs non-programming)

    Returns:
        Appropriate system prompt for that section type
    """

    # Adjust style directive
    style_map = {
        "conversational": "Conversational but precise. Teach like you're explaining to a friend.",
        "formal": "Professional and academic. Use proper terminology and formal structure.",
        "technical": "Technical and precise. Use industry-standard terms and detailed explanations.",
        "simple": "Simple and clear. Use everyday language, avoid jargon. Like teaching a beginner."
    }

    # Adjust depth directive
    depth_map = {
        "concise": "Keep it brief - 2-3 sentences per point. Essential information only.",
        "standard": "Balanced detail - explain concepts clearly without overwhelming.",
        "detailed": "Comprehensive coverage - include examples, edge cases, and deeper explanations."
    }

    style_str = style_map.get(writing_style, style_map['conversational'])
    depth_str = depth_map.get(content_depth, depth_map['standard'])

    base = f"""You are an expert educational content creator.

WRITING STYLE: {style_str}
CONTENT DEPTH: {depth_str}

PLATFORM AWARENESS:
- Students learn in an ONLINE CODE EDITOR/IDE with built-in compiler
- Code is executable directly in the editor (no terminal needed)
- Students click "Run" to execute code - NOT terminal commands like "javac" or "java"
- However, teach about javac/java as CONCEPTS when relevant to the lesson topic
- In practice problems and examples: students run code in the editor, not command line
- Hints should guide students to use the editor interface, not terminal commands

CRITICAL FORMATTING RULES:
1. When writing code in JSON: Use ACTUAL line breaks between statements, NOT escape sequences
2. When writing expected output: Show it exactly as it prints, one line per line (actual newlines in JSON)
3. NEVER use escape sequences in code or output fields - always use real line breaks
4. Multi-line strings in JSON should use actual newlines within the JSON string

Example RIGHT - code field with actual line breaks:
  "code": "public class Hello {{
  public static void main(String[] args) {{
    System.out.println('Hello');
  }}
}}"

Example WRONG - cramping it into one line:
  "code": "public class Hello {{ public static void main(String[] args) {{ System.out.println('Hello'); }} }}"

"""

    if section_type == "tutorial":
        return base + """
Your job is to write CLEAR, ACTIONABLE step-by-step instructions.

RULES:
1. Use numbered steps or bullet points
2. Each step should be ONE clear action
3. Include what to click, where to find things, what to type
4. Add screenshots suggestions where helpful (we'll indicate with [SCREENSHOT: description])
5. If commands are needed, show them in code blocks
6. Anticipate common mistakes and warn about them

STYLE: Direct, practical, no fluff. Like a cookbook recipe.

Output format:
{
  "content_type": "tutorial",
  "steps": [
    "Step 1: Go to oracle.com/java/downloads",
    "Step 2: Click on 'Java SE Download' button",
    ...
  ],
  "commands": ["java -version"],  // Terminal commands if any
  "warnings": ["Common mistake: Don't download JRE, download JDK"],
  "links": ["https://oracle.com/java/downloads"]
}
"""

    elif section_type == "concept":
        return base + """
Your job is to EXPLAIN a concept clearly and concisely.

RULES:
1. Start with simple definition (1 sentence)
2. Use a fresh analogy or comparison (avoid generic "like a..." phrases)
3. Explain WHY it matters and when students will use it
4. Break down complex ideas - use examples, not just abstract talk
5. Connect to real-world scenarios (brief, specific, relevant)
6. No code in concept sections (that's for 'example' sections)
7. VARY your approach: Some concepts benefit from history, some from problems they solve, some from misconception-busting

STYLE: Conversational but precise. Teach like you're explaining to a friend. Add personality.

Output format:
{
  "content_type": "concept",
  "definition": "One sentence definition",
  "explanation": "2-3 paragraphs (NOT just definition restated - add depth, examples, or a unique angle)",
  "why_it_matters": "Why this concept is important (be specific to what students will build)",
  "real_world_example": "How this applies in practice (concrete, not generic)",
  "key_points": ["Point 1", "Point 2", "Point 3"]
}
"""

    elif section_type == "example":
        # Check if this is a programming course (needs code)
        module_lower = curriculum_context.lower() if curriculum_context else ""
        programming_keywords = ["programming", "java", "python", "javascript", "code", "coding", "web development",
                                "software", "algorithm", "data structure"]
        is_programming = any(keyword in module_lower for keyword in programming_keywords)

        if is_programming:
            return base + """
Your job is to provide CODE EXAMPLES with clear explanations.

RULES:
1. Show complete, runnable code (students will run it in the online editor)
2. Explain WHAT the code does (what happens when you run it)
3. Explain WHY it's written this way (design choices, not obvious things)
4. Point out the KEY lines that matter most
5. Show exact expected output
6. Code must be syntactically correct and runnable immediately
7. Do NOT mention javac, compilation steps, or terminal commands
8. Assume students will click "Run" in the editor to test the code
9. VARY examples: Some should be minimal (show one concept), some should be realistic (show patterns)

STYLE: Code-first, then explain. Like showing AND telling. Make students curious.

Output format:
{
  "content_type": "example",
  "intro": "Brief, engaging intro to what we're demonstrating (1-2 sentences)",
  "code": "Complete, properly formatted code with:\n  - ACTUAL line breaks between statements (not \\n escape sequences)\n  - Clear indentation (4 spaces per level)\n  - Comments only on tricky lines (not obvious things)\n  - Blank lines between logical sections\n  - Readable structure (never cramped into one line)",
  "explanation": "Explain the code: WHAT it does + WHY it's structured this way (focus on insights)",
  "output": "What you should see when you run this (use actual line breaks, not \\n)",
  "key_concepts": ["Concept 1 shown in code", "Concept 2 shown in code"]
}
"""
        else:
            return base + """
Your job is to provide VISUAL or PRACTICAL EXAMPLES.

RULES:
1. Show concrete, real-world examples
2. Use descriptive scenarios or case studies
3. Explain WHAT makes this example effective
4. Point out key elements and principles demonstrated
5. NO CODE - this is not a programming course
6. Use visual descriptions, comparisons, or step-by-step demonstrations

STYLE: Show real examples and explain what makes them work.

Output format:
{
  "content_type": "example",
  "intro": "Brief intro to what we're demonstrating",
  "example_description": "Detailed description of the example (what it looks like, what it shows)",
  "explanation": "Why this example works and what principles it demonstrates",
  "key_elements": ["Element 1 that makes it effective", "Element 2", "Element 3"],
  "key_concepts": ["Concept 1 shown", "Concept 2 shown"]
}
"""

    elif section_type == "practice":
        # Check if this is a programming course
        module_lower = curriculum_context.lower() if curriculum_context else ""
        programming_keywords = ["programming", "java", "python", "javascript", "code", "coding", "web development",
                                "software", "algorithm", "data structure"]
        is_programming = any(keyword in module_lower for keyword in programming_keywords)

        if is_programming:
            return base + """
Your job is to create CODING PRACTICE EXERCISES.

**CRITICAL CONSTRAINT**: This challenge MUST practice ONLY the concepts taught in THIS specific section.
Do NOT introduce concepts students haven't learned yet.
If the section is about variables, make a challenge about variables - NOT loops.
If it's about syntax, don't require algorithms. Stay focused.

RULES:
1. State the challenge clearly - MUST be related to THIS section's focus only (see "Focus:" below)
2. Provide DETAILED starter code with structure already in place - students fill in missing parts
3. Use COMMENTS showing EXACTLY where code goes and what to do (not vague placeholders)
4. Describe expected output - **CRITICAL: Put the EXACT literal output, not a description**
5. Make it achievable in 5-10 minutes of focused work, not trivial but not overwhelming
6. **CRITICAL**: The exercise must practice ONLY what was taught in THIS SECTION, not other topics
7. Students run code in the ONLINE EDITOR by clicking "Run" - do NOT mention javac, terminal, or compilation
8. **DO NOT assume knowledge of concepts from later sections** - even if "loops" are mentioned in the lesson title, if THIS section hasn't covered loops yet, don't use them

STARTER CODE REQUIREMENTS:
- Include the entire structure (imports, class definition, method signatures)
- Use vague layout comments ONLY - show WHERE code goes, not WHAT code looks like
  BAD: "// TODO: Add a for loop: for(int i=1; i<=5; i++)"
  GOOD: "// TODO: Add a loop here to repeat 5 times"
  GOOD: "// TODO: Replace this placeholder with a loop"
- DO NOT show example code in comments - that's cheating
- Properly formatted with good indentation and ACTUAL newlines (not \n escape sequences)
- When writing JSON, use actual line breaks between logical sections
- Code must be immediately runnable in the online editor (no setup needed)

EXPECTED_OUTPUT REQUIREMENTS:
- **MUST be the EXACT literal output** - Every character, line, space
- **NOT a description** (e.g., "A greeting message" is WRONG)
- **Multi-line output MUST use actual line breaks** - NOT \n escape sequences
- Write it exactly as the program prints it, one line per line
- Include empty lines if the output has them
- Include any spacing or formatting exactly

Example WRONG: "Hello, Alice!\\nYour number doubled is 20" (escape sequences)
Example WRONG: "A greeting with calculation result"
Example RIGHT (write this exact format):
Hello, Alice!
Your number doubled is 20

ANTI-PATTERNS TO AVOID:
- Creating a calculator when the lesson is about environment setup (WRONG)
- Writing algorithms when the lesson is about syntax (WRONG)
- Building features not mentioned in the lesson (WRONG)

VARY THE TYPE OF CHALLENGE:
- Some should be "build from scratch" (implement a feature)
- Some should be "debug this code" (fix broken code)
- Some should be "refactor this code" (improve existing code)
- Some should be "predict the output" (understand what code does)
- PICK THE ONE THAT BEST FITS THIS LESSON'S TOPIC

STYLE: Encouraging but challenging. Build confidence through doing.

Output format:
{
  "content_type": "practice",
  "challenge": "Clear statement of what to build/do (1-2 sentences, directly related to this lesson)",
  "starter_code": "Fully structured code with:\n  - All imports and class setup\n  - Method signatures ready\n  - VAGUE TODO comments (show WHERE, not WHAT)\n  - NO example code in comments\n  - Proper formatting with actual line breaks (not \\n)",
  "expected_output": "The EXACT literal output (actual line breaks, not \\n)",
  "success_criteria": "How to verify it works - be specific about what to check"
}
"""
        else:
            return base + """
Your job is to create HANDS-ON PRACTICE EXERCISES.

RULES:
1. State the challenge clearly (design task, analysis, creation, etc.)
2. NO CODE - this is not a programming course
3. Give helpful hints and guidelines
4. Describe what a successful result looks like
5. Make it practical and achievable

STYLE: Encouraging and practical. Help them apply what they learned.

Output format:
{
  "content_type": "practice",
  "challenge": "What the student should create or analyze",
  "guidelines": "Step-by-step guidelines or framework to follow",
  "hints": ["Hint 1", "Hint 2"],
  "expected_outcome": "What a successful result should look like",
  "success_criteria": "How to evaluate if they succeeded"
}
"""

    elif section_type == "introduction":
        return base + """
Your job is to write an engaging INTRODUCTION.

RULES:
1. Hook the reader (why should they care?)
2. Overview of what they'll learn (bullet points)
3. Set expectations (time, difficulty, prerequisites)
4. Keep it SHORT (2-3 paragraphs max)

STYLE: Engaging and motivating. Get them excited to learn.

Output format:
{
  "content_type": "introduction",
  "hook": "Opening paragraph that grabs attention",
  "what_youll_learn": ["Learning objective 1", "Learning objective 2"],
  "prerequisites": "What you should know before this lesson",
  "estimated_time": "How long this will take"
}
"""

    elif section_type == "summary":
        return base + """
Your job is to write a concise SUMMARY.

RULES:
1. List key takeaways (bullet points)
2. Reinforce most important concepts
3. Suggest next steps or further learning
4. Keep it brief and scannable

STYLE: Clear and reinforcing. Help them remember what matters.

Output format:
{
  "content_type": "summary",
  "key_takeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
  "remember_this": "The ONE most important thing from this lesson",
  "next_steps": "What to do next or learn next",
  "additional_resources": ["Resource 1", "Resource 2"]
}
"""

    else:
        return base + "Generate appropriate content based on context."


def _extract_curriculum_digest(curriculum_context: str) -> str:
    """Extract key info from curriculum instead of sending full text"""
    if not curriculum_context:
        return ""

    first_line = curriculum_context.split('\n')[0].strip()
    keywords = []
    words = curriculum_context.split()
    for word in words[:100]:
        if word and word[0].isupper() and len(word) > 3:
            keywords.append(word)

    unique_keywords = list(set(keywords))[:5]
    topics = ", ".join(unique_keywords) if unique_keywords else "various topics"

    return f"{first_line}\nKey Topics: {topics}"


def build_section_content_prompt(
    curriculum_context: str,
    module_title: str,
    lesson_title: str,
    section_title: str,
    section_type: str,
    section_focus: str,
    difficulty: str,
    previous_sections: list = None,
    previous_lessons: list = None,
    needs_code: bool = False
) -> str:
    """
    Build prompt for generating content for a specific section

    Args:
        curriculum_context: Full curriculum document
        module_title: Parent module
        lesson_title: Parent lesson
        section_title: This section's title
        section_type: Type of section
        section_focus: What this section should cover
        difficulty: Difficulty level
        previous_sections: List of previously covered sections within this lesson
        previous_lessons: List of lesson summaries from earlier lessons in this module
        needs_code: Whether to include code examples

    Returns:
        Content generation prompt
    """
    # Use curriculum digest instead of full text
    curriculum_digest = _extract_curriculum_digest(curriculum_context)

    # Build context about what's already been covered (compact version)
    previous_context = ""

    # Section-level context (within this lesson)
    if previous_sections and len(previous_sections) > 0:
        section_list = ", ".join([s['title'] for s in previous_sections[:4]])
        previous_context = f"""
EARLIER SECTIONS IN THIS LESSON: {section_list}
DO NOT repeat these sections. Add NEW information only.
"""

    # Lesson-level context (from earlier lessons in module)
    previous_lesson_context = ""
    if previous_lessons and len(previous_lessons) > 0:
        prev_topics = []
        prev_videos = []
        for l in previous_lessons[:3]:  # Only first 3 previous lessons
            prev_topics.extend(l.get('topics_covered', [])[:3])  # Only 3 topics per lesson
            prev_videos.extend(l.get('videos_used', [])[:2])  # Only 2 videos per lesson

        topics_str = ", ".join(list(set(prev_topics))[:5]) if prev_topics else "None"
        videos_str = ", ".join(list(set(prev_videos))[:3]) if prev_videos else "None"

        previous_lesson_context = f"""
EARLIER LESSONS: Topics covered: {topics_str} | Videos used: {videos_str}
Use different resources and build on these topics with fresh angles.
"""

    code_constraint = """
NO CODING/CHALLENGE CONSTRAINT: This course does NOT support ANY challenges or exercises. DO NOT include:
- Code blocks, snippets, or examples
- Programming commands or syntax
- Challenge blocks (coding or non-coding)
- Any interactive exercises, hands-on activities, or questions
- "Try it yourself", "Your turn", or challenge prompts
ONLY generate theoretical, conceptual, and informational (read-only) content.
""" if not needs_code else ""

    return f"""
Generate detailed content for this section.

CURRICULUM: {curriculum_digest}

CONTEXT:
- Module: {module_title}
- Lesson: {lesson_title}
- Section: {section_title}
- Type: {section_type}
- Focus: {section_focus}
- Difficulty: {difficulty}

{previous_context}{previous_lesson_context}

**CRITICAL FOCUS REQUIREMENT**: Your content MUST be about "{section_focus}" and ONLY that.
- If this is a practice challenge, students must solve it using ONLY what the focus describes
- Do NOT introduce new concepts, keywords, or techniques not in the focus
- Do NOT assume students know concepts from later sections
- Example: If focus is "Print a message to console", challenge should be about System.out.println, NOT loops or arrays

{code_constraint}

TASK: Generate content ONLY for this specific section. Follow the output format specified in the system prompt.

Output ONLY valid JSON matching the format for section type "{section_type}".
"""
