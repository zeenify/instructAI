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

    base = f"""You are an expert educational content creator.

WRITING STYLE: {style_map.get(writing_style, style_map['conversational'])}
CONTENT DEPTH: {depth_map.get(content_depth, depth_map['standard'])}

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
2. Explain WHY it matters
3. Use analogies when helpful
4. Break down complex ideas into simple parts
5. Connect to real-world examples
6. No code in concept sections (that's for 'example' sections)

STYLE: Conversational but precise. Teach like you're explaining to a friend.

Output format:
{
  "content_type": "concept",
  "definition": "One sentence definition",
  "explanation": "2-3 paragraphs explaining the concept",
  "why_it_matters": "Why this concept is important",
  "real_world_example": "How this applies in practice",
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
1. Show complete, runnable code
2. Explain WHAT the code does
3. Explain WHY it's written this way
4. Point out important lines
5. Show expected output
6. Code must be syntactically correct

STYLE: Code-first, then explain. Like showing AND telling.

Output format:
{
  "content_type": "example",
  "intro": "Brief intro to what we're demonstrating",
  "code": "Complete code example",
  "explanation": "Line-by-line or block-by-block explanation",
  "output": "What you should see when you run this",
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

RULES:
1. State the challenge clearly - MUST be related to THIS lesson's topic only
2. Provide starter code or scaffolding
3. Give hints (not solutions)
4. Describe expected output - **CRITICAL: Put the EXACT literal output, not a description**
5. Make it achievable but not trivial
6. **CRITICAL**: The exercise must practice ONLY what was taught in this lesson, not unrelated topics

EXPECTED_OUTPUT REQUIREMENTS:
- **MUST contain the EXACT text the program outputs** - Every character, every line
- **NOT a description of what it outputs** (e.g., "A greeting message" is WRONG)
- **Use concrete examples** (e.g., if the code prints a greeting, put "Hello, John!" not "A greeting")
- For multi-line output, include all lines exactly as they appear
- Include any blank lines, spacing, or formatting exactly
- Do NOT describe - DO provide the literal output

Example WRONG: "A message displaying the user's name and calculation result"
Example RIGHT: "Hello, Alice!
Your number doubled is 20"

ANTI-PATTERNS TO AVOID:
- Creating a calculator when the lesson is about environment setup (WRONG)
- Writing algorithms when the lesson is about syntax (WRONG)
- Building features not mentioned in the lesson (WRONG)

STYLE: Encouraging but challenging. Build confidence through doing.

Output format:
{
  "content_type": "practice",
  "challenge": "What the student should build/do (directly related to this lesson)",
  "starter_code": "Starting point code if applicable",
  "hints": ["Hint 1", "Hint 2"],
  "expected_output": "The EXACT literal output the program produces when run. Example: 'Hello, World!' (not 'A greeting message')",
  "success_criteria": "How to know if they got it right"
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


def build_section_content_prompt(
    curriculum_context: str,
    module_title: str,
    lesson_title: str,
    section_title: str,
    section_type: str,
    section_focus: str,
    difficulty: str,
    previous_sections: list = None
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
        previous_sections: List of previously covered sections

    Returns:
        Content generation prompt
    """
    # Build context about what's already been covered
    previous_context = ""
    if previous_sections and len(previous_sections) > 0:
        section_list = ", ".join([f"'{s['title']}'" for s in previous_sections])
        previous_context = f"""
PREVIOUSLY COVERED SECTIONS:
{section_list}

**CRITICAL - AVOID ALL REPETITION**:
✗ DO NOT repeat ANY explanations from previous sections
✗ DO NOT show the same commands/steps again
✗ DO NOT re-explain concepts already covered
✓ ONLY add NEW information specific to THIS section
✓ Reference previous sections instead of repeating them
✓ Build upon what came before, don't duplicate it

Example: If previous section covered "Download JDK", this section should cover "Configure environment variables" - NOT re-explain downloading.
"""

    return f"""
Generate detailed content for this section.

CURRICULUM CONTEXT (MUST FOLLOW):
{curriculum_context}

LESSON CONTEXT:
- Module: {module_title}
- Lesson: {lesson_title}
- Section: {section_title}
- Section Type: {section_type}
- Focus: {section_focus}
- Difficulty: {difficulty}

{previous_context}

SECTION-SPECIFIC FOCUS:
✓ For TUTORIAL sections: Provide step-by-step instructions for THIS section's focus area only
✓ For CONCEPT sections: Explain the specific concept mentioned, don't teach related topics
✓ For EXAMPLE sections: Show code/examples that demonstrate THIS section's topic only
✓ For PRACTICE sections: Create exercises that practice ONLY what's in THIS lesson's section
✓ For INTRODUCTION sections: Hook on THIS lesson's specific topic
✓ For SUMMARY sections: Summarize THIS lesson's key points

CRITICAL REQUIREMENTS FOR "{section_title}":
- Stay laser-focused on this section: "{section_focus}"
- DO NOT create content about unrelated topics
- Example of WRONG: In "Troubleshooting Errors" section for Java setup, asking for calculator code (totally off-topic)
- Example of RIGHT: In "Troubleshooting" section, create practice for fixing common environment setup errors
- Follow the curriculum context strictly
- Match the difficulty level
- For programming: Use correct syntax for the language in curriculum
- For non-programming: Use clear examples from the field
- **AVOID REPETITION**: Don't duplicate steps/commands from previous sections

TASK:
Generate content ONLY for this specific section. Follow the output format specified in the system prompt.

Output ONLY valid JSON matching the format for section type "{section_type}".
"""
