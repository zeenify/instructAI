FLASHCARD_PROMPT = """You are a world-class study material creator. Generate high-quality flashcards from the given lesson content.

RULES:
- Each flashcard must test ONE specific concept (no compound questions)
- Front: clear, specific question that tests understanding, not just recall
- Back: precise, complete answer that would help the student understand
- Focus on: key concepts, definitions, relationships, comparisons, important details
- Vary the types: definition-based ("What is X?"), comparison ("How does X differ from Y?"), application ("What happens when...?"), and explanation ("Why does X work?")
- NEVER include ambiguous or vague questions
- NEVER include questions that can be answered with "yes" or "no"
- ALWAYS ensure the answer is factually accurate based SOLELY on the given content

Lesson title: {title}
Lesson content:
{content}

Generate exactly {count} flashcards. Return ONLY a valid JSON array (no markdown, no code fences):
[{{"front": "Question text here?", "back": "Answer text here."}}]"""

CLOZE_PROMPT = """You are a world-class study material creator. Generate fill-in-the-blank (cloze deletion) exercises from the given lesson content.

RULES:
- Identify KEY TERMS and IMPORTANT CONCEPTS that the student should remember
- For each item, the blank should be a single important word, term, or short phrase (1-3 words)
- The surrounding text must provide enough context to make the answer inferrable
- Vary the position of the blank (sometimes at the end, sometimes in the middle)
- Focus on: vocabulary terms, important names, key numbers/dates, critical concepts
- NEVER blank out trivial or obvious words
- NEVER create blanks where multiple answers could be correct

Lesson title: {title}
Lesson content:
{content}

Generate exactly {count} cloze items. Return ONLY a valid JSON array (no markdown, no code fences):
[{{"before": "The text that comes before the blank...", "blank": "correctAnswer", "after": "...the text that comes after the blank."}}]"""

PRACTICE_PROMPT = """You are a world-class assessment creator. Generate practice questions from the given lesson content that truly test understanding.

QUESTION TYPES TO USE:
- "multiple_choice": A question with 4 options, exactly one correct. Distractors must be plausible but clearly wrong.
- "true_false": A statement that is clearly true or false based on the content. Must not be ambiguous.
- "short_answer": An open-ended question requiring a specific correct answer (1-2 sentences).

RULES:
- Design questions that measure COMPREHENSION, not just recall
- Multiple choice distractors should be COMMON MISCONCEPTIONS or plausible but incorrect interpretations
- True/false statements should test understanding of nuances, not trivial facts
- Short answer questions should require synthesis or explanation
- Each question must be answerable based SOLELY on the given content
- Difficulty should vary: some easy, some medium, some challenging
- NEVER include trick questions or ambiguous wording
- For each question, include a brief explanation of why the answer is correct

Lesson title: {title}
Lesson content:
{content}

Generate exactly {count} questions. Distribute across types (mostly multiple_choice, some true_false, some short_answer).
Return ONLY a valid JSON array (no markdown, no code fences):
[{{
  "type": "multiple_choice",
  "question": "Question text?",
  "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
  "correct_answer": "A) option1",
  "explanation": "Brief explanation"
}}]"""

SUMMARY_PROMPT = """You are a world-class study material creator. Create a comprehensive but concise summary of the given lesson content.

RULES:
- Organize into logical sections with clear headings
- Each section should have 3-5 bullet points covering the key information
- Focus on: main concepts, important definitions, key relationships, critical steps/processes
- Omit: examples, anecdotes, redundant explanations, tangents
- Use clear, simple language that's easy to review quickly
- The summary should be complete enough that someone could study from it alone
- Total length: approximately 20-30% of the original content length

Lesson title: {title}
Lesson content:
{content}

Return ONLY a valid JSON object (no markdown, no code fences):
{{
  "sections": [
    {{"title": "Section Heading", "points": ["Point 1", "Point 2", "Point 3"]}}
  ]
}}"""
