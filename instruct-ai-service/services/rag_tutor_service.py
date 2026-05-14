from config.characters import get_character
from services.embedding_service import embedding_service
from services.retrieval_service import retrieval_service
from utils.groq_client_pool import GroqClientPool

class RAGTutorService:
    def __init__(self):
        self.groq_pool = GroqClientPool()

    def detect_question_depth(self, question: str) -> str:
        """Detect if question is casual/simple or deep/complex"""
        # Casual indicators: short, simple language, greetings, single word
        casual_indicators = ['hi', 'hey', 'hello', 'thanks', 'ok', 'cool', 'what is', 'how do i', 'why', 'when']
        question_lower = question.lower().strip()

        # If very short (under 10 chars), likely casual
        if len(question) < 10:
            return 'casual'

        # If multiple punctuation marks, complex
        if question.count('?') > 1 or question.count(',') > 2:
            return 'deep'

        # If contains complex keywords, deep
        deep_keywords = ['explain', 'compare', 'analyze', 'design', 'implement', 'solve', 'how does', 'why does', 'difference between', 'give an example']
        if any(keyword in question_lower for keyword in deep_keywords):
            return 'deep'

        # If contains casual keywords, casual
        if any(indicator in question_lower for indicator in casual_indicators):
            return 'casual'

        # Default to casual for short questions
        if len(question) < 30:
            return 'casual'

        return 'deep'

    def build_prompt(self,
                     character_name: str,
                     mode: str,
                     question: str,
                     current_lesson_content: str,
                     retrieved_context: list,
                     chat_history: list,
                     lesson_content: str = None,
                     quiz_content: str = None) -> list:
        """Build prompt with character, context, and history"""

        character = get_character(character_name)

        # Detect question depth
        question_depth = self.detect_question_depth(question)

        # Base system prompt
        system_content = f"{character['personality']}\n\n"

        # Mode-specific instructions
        if mode == "restricted":
            system_content += """🚫 RESTRICTED MODE - QUIZ/CHALLENGE IN PROGRESS 🚫
⛔ STRICT ASSESSMENT MODE - NO ANSWERS ALLOWED ⛔

ABSOLUTE RULES (DO NOT VIOLATE):
1. ❌ NEVER reveal the correct answer (multiple choice, true/false, identification, coding, or any type)
2. ❌ NEVER confirm if their answer is correct or even close
3. ❌ NEVER say "that's right", "correct", "yes", "exactly", "good", or any confirmation
4. ❌ NEVER provide the solution code, pseudocode, algorithm, or working implementation
5. ❌ NEVER give step-by-step instructions that directly lead to the answer
6. ❌ NEVER directly answer identification questions or fill-in-the-blank
7. ❌ NEVER provide hints that are so specific they reveal the answer
8. ❌ NEVER analyze their work and show corrections
9. ✅ ONLY: Ask guiding questions, point to concepts in the lesson, suggest they review material

FOR MULTIPLE CHOICE / TRUE FALSE:
- ❌ DO NOT hint which option is correct
- ❌ DO NOT say "not that one" or "not A and B, so it's C"
- ✅ ASK: "What concept does this question test?", "Can you explain what each option means?"

FOR CODE CHALLENGES:
- ❌ DO NOT fix their code or show how to fix it
- ❌ DO NOT write any working code
- ✅ ASK: "What error did you get?", "What do you think this line does?", "Try a different approach"

FOR IDENTIFICATION / SHORT ANSWER:
- ❌ DO NOT give the term, definition, or answer
- ❌ DO NOT say "close" or guide them letter by letter to the answer
- ✅ ASK: "What section of the lesson covers this?", "What do you remember about this concept?"

IF THEY ASK DIRECTLY: "Can you just tell me the answer?"
- RESPOND: "I can't do that - it defeats the purpose of the assessment. But I can help you think through it. What concepts are relevant here?"

YOUR GOAL: They must figure it out themselves. Hints should make them think, not solve it for them.
"""
        else:
            system_content += """You can answer questions fully and helpfully. Provide clear explanations, examples, step-by-step guidance, and code samples when appropriate.
"""

        # Response length guidance based on question depth
        if question_depth == 'casual':
            system_content += "\nRESPONSE LENGTH: Keep it SHORT and conversational. 1-2 sentences max.\n"
        else:  # deep
            system_content += "\nRESPONSE LENGTH: Provide detailed, thorough answers with step-by-step explanations, examples, and context as needed.\n"

        # PRIORITY 1: Add the EXACT lesson/quiz the student is currently viewing
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

Use this quiz context to provide hints about the questions. Remember you're in RESTRICTED mode, so give hints but NOT direct answers.
"""

        # PRIORITY 2: Add current lesson context (if different)
        if current_lesson_content and current_lesson_content != lesson_content:
            system_content += f"\nADDITIONAL LESSON CONTEXT:\n{current_lesson_content[:1500]}\n"

        # PRIORITY 3: Add retrieved context from RAG
        if retrieved_context:
            context_text = "\n\n".join([f"[Source {i+1}]: {chunk['text']}" for i, chunk in enumerate(retrieved_context)])
            system_content += f"\nRELATED COURSE MATERIALS (from other lessons):\n{context_text}\n"

        system_content += """
FORMATTING & TONE:
- Use markdown code blocks: ```language code ```
- Use **bold** for important terms
- Use bullet points and numbered lists for clarity
- Keep paragraphs short (2-3 sentences)
- Be conversational and encouraging
- Add blank lines between sections

RESPONSE STRATEGY:
- Lead with a clarifying question or observation
- Provide hints or concepts without solutions
- End with a guiding question that helps them debug/think
- If showing any code, make it an example from the LESSON only, never new working solutions"""

        # Build messages
        messages = [{"role": "system", "content": system_content}]

        # Add chat history (last 8 messages)
        for msg in chat_history[-8:]:
            messages.append({
                "role": "assistant" if msg['sender'] == 'ai' else "user",
                "content": msg['message']
            })

        # Add current question
        messages.append({"role": "user", "content": question})

        return messages

    def chat(self,
             class_id: int,
             question: str,
             character_name: str,
             mode: str,
             current_lesson_content: str,
             chat_history: list,
             lesson_id: int = None,
             lesson_content: str = None,
             quiz_content: str = None) -> str:
        """RAG-powered chat with current lesson/quiz context"""

        # Detect question depth
        question_depth = self.detect_question_depth(question)

        print(f"\n[RAG CHAT] Starting chat")
        print(f"  class_id: {class_id}")
        print(f"  question: {question[:50]}...")
        print(f"  question_depth: {question_depth}")
        print(f"  character: {character_name}")
        print(f"  mode: {mode}")
        print(f"  lesson_id: {lesson_id}")
        print(f"  has_lesson_content: {lesson_content is not None}")

        # 1. Embed question
        print(f"[RAG CHAT] Embedding question...")
        query_embedding = embedding_service.embed_text(question)
        print(f"[RAG CHAT] Embedding done, dimension: {len(query_embedding)}")

        # 2. Retrieve relevant context
        print(f"[RAG CHAT] Retrieving context from class {class_id}...")
        retrieved_context = retrieval_service.search(class_id, query_embedding, top_k=2, lesson_id=lesson_id)
        print(f"[RAG CHAT] Retrieved {len(retrieved_context)} chunks")

        # 3. Build prompt
        print(f"[RAG CHAT] Building prompt...")
        messages = self.build_prompt(
            character_name=character_name,
            mode=mode,
            question=question,
            current_lesson_content=current_lesson_content,
            retrieved_context=retrieved_context,
            chat_history=chat_history,
            lesson_content=lesson_content,
            quiz_content=quiz_content
        )
        print(f"[RAG CHAT] Prompt built with {len(messages)} messages")

        # 4. Call Groq LLM with rotating keys
        print(f"[RAG CHAT] Calling Groq LLM...")
        try:
            client, key_num = self.groq_pool.get_available_client()
            print(f"[RAG CHAT] Using key {key_num}")

            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                temperature=0.7,
                max_tokens=1000
            )

            self.groq_pool.mark_success(key_num)
            answer = response.choices[0].message.content
            print(f"[RAG CHAT] Got answer: {answer[:50]}...")
            return answer
        except Exception as e:
            print(f"[RAG CHAT ERROR] LLM call failed: {str(e)}")
            if "rate_limit" in str(e).lower():
                self.groq_pool.mark_rate_limited(key_num, backoff_seconds=60)
            raise

rag_tutor_service = RAGTutorService()
