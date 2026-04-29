<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\StudentAnswer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB; 

class QuizController extends Controller
{
    // Fetch Quiz but HIDE expected_output so students can't cheat via Network Tab
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $quiz = Quiz::with(['questions' => function ($q) {
            $q->select('id', 'quiz_id', 'question_text', 'type', 'options', 'points'); 
        }])->findOrFail($id);

        // 1. Check for the LATEST completed attempt
        $completedAttempt = QuizAttempt::where('student_id', $user->id)
            ->where('quiz_id', $id)
            ->where('status', 'completed')
            ->latest()
            ->first();

        $existingResult = null;

        if ($completedAttempt) {
            $existingResult = [
                'score' => $completedAttempt->total_score,
                'max_score' => $quiz->questions->sum('points'),
                // Map details so the student can review their previous answers
                'details' => $quiz->questions->map(function($q) use ($completedAttempt) {
                    $ans = $completedAttempt->answers()->where('question_id', $q->id)->first();
                    return [
                        'question_text' => $q->question_text,
                        'is_correct' => $ans ? $ans->is_correct : false,
                        'correct_answer' => $q->type === 'multiple_choice' 
                            ? ($q->options[$q->expected_output] ?? 'N/A') 
                            : $q->expected_output
                    ];
                })
            ];
        }

        return response()->json([
            'quiz' => $quiz,
            'existing_result' => $existingResult,
            // We still send saved_answers if we want them to resume (only if status is in_progress)
            'attempt_id' => $completedAttempt ? $completedAttempt->id : null,
        ]);
    }

    public function startAttempt(Request $request, $id)
    {
        $attempt = QuizAttempt::create([
            'student_id' => $request->user()->id,
            'quiz_id' => $id,
            'status' => 'in_progress',
            'total_score' => 0
        ]);

        return response()->json([
            'attempt_id' => $attempt->id
        ]);
    }

    public function saveAnswer(Request $request, $attemptId)
    {
        $request->validate([
            'question_id' => 'required|exists:questions,id',
            'answer' => 'required|string'
        ]);

        StudentAnswer::updateOrCreate(
            [
                'attempt_id' => $attemptId,
                'question_id' => $request->question_id
            ],
            [
                'submitted_answer' => $request->answer,
                'answered_at' => now()
            ]
        );

        return response()->json([
            'message' => 'Draft saved'
        ]);
    }

    public function submit(Request $request, $quizId)
    {
        return DB::transaction(function () use ($request, $quizId) {
            $user = $request->user();
            $quiz = Quiz::with('questions')->findOrFail($quizId);
            $submittedAnswers = $request->answers; 

            $attempt = QuizAttempt::create([
                'student_id' => $user->id,
                'quiz_id' => $quizId,
                'status' => 'completed',
                'total_score' => 0,
                'finished_at' => now()
            ]);

            $totalScore = 0;

            foreach ($quiz->questions as $question) {
                $rawAnswer = $submittedAnswers[$question->id] ?? null;
                $isCorrect = false;

                if ($question->type === 'coding') {
                    // --- PRO MOVE: RE-RUN CODE ON BACKEND ---
                    try {
                        $engineUrl = env('EXECUTION_ENGINE_URL');
                        
                        $response = Http::timeout(20)->post($engineUrl, [
                            'language' => 'java',
                            'code' => $rawAnswer,
                        ]);

                        $output = trim($response->json()['stdout'] ?? '');
                        $expected = trim($question->expected_output);

                        if ($output === $expected && $expected !== "") {
                            $isCorrect = true;
                        }
                    } catch (\Exception $e) {
                        $isCorrect = false; // Fail safe if engine is down
                    }
                } 
                elseif ($question->type === 'multiple_choice') {
                    $isCorrect = (string)$rawAnswer === (string)$question->expected_output;
                } 
                elseif ($question->type === 'enumeration') {
                    // $rawAnswer is an array from the new UI
                    $correctItems = array_map('trim', explode(',', strtolower($question->expected_output)));
                    $studentItems = array_map('trim', array_map('strtolower', (array)$rawAnswer));
                    $isCorrect = count(array_intersect($correctItems, $studentItems)) === count($correctItems);
                }
                else {
                    // Identification and True/False
                    $isCorrect = strtolower(trim((string)$rawAnswer)) === strtolower(trim((string)$question->expected_output));
                }

                // Save the Answer (Exactly one row per question)
                StudentAnswer::create([
                    'attempt_id' => $attempt->id,
                    'question_id' => $question->id,
                    'submitted_answer' => is_array($rawAnswer) ? json_encode($rawAnswer) : (string)$rawAnswer,
                    'is_correct' => $isCorrect,
                    'answered_at' => now()
                ]);

                if ($isCorrect) $totalScore += $question->points;
            }

            $attempt->update(['total_score' => $totalScore]);

            return response()->json([
                'score' => $totalScore,
                'max_score' => $quiz->questions->sum('points'),
                'details' => $quiz->questions->map(function($q) use ($submittedAnswers, $attempt) {
                    // Find the specific answer record we just created in this transaction
                    $ansRecord = \App\Models\StudentAnswer::where('attempt_id', $attempt->id)
                        ->where('question_id', $q->id)
                        ->first();

                    return [
                        'question_text' => $q->question_text,
                        'is_correct' => $ansRecord ? $ansRecord->is_correct : false,
                        'correct_answer' => $q->type === 'multiple_choice' 
                            ? ($q->options[$q->expected_output] ?? 'N/A') 
                            : $q->expected_output
                    ];
                })
            ]);
        });
    }

}
