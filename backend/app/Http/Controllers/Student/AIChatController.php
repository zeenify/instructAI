<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\AiChatLog;
use App\Models\Lesson;
use App\Models\Quiz;
use App\Models\Enrollment;
use Illuminate\Support\Facades\Http;

class AIChatController extends Controller
{
    public function chat(Request $request)
    {
        [$error, $ctx] = $this->prepareChat($request);
        if ($error) {
            return $error;
        }

        try {
            $response = Http::timeout(60)->post(env('AI_SERVICE_URL') . '/ai/tutor-chat', $ctx['payload']);

            if (!$response->successful()) {
                return response()->json(['error' => 'AI service error'], 500);
            }

            $answer = $response->json()['answer'];
        } catch (\Exception $e) {
            \Log::error('AI tutor error: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to connect to AI service'], 500);
        }

        $this->saveTurn($ctx, $answer);

        return response()->json([
            'answer' => $answer,
            'mode' => $ctx['mode'],
        ]);
    }

    /**
     * Streaming variant: same checks as chat(), then the Python service's
     * answer is piped through to the browser chunk by chunk. Chat history is
     * persisted after the stream completes.
     */
    public function chatStream(Request $request)
    {
        [$error, $ctx] = $this->prepareChat($request);
        if ($error) {
            return $error;
        }

        $this->saveStudentTurn($ctx);

        return response()->stream(function () use ($ctx) {
            try {
                $response = Http::timeout(120)
                    ->withOptions(['stream' => true])
                    ->post(env('AI_SERVICE_URL') . '/ai/tutor-chat-stream', $ctx['payload']);

                if (!$response->successful()) {
                    echo '(The tutoring service is not responding right now — please try again in a moment.)';
                    return;
                }

                $body = $response->toPsrResponse()->getBody();
                $full = '';
                while (!$body->eof()) {
                    $chunk = $body->read(1024);
                    if ($chunk === '') {
                        break;
                    }
                    $full .= $chunk;
                    echo $chunk;
                    while (ob_get_level() > 0) {
                        @ob_flush();
                    }
                    flush();
                }

                $this->saveAiTurn($ctx, $full);
            } catch (\Exception $e) {
                \Log::error('AI tutor stream error: ' . $e->getMessage());
                echo "\n\n(The connection dropped mid-answer — please send that again.)";
            }
        }, 200, [
            'Content-Type' => 'text/plain; charset=utf-8',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
            'X-Tutor-Mode' => $ctx['mode'],
        ]);
    }

    public function loadHistory(Request $request)
    {
        $request->validate([
            'class_id' => 'required|exists:classes,id',
            'character_name' => 'required|string',
        ]);

        $student = $request->user();
        $classId = $request->class_id;
        $characterName = $request->character_name;

        // Load last 10 messages across all lessons/quizzes with this character
        $messages = AiChatLog::forContext($student->id, $classId, $characterName)
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get()
            ->reverse()
            ->values();

        return response()->json(['messages' => $messages]);
    }

    public function clearHistory(Request $request)
    {
        $request->validate([
            'class_id' => 'required|exists:classes,id',
            'character_name' => 'required|string',
        ]);

        AiChatLog::where('student_id', $request->user()->id)
            ->where('class_id', $request->class_id)
            ->where('character_name', $request->character_name)
            ->delete();

        return response()->json(['cleared' => true]);
    }

    /**
     * Shared preflight for chat() / chatStream(): validate, authorize,
     * resolve context and mode, build the Python payload.
     * Returns [null, context] on success or [jsonResponse, null] on failure.
     */
    private function prepareChat(Request $request): array
    {
        $request->validate([
            'message' => 'required|string',
            'class_id' => 'required|exists:classes,id',
            'character_name' => 'required|string',
            'lesson_id' => 'nullable|exists:lessons,id',
            'quiz_id' => 'nullable|exists:quizzes,id',
            'lesson_content' => 'nullable|string',
            'quiz_content' => 'nullable|string',
        ]);

        $student = $request->user();
        $classId = $request->class_id;
        $characterName = $request->character_name;
        $lessonId = $request->lesson_id;
        $quizId = $request->quiz_id;
        $message = $request->message;
        $lessonContent = $request->input('lesson_content');

        $lesson = null;
        $quiz = null;

        // 1. Verify student is enrolled in class
        $enrollment = Enrollment::where('student_id', $student->id)
            ->where('class_id', $classId)
            ->first();

        if (!$enrollment) {
            return [response()->json(['error' => 'Not enrolled in this class'], 403), null];
        }

        // 2. Determine mode and check if AI is enabled
        $mode = 'normal';
        $currentLessonContent = '';
        $contextMetadata = [];

        if ($lessonId) {
            $lesson = Lesson::with('module.course')->find($lessonId);

            if (!$lesson || $lesson->module->course->class_id != $classId) {
                return [response()->json(['error' => 'Invalid lesson'], 403), null];
            }

            if (!$lesson->ai_enabled) {
                return [response()->json(['error' => 'AI assistance not available for this lesson'], 403), null];
            }

            // Extract text content from lesson JSON blocks
            $currentLessonContent = $this->extractLessonText($lesson->content);
            $contextMetadata = [
                'lesson_title' => $lesson->title,
                'module_name' => $lesson->module->title,
            ];

            // Check if in coding challenge mode
            if (is_array($lesson->content)) {
                foreach ($lesson->content as $block) {
                    if (is_array($block) && isset($block['type']) && $block['type'] === 'code') {
                        if (isset($block['data']['mode']) && $block['data']['mode'] === 'challenge') {
                            $mode = 'restricted';
                            break;
                        }
                    }
                }
            }
        }

        if ($quizId) {
            $quiz = Quiz::with('module.course', 'questions')->find($quizId);

            if (!$quiz || $quiz->module->course->class_id != $classId) {
                return [response()->json(['error' => 'Invalid quiz'], 403), null];
            }

            if (!$quiz->ai_enabled) {
                return [response()->json(['error' => 'AI assistance not available for this quiz'], 403), null];
            }

            $mode = 'restricted';
            $contextMetadata = [
                'quiz_title' => $quiz->title,
                'module_name' => $quiz->module->title,
            ];

            // Check if student is asking about a quiz question directly
            $isQuestionMatch = $this->messageMatchesQuizQuestion($message, $quiz->questions);
            if ($isQuestionMatch) {
                return [response()->json([
                    'answer' => "I can't answer that directly during a quiz. That's one of the questions you're working on! Try solving it yourself first, and I can help if you get stuck.",
                    'mode' => 'restricted',
                ]), null];
            }
        }

        // 3. Load chat history (last 10 messages for this student + class + character)
        $chatHistory = AiChatLog::forContext($student->id, $classId, $characterName)
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get()
            ->reverse()
            ->values()
            ->map(fn($log) => [
                'sender' => $log->sender,
                'message' => $log->message,
            ])
            ->toArray();

        // Retrieval is course-scoped: chunks are stored under the course,
        // so pass the course id of whatever the student is viewing
        $courseId = null;
        if ($lesson) {
            $courseId = $lesson->module->course_id;
        } elseif ($quiz) {
            $courseId = $quiz->module->course_id;
        }

        $ctx = [
            'student_id' => $student->id,
            'class_id' => $classId,
            'character_name' => $characterName,
            'lesson_id' => $lessonId,
            'quiz_id' => $quizId,
            'mode' => $mode,
            'context_metadata' => $contextMetadata,
            'payload' => [
                'class_id' => $classId,
                'course_id' => $courseId,
                'question' => $message,
                'character_name' => $characterName,
                'mode' => $mode,
                'current_lesson_content' => $currentLessonContent,
                'lesson_content' => $lessonContent,
                'quiz_content' => $request->quiz_content,
                'chat_history' => $chatHistory,
                'lesson_id' => $lessonId,
            ],
        ];

        return [null, $ctx];
    }

    private function saveStudentTurn(array $ctx): void
    {
        AiChatLog::create([
            'student_id' => $ctx['student_id'],
            'class_id' => $ctx['class_id'],
            'character_name' => $ctx['character_name'],
            'lesson_id' => $ctx['lesson_id'],
            'quiz_id' => $ctx['quiz_id'],
            'message' => $ctx['payload']['question'],
            'sender' => 'student',
            'mode' => $ctx['mode'],
            'context_metadata' => $ctx['context_metadata'],
        ]);
    }

    private function saveAiTurn(array $ctx, string $answer): void
    {
        AiChatLog::create([
            'student_id' => $ctx['student_id'],
            'class_id' => $ctx['class_id'],
            'character_name' => $ctx['character_name'],
            'lesson_id' => $ctx['lesson_id'],
            'quiz_id' => $ctx['quiz_id'],
            'message' => $answer,
            'sender' => 'ai',
            'mode' => $ctx['mode'],
            'context_metadata' => $ctx['context_metadata'],
        ]);
    }

    private function saveTurn(array $ctx, string $answer): void
    {
        $this->saveStudentTurn($ctx);
        $this->saveAiTurn($ctx, $answer);
    }

    private function extractLessonText($content): string
    {
        if (!is_array($content)) return '';

        $text = '';
        foreach ($content as $block) {
            if (!is_array($block)) continue;

            if (isset($block['type'])) {
                if (($block['type'] === 'heading' || $block['type'] === 'h1') && isset($block['data']['text'])) {
                    $text .= $block['data']['text'] . "\n\n";
                } elseif (($block['type'] === 'paragraph' || $block['type'] === 'text') && isset($block['data']['text'])) {
                    $text .= $block['data']['text'] . "\n\n";
                } elseif ($block['type'] === 'code' && isset($block['data']['description'])) {
                    $text .= "Code example: " . $block['data']['description'] . "\n\n";
                }
            }
        }

        return trim($text);
    }

    private function messageMatchesQuizQuestion($message, $questions): bool
    {
        // Normalize message for comparison
        $msgLower = strtolower(trim($message));
        $msgWords = preg_split('/\s+/', $msgLower);

        foreach ($questions as $question) {
            $questionText = strtolower($question->question_text);
            $questionWords = preg_split('/\s+/', $questionText);

            // Check if message contains significant portion of question (50%+ overlap)
            $commonWords = array_intersect($msgWords, $questionWords);
            $overlap = count($commonWords) / max(count($msgWords), count($questionWords));

            if ($overlap >= 0.5) {
                return true;
            }

            // Also check for partial phrase match (first 10-15 words)
            $msgPhrase = implode(' ', array_slice($msgWords, 0, 15));
            if ($msgPhrase !== '' && stripos($questionText, $msgPhrase) !== false) {
                return true;
            }
        }

        return false;
    }
}
