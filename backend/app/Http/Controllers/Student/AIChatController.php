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

        // 1. Verify student is enrolled in class
        $enrollment = Enrollment::where('student_id', $student->id)
            ->where('class_id', $classId)
            ->first();

        if (!$enrollment) {
            return response()->json(['error' => 'Not enrolled in this class'], 403);
        }

        // 2. Determine mode and check if AI is enabled
        $mode = 'normal';
        $currentLessonContent = '';
        $contextMetadata = [];

        if ($lessonId) {
            $lesson = Lesson::with('module.course')->find($lessonId);

            if (!$lesson || $lesson->module->course->class_id != $classId) {
                return response()->json(['error' => 'Invalid lesson'], 403);
            }

            if (!$lesson->ai_enabled) {
                return response()->json(['error' => 'AI assistance not available for this lesson'], 403);
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
                return response()->json(['error' => 'Invalid quiz'], 403);
            }

            if (!$quiz->ai_enabled) {
                return response()->json(['error' => 'AI assistance not available for this quiz'], 403);
            }

            $mode = 'restricted';
            $contextMetadata = [
                'quiz_title' => $quiz->title,
                'module_name' => $quiz->module->title,
            ];

            // Check if student is asking about a quiz question directly
            $isQuestionMatch = $this->messageMatchesQuizQuestion($message, $quiz->questions);
            if ($isQuestionMatch) {
                return response()->json([
                    'answer' => "I can't answer that directly during a quiz. That's one of the questions you're working on! Try solving it yourself first, and I can help if you get stuck.",
                    'mode' => 'restricted',
                ]);
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

        // 4. Call FastAPI
        try {
            $response = Http::timeout(30)->post(env('AI_SERVICE_URL') . '/ai/tutor-chat', [
                'class_id' => $classId,
                'question' => $message,
                'character_name' => $characterName,
                'mode' => $mode,
                'current_lesson_content' => $currentLessonContent,
                'lesson_content' => $lessonContent,
                'quiz_content' => $request->quiz_content,
                'chat_history' => $chatHistory,
                'lesson_id' => $lessonId,
            ]);

            if (!$response->successful()) {
                return response()->json(['error' => 'AI service error'], 500);
            }

            $answer = $response->json()['answer'];

        } catch (\Exception $e) {
            \Log::error('AI tutor error: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to connect to AI service'], 500);
        }

        // 5. Save both messages
        AiChatLog::create([
            'student_id' => $student->id,
            'class_id' => $classId,
            'character_name' => $characterName,
            'lesson_id' => $lessonId,
            'quiz_id' => $quizId,
            'message' => $message,
            'sender' => 'student',
            'mode' => $mode,
            'context_metadata' => $contextMetadata,
        ]);

        AiChatLog::create([
            'student_id' => $student->id,
            'class_id' => $classId,
            'character_name' => $characterName,
            'lesson_id' => $lessonId,
            'quiz_id' => $quizId,
            'message' => $answer,
            'sender' => 'ai',
            'mode' => $mode,
            'context_metadata' => $contextMetadata,
        ]);

        return response()->json([
            'answer' => $answer,
            'mode' => $mode,
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

    private function extractLessonText($content): string
    {
        if (!is_array($content)) return '';

        $text = '';
        foreach ($content as $block) {
            if (!is_array($block)) continue;

            if (isset($block['type'])) {
                if ($block['type'] === 'heading' && isset($block['data']['text'])) {
                    $text .= $block['data']['text'] . "\n\n";
                } elseif ($block['type'] === 'paragraph' && isset($block['data']['text'])) {
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
            if (stripos($questionText, $msgPhrase) !== false) {
                return true;
            }
        }

        return false;
    }
}
