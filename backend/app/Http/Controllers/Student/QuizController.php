<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\StudentAnswer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log; 

class QuizController extends Controller
{
    // Fetch Quiz but HIDE expected_output so students can't cheat via Network Tab
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $quiz = Quiz::with('module.course')->findOrFail($id);

        $query = $quiz->questions()->select('id', 'quiz_id', 'question_text', 'type', 'options', 'points', 'boilerplate');

        // Apply Pool Randomization logic
        if ($quiz->is_randomized) {
            $query->inRandomOrder();
            if ($quiz->question_limit) {
                $query->limit($quiz->question_limit);
            }
        } else {
            $query->orderBy('order_index', 'asc');
        }

        $questions = $query->get();
        // Manually attach questions to the quiz object for the response
        $quiz->setRelation('questions', $questions);

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
                'max_score' => $completedAttempt->max_score, // Use the stored max score
                // Map details so the student can review their previous answers
                'details' => $quiz->questions->map(function($q) use ($completedAttempt) {
                    $ans = $completedAttempt->answers()->where('question_id', $q->id)->first();
                    $correctAnswer = $q->type === 'multiple_choice'
                        ? ($q->options[$q->expected_output] ?? 'N/A')
                        : ($q->type === 'enumeration'
                            ? json_encode($q->options)
                            : $q->expected_output
                        );

                    // For multiple choice, get the student's answer text
                    $studentAnswerText = null;
                    if ($q->type === 'multiple_choice' && $ans) {
                        $submittedAnswer = json_decode($ans->submitted_answer, true);
                        if (is_array($submittedAnswer)) {
                            $submittedAnswer = $submittedAnswer[0] ?? null;
                        }
                        if ($submittedAnswer !== null) {
                            $studentAnswerText = $q->options[$submittedAnswer] ?? 'N/A';
                        }
                    }

                    return [
                        'question_id' => $q->id,
                        'question_text' => $q->question_text,
                        'type' => $q->type,
                        'is_correct' => $ans ? $ans->is_correct : false,
                        'correct_answer' => $correctAnswer,
                        'student_answer_text' => $studentAnswerText
                    ];
                })->values() // <-- Ensures previous results are also flat arrays
            ];
        }

        return response()->json([
            'quiz' => $quiz,
            'class_id' => $quiz->module->course->class_id,
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

// Filter questions to ONLY the ones the frontend actually showed the student
            $subsetIds = $request->input('question_ids', []);
            $activeQuestions = $quiz->questions->whereIn('id', $subsetIds);
            
            $attemptMaxScore = $activeQuestions->sum('points');

            $attempt = QuizAttempt::create([
                'student_id' => $user->id,
                'quiz_id' => $quizId,
                'status' => 'completed',
                'total_score' => 0,
                'max_score' => $attemptMaxScore,
                'finished_at' => now()
            ]);

            $totalScore = 0;
            $detailedResults = [];

            // Batch AI checking for enumeration, identification, and coding (stage 2 only)
            $questionsForAI = [];
            $aiQuestionMap = []; // Map question number to question ID
            Log::info('QuizController: Starting batch AI check', ['total_questions' => count($activeQuestions)]);
            foreach ($activeQuestions as $question) {
                if (in_array($question->type, ['enumeration', 'identification', 'coding'])) {
                    $rawAnswer = $submittedAnswers[$question->id] ?? null;

                    if ($question->type === 'enumeration') {
                        if ($rawAnswer && is_array($rawAnswer)) {
                            $studentItems = array_filter((array)$rawAnswer);
                            $correctItems = array_map(fn($item) => strtolower(trim((string)$item)), $question->options);
                            $studentItems = array_map(fn($item) => strtolower(trim((string)$item)), $studentItems);
                            sort($correctItems);
                            sort($studentItems);

                            // Only add to AI if exact match fails
                            if ($correctItems !== $studentItems || count($studentItems) === 0) {
                                $questionsForAI[] = [
                                    'question_num' => count($questionsForAI) + 1,
                                    'question_id' => $question->id,
                                    'question_text' => $question->question_text,
                                    'type' => 'enumeration',
                                    'correct_answer' => $question->options,
                                    'student_answer' => $studentItems
                                ];
                                $aiQuestionMap[count($questionsForAI)] = $question->id;
                            }
                        }
                    } elseif ($question->type === 'identification') {
                        if ($rawAnswer && strtolower(trim((string)$rawAnswer)) !== strtolower(trim((string)$question->expected_output))) {
                            $questionsForAI[] = [
                                'question_num' => count($questionsForAI) + 1,
                                'question_id' => $question->id,
                                'question_text' => $question->question_text,
                                'type' => 'identification',
                                'correct_answer' => $question->expected_output,
                                'student_answer' => (string)$rawAnswer
                            ];
                            $aiQuestionMap[count($questionsForAI)] = $question->id;
                        }
                    } elseif ($question->type === 'coding') {
                        // Coding: stage 1 check (output match), only forward to AI for stage 2 if passed
                        if ($rawAnswer) {
                            try {
                                $engineUrl = env('EXECUTION_ENGINE_URL');
                                $response = Http::timeout(20)->post($engineUrl, [
                                    'language' => 'java',
                                    'code' => $rawAnswer,
                                ]);

                                $output = trim($response->json()['stdout'] ?? '');
                                // Normalize line endings: convert \r\n to \n
                                $output = str_replace("\r\n", "\n", $output);
                                $expected = trim($question->expected_output);
                                $expected = str_replace("\r\n", "\n", $expected);

                                // Only forward to AI if output matches (stage 2 verification)
                                if ($output === $expected && $expected !== "") {
                                    $questionsForAI[] = [
                                        'question_num' => count($questionsForAI) + 1,
                                        'question_id' => $question->id,
                                        'question_text' => $question->question_text,
                                        'type' => 'coding',
                                        'code' => $rawAnswer,
                                        'expected_output' => $expected,
                                        'output_matched' => true
                                    ];
                                    $aiQuestionMap[count($questionsForAI)] = $question->id;
                                }
                            } catch (\Exception $e) {
                                Log::warning('QuizController: Code execution failed', ['error' => $e->getMessage()]);
                            }
                        }
                    }
                }
            }

            // Call AI batch endpoint if there are questions to check
            $aiResults = [];
            if (!empty($questionsForAI)) {
                Log::info('QuizController: Sending questions to AI', ['count' => count($questionsForAI), 'questions' => $questionsForAI]);
                try {
                    $aiUrl = env('AI_SERVICE_URL', 'http://localhost:8001');
                    Log::info('QuizController: AI Service URL', ['url' => $aiUrl]);
                    $aiResponse = Http::timeout(10)->post("{$aiUrl}/ai/check-answers-batch", [
                        'questions' => $questionsForAI
                    ]);

                    Log::info('QuizController: AI response received', ['status' => $aiResponse->status(), 'body' => $aiResponse->body()]);

                    if ($aiResponse->successful()) {
                        $responseData = $aiResponse->json();
                        Log::info('QuizController: AI results parsed', ['results' => $responseData]);
                        foreach ($responseData['results'] ?? [] as $result) {
                            $aiResults[$result['question_num']] = $result['is_correct'];
                        }
                    } else {
                        Log::warning('QuizController: AI response not successful', ['status' => $aiResponse->status()]);
                    }
                } catch (\Exception $e) {
                    Log::error('QuizController: AI check failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
                }
            } else {
                Log::info('QuizController: No questions needed AI checking (all exact matches passed)');
            }

            // Map AI results back to questions
            $aiCheckedQuestions = [];
            foreach ($aiResults as $questionNum => $isCorrect) {
                if (isset($aiQuestionMap[$questionNum])) {
                    $aiCheckedQuestions[$aiQuestionMap[$questionNum]] = $isCorrect;
                    Log::info('QuizController: AI result mapped', ['question_id' => $aiQuestionMap[$questionNum], 'is_correct' => $isCorrect]);
                }
            }

            foreach ($activeQuestions as $question) {
                $rawAnswer = $submittedAnswers[$question->id] ?? null;
                $isCorrect = false;

                if ($question->type === 'coding') {
                    // Stage 1: Output comparison (already done in batch section above)
                    // Check if this question went to AI for stage 2 verification
                    if (isset($aiCheckedQuestions[$question->id])) {
                        // AI verified legitimacy (not hardcoded)
                        $isCorrect = $aiCheckedQuestions[$question->id];
                        Log::info('QuizController: Coding - AI verified', ['question_id' => $question->id, 'is_correct' => $isCorrect]);
                    } else {
                        // Output didn't match, so it's wrong (won't reach here if it did match)
                        $isCorrect = false;
                    }
                } 
                elseif ($question->type === 'multiple_choice') {
                    $isCorrect = (string)$rawAnswer === (string)$question->expected_output;
                } 
                elseif ($question->type === 'enumeration') {
                    if (!$rawAnswer || (is_array($rawAnswer) && empty(array_filter($rawAnswer)))) {
                        $isCorrect = false;
                    } else {
                        $correctItems = $question->options;
                        $studentItems = array_filter((array)$rawAnswer);

                        $correctItems = array_map(function($item) {
                            return strtolower(trim((string)$item));
                        }, $correctItems);
                        $studentItems = array_map(function($item) {
                            return strtolower(trim((string)$item));
                        }, $studentItems);

                        sort($correctItems);
                        sort($studentItems);

                        $isCorrect = $correctItems === $studentItems && count($studentItems) > 0;

                        // If exact match failed, check AI results
                        if (!$isCorrect && isset($aiCheckedQuestions[$question->id])) {
                            $oldCorrect = $isCorrect;
                            $isCorrect = $aiCheckedQuestions[$question->id];
                            Log::info('QuizController: Enumeration - AI override', ['question_id' => $question->id, 'before' => $oldCorrect, 'after' => $isCorrect]);
                        }
                    }
                }
                elseif ($question->type === 'identification') {
                    $isCorrect = strtolower(trim((string)$rawAnswer)) === strtolower(trim((string)$question->expected_output));

                    // If exact match failed, check AI results
                    if (!$isCorrect && isset($aiCheckedQuestions[$question->id])) {
                        $oldCorrect = $isCorrect;
                        $isCorrect = $aiCheckedQuestions[$question->id];
                        Log::info('QuizController: Identification - AI override', ['question_id' => $question->id, 'expected' => $question->expected_output, 'student' => $rawAnswer, 'before' => $oldCorrect, 'after' => $isCorrect]);
                    }
                }
                else {
                    // True/False and any other types
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

                // Store detail for response
                $correctAnswer = $question->type === 'multiple_choice'
                    ? ($question->options[$question->expected_output] ?? 'N/A')
                    : ($question->type === 'enumeration'
                        ? json_encode($question->options) // Return options array as JSON string for enumeration
                        : $question->expected_output
                    );

                $studentAnswerText = $question->type === 'multiple_choice' && $rawAnswer !== null
                    ? ($question->options[$rawAnswer] ?? 'N/A')
                    : null;

                $detailedResults[] = [
                    'question_id' => $question->id,
                    'question_text' => $question->question_text,
                    'type' => $question->type,
                    'is_correct' => $isCorrect,
                    'correct_answer' => $correctAnswer,
                    'student_answer_text' => $studentAnswerText // For multiple choice display
                ];

                if ($isCorrect) $totalScore += $question->points;
            }

$attempt->update(['total_score' => $totalScore]);

return response()->json([
                'score' => $totalScore,
                'max_score' => $attemptMaxScore,
                'details' => $detailedResults
            ]);
        });
    }

}
