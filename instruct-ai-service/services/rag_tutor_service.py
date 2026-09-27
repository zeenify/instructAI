from config.characters import get_character
from services.embedding_service import embedding_service
from services.retrieval_service import retrieval_service
from utils.ai_client_pool import AIClientPool, is_rate_limit_error
from config.models import GEN_CONTENT_MODEL

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
- You are a school tutor for Penaranda Senior High School. IN SCOPE: the
  student's lessons, quizzes, activities, and course materials (including the
  context provided below), AND their school subjects in general — e.g.
  programming, math, science, English — even if the exact topic is not in the
  provided context.
- OUT OF SCOPE: games as a topic, celebrities, sports, romance, personal chat,
  general trivia, and anything unrelated to schoolwork.
- If a question is out of scope, refuse briefly and stay fully in character:
  one short in-persona line saying you only cover schoolwork, then redirect to
  the current material. Never lecture; never break character.
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
                          current_lesson_content: str,
                          retrieved_context: list,
                          chat_history: list,
                          lesson_content: str = None,
                          quiz_content: str = None) -> list:
        """Build the full message list: system prompt + history + question"""

        character = get_character(character_name)
        question_depth = self.detect_question_depth(question)

        system_content = character['personality'] + "\n\n"

        system_content += RESTRICTED_RULES if mode == "restricted" else NORMAL_RULES
        system_content += "\n" + TOPIC_SCOPE + "\n" + LANGUAGE_POLICY

        if question_depth == 'casual':
            system_content += "\nRESPONSE LENGTH: Keep it SHORT and conversational — 1-3 sentences unless code is needed.\n"
        else:
            system_content += "\nRESPONSE LENGTH: Give a thorough answer — steps, examples, and context as needed, but no padding.\n"

        system_content += "\n" + FORMATTING

        # PRIORITY 1: the exact lesson/quiz the student is viewing right now
        if lesson_content:
            system_content += f"""
═══════════════════════════════════════════════════════════════
THIS IS THE EXACT LESSON THE STUDENT IS CURRENTLY VIEWING:
═══════════════════════════════════════════════════════════════
{lesson_content}
═══════════════════════════════════════════════════════════════

When the student refers to "this", "this code", "this exercise", "the challenge", etc.,
they are referring to something in the lesson above. Use this content to understand their exact context.
"""

        if quiz_content:
            system_content += f"""
═══════════════════════════════════════════════════════════════
THIS IS THE EXACT QUIZ THE STUDENT IS CURRENTLY TAKING:
═══════════════════════════════════════════════════════════════
{quiz_content}
═══════════════════════════════════════════════════════════════

Use this quiz context for hints about the topics. You are in RESTRICTED mode — hints only, never answers.
"""

        # PRIORITY 2: the containing lesson's extracted text (if different)
        if current_lesson_content and current_lesson_content != lesson_content:
            system_content += f"\nADDITIONAL LESSON CONTEXT:\n{current_lesson_content[:1500]}\n"

        # PRIORITY 3: RAG chunks from elsewhere in the course
        if retrieved_context:
            context_text = "\n\n".join([f"[Source {i+1}]: {chunk['text']}" for i, chunk in enumerate(retrieved_context)])
            system_content += f"\nRELATED COURSE MATERIALS (from other lessons):\n{context_text}\n"

        messages = [{"role": "system", "content": system_content}]

        for msg in chat_history[-8:]:
            messages.append({
                "role": "assistant" if msg['sender'] == 'ai' else "user",
                "content": msg['message']
            })

        messages.append({"role": "user", "content": question})
        return messages

    def _retrieve(self, class_id: int, course_id: int, question: str, lesson_id: int):
        """Embed the question and pull course-scoped chunks"""
        query_embedding = embedding_service.embed_text(question)
        # Chunks are stored under course_id; class_id is a legacy fallback
        return retrieval_service.search(course_id or class_id, query_embedding, top_k=2, lesson_id=lesson_id)

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
        """RAG-powered chat with current lesson/quiz context (non-streaming)"""

        print(f"\n[RAG CHAT] class_id={class_id} course_id={course_id} character={character_name} mode={mode} depth={self.detect_question_depth(question)}")

        retrieved_context = self._retrieve(class_id, course_id, question, lesson_id)
        print(f"[RAG CHAT] Retrieved {len(retrieved_context)} chunks")

        messages = self._prepare_messages(
            character_name=character_name,
            mode=mode,
            question=question,
            current_lesson_content=current_lesson_content,
            retrieved_context=retrieved_context,
            chat_history=chat_history,
            lesson_content=lesson_content,
            quiz_content=quiz_content
        )

        return self._complete(messages)

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
        """Same as chat() but yields text chunks as they arrive"""
        print(f"\n[RAG CHAT STREAM] class_id={class_id} course_id={course_id} character={character_name} mode={mode}")

        retrieved_context = self._retrieve(class_id, course_id, question, lesson_id)
        print(f"[RAG CHAT STREAM] Retrieved {len(retrieved_context)} chunks")

        messages = self._prepare_messages(
            character_name=character_name,
            mode=mode,
            question=question,
            current_lesson_content=current_lesson_content,
            retrieved_context=retrieved_context,
            chat_history=chat_history,
            lesson_content=lesson_content,
            quiz_content=quiz_content
        )

        yield from self._complete_stream(messages)

    def _complete(self, messages) -> str:
        """One-shot completion with key rotation and rate-limit backoff"""
        client, key_num = self.ai_pool.get_available_client()
        try:
            response = client.chat.completions.create(
                model=GEN_CONTENT_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=1200
            )
            self.ai_pool.mark_success(key_num)
            return response.choices[0].message.content
        except Exception as e:
            print(f"[RAG CHAT ERROR] LLM call failed: {str(e)}")
            if is_rate_limit_error(e):
                self.ai_pool.mark_rate_limited(key_num, backoff_seconds=60)
            raise

    def _complete_stream(self, messages):
        """Streaming completion; yields content deltas"""
        client, key_num = self.ai_pool.get_available_client()
        try:
            stream = client.chat.completions.create(
                model=GEN_CONTENT_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=1200,
                stream=True,
            )
            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                content = getattr(delta, "content", None)
                if content:
                    yield content
            self.ai_pool.mark_success(key_num)
        except Exception as e:
            print(f"[RAG CHAT STREAM ERROR] {str(e)}")
            if is_rate_limit_error(e):
                self.ai_pool.mark_rate_limited(key_num, backoff_seconds=60)
            raise

rag_tutor_service = RAGTutorService()
