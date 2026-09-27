from config.characters import get_character
from services.embedding_service import embedding_service
from services.retrieval_service import retrieval_service
from utils.ai_client_pool import AIClientPool, is_rate_limit_error
from config.models import GEN_CONTENT_MODEL
import json

# Shared prompt blocks. Personality comes from config/characters.py; these
# blocks carry the behavior contract that must survive regardless of persona.

LANGUAGE_POLICY = """LANGUAGE (MUST follow exactly):
1. Choose the reply language from the STUDENT'S LAST MESSAGE ONLY.
2. If it contains zero Tagalog/Filipino words, reply in FULL ENGLISH — no
   Tagalog openers, connectors, or fillers (no "ay", "naman", "parang",
   "po", "sige", "natin", "gusto mo", etc.), even if earlier chat history
   or your persona suggests otherwise.
3. If it uses ANY Tagalog or Taglish, reply in natural Taglish — the casual
   Filipino-English mix students actually use, where the explanation itself
   flows in Taglish. Never stiff, formal Tagalog.
4. Technical terms, code, and identifiers always stay in English.
"""

TOPIC_SCOPE = """TOPIC SCOPE:
- You are a school tutor for Penaranda Senior High School. ALWAYS IN SCOPE
  (answer normally, even with no lesson context provided): schoolwork of any
  kind — programming, math, science, English, Filipino, and study skills —
  plus the student's lessons, quizzes, activities, and course materials.
- OUT OF SCOPE: video games as a topic, celebrities, sports, romance, personal
  gossip, general trivia unrelated to school.
- If a question is out of scope, refuse briefly and stay fully in character:
  one short in-persona line saying you only cover schoolwork, then redirect
  to the current material. Never lecture; never break character.
"""

NORMAL_RULES = """ASSESSMENT MODE: FREE HELP
The student is studying (not inside a quiz or graded challenge), so help fully:
- Explain concepts clearly, then show worked examples and correct code when the
  subject calls for it.
- Structure answers: short direct answer or explanation first, then the
  step-by-step, then a quick check-for-understanding question.
- If they ask for their exact homework answer with no effort shown, teach the
  method with a similar example first, then invite them to try theirs.
"""

RESTRICTED_RULES = """ASSESSMENT MODE: RESTRICTED — QUIZ/CHALLENGE IN PROGRESS
The student is inside a live quiz or graded coding challenge. ABSOLUTE RULES:
1. NEVER reveal the correct answer (any question type) and never confirm or
   deny whether their attempt is right or close ("that's right", "not A and B",
   "close" — all banned).
2. NEVER provide solution code, pseudocode, or a step-by-step path that
   directly produces the answer.
3. NEVER give hints specific enough to reveal the answer.
4. ONLY: ask guiding questions, point to the relevant concept or lesson
   section, suggest what to review.
- Multiple choice / true-false: ask what concept the item tests; never rank or
  eliminate options.
- Coding: ask what error they got or what a suspect line does; suggest a
  different approach in words only.
- Identification / short answer: ask what lesson section covers it; never give
  the term or definitions narrow enough to be the answer.
- If they ask you to just tell them the answer: stay in character, say you
  can't during an assessment, and offer to think it through with them instead.
"""

FORMATTING = """FORMATTING:
- Markdown: fenced code blocks with the language tag, **bold** for key terms,
  bullets/numbered steps for procedures.
- Short paragraphs (2-3 sentences), blank lines between sections.
- Stay in character in every reply — the persona must come through even when
  you refuse, redirect, or keep an answer short.
"""

TOOLS_NOTE = """TOOL — search_course_materials:
You have a tool that searches the student's class course library (their
lessons, notes, and examples across the whole course). Call it with a focused
search query whenever the student's question might relate to their coursework
beyond the lesson currently on their screen. You may call it up to two times
with different queries, then answer using what you found. Small-talk and
questions about the on-screen lesson don't need it.
"""

# Context budgets (chars). The model's window is ~1M tokens, so these exist
# only to keep worst-case prompts a sane share of the API's per-minute token
# budget — sized so ordinary content NEVER clips (a big lesson extracts to
# ~15-40k chars; 60k covers all but pathological cases).
MAX_LESSON_CHARS = 60000
MAX_QUIZ_CHARS = 12000
MAX_CHUNK_CHARS = 4000
HISTORY_TURNS = 12
HISTORY_MSG_CHARS = 8000  # per-message; AI answers top out ~5-6k, only guards pasted walls of text

SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "search_course_materials",
        "description": (
            "Search the student's class course library — their lessons, notes, "
            "and examples across the whole course — for passages relevant to a "
            "search query."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Focused search phrase, e.g. 'while loop exit condition' or 'array sorting example'.",
                },
            },
            "required": ["query"],
        },
    },
}


def _clip(text, limit, label=None):
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    if label:
        print(f"[CONTEXT] {label} clipped {len(text)} -> {limit} chars")
    return text[:limit] + "\n…(truncated)"


class RAGTutorService:
    def __init__(self):
        self.ai_pool = AIClientPool()

    def detect_question_depth(self, question: str) -> str:
        """Detect if question is casual/simple or deep/complex"""
        casual_indicators = ['hi', 'hey', 'hello', 'thanks', 'ok', 'cool', 'what is', 'how do i', 'why', 'when']
        question_lower = question.lower().strip()

        if len(question) < 10:
            return 'casual'

        if question.count('?') > 1 or question.count(',') > 2:
            return 'deep'

        deep_keywords = ['explain', 'compare', 'analyze', 'design', 'implement', 'solve', 'how does', 'why does', 'difference between', 'give an example']
        if any(keyword in question_lower for keyword in deep_keywords):
            return 'deep'

        if any(indicator in question_lower for indicator in casual_indicators):
            return 'casual'

        if len(question) < 30:
            return 'casual'

        return 'deep'

    def _prepare_messages(self,
                          character_name: str,
                          mode: str,
                          question: str,
                          chat_history: list,
                          lesson_content: str = None,
                          quiz_content: str = None) -> list:
        """System prompt + history + question. Retrieval now happens through
        the search_course_materials tool instead of pre-stuffed chunks."""

        character = get_character(character_name)
        question_depth = self.detect_question_depth(question)

        system_content = character['personality'] + "\n\n"

        system_content += RESTRICTED_RULES if mode == "restricted" else NORMAL_RULES
        system_content += "\n" + TOPIC_SCOPE + "\n" + LANGUAGE_POLICY + "\n" + TOOLS_NOTE

        if question_depth == 'casual':
            system_content += "\nRESPONSE LENGTH: Keep it SHORT and conversational — 1-3 sentences unless code is needed.\n"
        else:
            system_content += "\nRESPONSE LENGTH: Give a thorough answer — steps, examples, and context as needed, but no padding.\n"

        system_content += "\n" + FORMATTING

        # The lesson/quiz the student is viewing right now (server-extracted
        # text from Laravel — the client never supplies this anymore)
        if lesson_content:
            system_content += f"""
═══════════════════════════════════════════════════════════════
THIS IS THE LESSON THE STUDENT IS CURRENTLY VIEWING:
═══════════════════════════════════════════════════════════════
{_clip(lesson_content, MAX_LESSON_CHARS, "lesson")}
═══════════════════════════════════════════════════════════════

When the student refers to "this", "this code", "the challenge", etc.,
they mean something in the lesson above.
"""

        if quiz_content:
            system_content += f"""
═══════════════════════════════════════════════════════════════
THE QUIZ ITEM THE STUDENT IS CURRENTLY ON (no answers included):
═══════════════════════════════════════════════════════════════
{_clip(quiz_content, MAX_QUIZ_CHARS, "quiz")}
═══════════════════════════════════════════════════════════════

You are in RESTRICTED mode — concept hints only, never the answer.
"""

        messages = [{"role": "system", "content": system_content}]

        for msg in chat_history[-HISTORY_TURNS:]:
            messages.append({
                "role": "assistant" if msg['sender'] == 'ai' else "user",
                "content": _clip(msg['message'], HISTORY_MSG_CHARS, "history message"),
            })

        messages.append({"role": "user", "content": question})
        return messages

    def _search(self, course_key: int, query: str, lesson_id: int = None) -> str:
        """Embed a search query and format the top course-scoped chunks"""
        try:
            query_embedding = embedding_service.embed_text(query)
            chunks = retrieval_service.search(course_key, query_embedding, top_k=2, lesson_id=lesson_id)
        except Exception as e:
            print(f"[TOOL SEARCH ERROR] {type(e).__name__}: {e}")
            return json.dumps({"error": "search temporarily unavailable — answer from your own knowledge"})

        if not chunks:
            return json.dumps({"results": [], "note": "No matching course material found — answer from your own knowledge."})

        results = [{"source": i + 1, "text": _clip(c['text'], MAX_CHUNK_CHARS)} for i, c in enumerate(chunks)]
        return json.dumps({"results": results})

    def chat(self,
             class_id: int,
             question: str,
             character_name: str,
             mode: str,
             current_lesson_content: str,
             chat_history: list,
             lesson_id: int = None,
             lesson_content: str = None,
             quiz_content: str = None,
             course_id: int = None) -> str:
        """Non-streaming variant (legacy fallback) — same pipeline, joined"""
        return "".join(self.chat_stream(
            class_id=class_id,
            question=question,
            character_name=character_name,
            mode=mode,
            current_lesson_content=current_lesson_content,
            chat_history=chat_history,
            lesson_id=lesson_id,
            lesson_content=lesson_content,
            quiz_content=quiz_content,
            course_id=course_id,
        ))

    def chat_stream(self,
                    class_id: int,
                    question: str,
                    character_name: str,
                    mode: str,
                    current_lesson_content: str,
                    chat_history: list,
                    lesson_id: int = None,
                    lesson_content: str = None,
                    quiz_content: str = None,
                    course_id: int = None):
        """Yield the answer as text deltas.

        Retrieval is agentic: the planner pass decides whether to call the
        search_course_materials tool (max 2 calls), then the final pass streams.
        """
        course_key = course_id or class_id
        print(f"\n[RAG CHAT] course_key={course_key} character={character_name} mode={mode} depth={self.detect_question_depth(question)}")

        messages = self._prepare_messages(
            character_name=character_name,
            mode=mode,
            question=question,
            chat_history=chat_history,
            lesson_content=lesson_content,
            quiz_content=quiz_content,
        )

        client, key_num = self.ai_pool.get_available_client()
        try:
            # Planner pass(es): may emit tool calls before the answer
            for _round in range(2):
                response = client.chat.completions.create(
                    model=GEN_CONTENT_MODEL,
                    messages=messages,
                    tools=[SEARCH_TOOL],
                    temperature=0.7,
                    max_tokens=1200,
                )
                self.ai_pool.mark_success(key_num)
                choice = response.choices[0].message

                if not choice.tool_calls:
                    # Direct answer without retrieval — emit as-is
                    if choice.content:
                        yield choice.content
                    return

                # Feed tool results back as a plain user message. Echoing the
                # assistant's tool_calls verbatim trips Gemini 3.5's
                # thought_signature requirement on the compat endpoint.
                for tc in choice.tool_calls:
                    try:
                        args = json.loads(tc.function.arguments or "{}")
                    except json.JSONDecodeError:
                        args = {}
                    query = (args.get("query") or question).strip()
                    print(f"[TOOL CALL] search_course_materials: {query!r}")
                    result = self._search(course_key, query, lesson_id)
                    messages.append({
                        "role": "user",
                        "content": (
                            f"[Tool result — search_course_materials({query!r})]\n"
                            f"{result}\n\n"
                            "Use these findings (if relevant) to keep helping the student."
                        ),
                    })

            # Final pass: tools removed so the answer must come now, streamed
            stream = client.chat.completions.create(
                model=GEN_CONTENT_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=1200,
                stream=True,
            )
            emitted = False
            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                content = getattr(delta, "content", None)
                if content:
                    emitted = True
                    yield content
            if not emitted:
                # Gemini can return an empty completion under tight prompts;
                # never leave the student with a blank reply
                yield "Hmm, I'm drawing a blank on that one — could you rephrase it, or point me at a specific part of your lesson?"
            self.ai_pool.mark_success(key_num)
        except Exception as e:
            print(f"[RAG CHAT ERROR] {type(e).__name__}: {str(e)}")
            if is_rate_limit_error(e):
                self.ai_pool.mark_rate_limited(key_num, backoff_seconds=60)
            raise

rag_tutor_service = RAGTutorService()
