<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\StudentAnswer;
use App\Support\CodeRunner;
use App\Support\CodingQuestionGrader;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class QuizController extends Controller
{
    // Fetch Quiz but HIDE expected_output so students can't cheat via Network Tab
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $quiz = Quiz::with('module.course')->findOrFail($id);

        $query = $quiz->questions()
            ->select('id', 'quiz_id', 'question_text', 'type', 'options', 'points', 'boilerplate', 'language', 'html_checks')
            ->with(['testCases' => fn ($q) => $q->select('id', 'testable_type', 'testable_id', 'input', 'expected_output', 'hidden', 'order_index')
                ->where('hidden', false)
                ->orderBy('order_index')]);

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

        // Sample (non-hidden) test cases show students the I/O contract —
        // essential for input-dependent problems.
        $questions->each(function ($q) {
            $q->sample_tests = $q->testCases
                ->map(fn ($t) => ['input' => (string) $t->input, 'expected_output' => (string) $t->expected_output])
                ->values();
        });

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
            // Load ALL answers once, then look them up from memory (fixes N+1)
            $allAnswers = $completedAttempt->answers()
                ->whereIn('question_id', $quiz->questions->pluck('id'))
                ->get()
                ->keyBy('question_id');

            $existingResult = [
                'score' => $completedAttempt->total_score,
                'max_score' => $completedAttempt->max_score,
                'details' => $quiz->questions->map(function ($q) use ($allAnswers) {
                    $ans = $allAnswers->get($q->id);
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
                        'student_answer_text' => $studentAnswerText,
                        'test_results' => $ans?->test_results,
                    ];
                })->values(), // <-- Ensures previous results are also flat arrays
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
            'total_score' => 0,
        ]);

        return response()->json([
            'attempt_id' => $attempt->id,
        ]);
    }

    public function saveAnswer(Request $request, $attemptId)
    {
        $request->validate([
            'question_id' => 'required|exists:questions,id',
            'answer' => 'required|string|max:5000',
        ]);

        // Ownership: a student may only write draft answers to their own attempt
        $attempt = QuizAttempt::where('id', $attemptId)
            ->where('student_id', $request->user()->id)
            ->firstOrFail();

        StudentAnswer::updateOrCreate(
            [
                'attempt_id' => $attempt->id,
                'question_id' => $request->question_id,
            ],
            [
                'submitted_answer' => $request->answer,
                'answered_at' => now(),
            ]
        );

        return response()->json([
            'message' => 'Draft saved',
        ]);
    }

    public function submit(Request $request, $quizId)
    {
        $request->validate([
            'answers' => 'required|array|max:500',
            'answers.*' => 'nullable',
            'question_ids' => 'nullable|array|max:500',
            'question_ids.*' => 'integer|min:1',
            // Client-side HTML page-check results (from the sandboxed preview
            // iframe) — only trusted for HTML questions configured with checks.
            'html_check_results' => 'nullable|array|max:500',
        ]);

        $user = $request->user();
        $quiz = Quiz::with(['questions' => fn ($q) => $q->with(['testCases' => fn ($t) => $t->orderBy('order_index')])])->findOrFail($quizId);
        $submittedAnswers = $request->answers ?? [];

        // Filter questions to ONLY the ones the frontend actually showed the student
        $subsetIds = $request->input('question_ids', []);
        $activeQuestions = $quiz->questions->whereIn('id', $subsetIds)->values();

        $attemptMaxScore = $activeQuestions->sum('points');

        // Engine + AI work happens OUTSIDE the DB transaction — executions can
        // take seconds each and must never hold a write lock that long.
        $checks = $this->runAutoChecks($activeQuestions, $submittedAnswers, (array) $request->input('html_check_results', []));

        return DB::transaction(function () use ($quizId, $user, $activeQuestions, $submittedAnswers, $attemptMaxScore, $checks) {
            $attempt = QuizAttempt::create([
                'student_id' => $user->id,
                'quiz_id' => $quizId,
                'status' => 'completed',
                'total_score' => 0,
                'max_score' => $attemptMaxScore,
                'finished_at' => now(),
            ]);

            $totalScore = 0;
            $detailedResults = [];

            foreach ($activeQuestions as $question) {
                $rawAnswer = $submittedAnswers[$question->id] ?? null;
                $isCorrect = false;
                $earned = 0.0;
                $testResults = null;
                $aiUnavailable = false;
                $engineUnavailable = false;

                if ($question->type === 'coding' && isset($checks['gradedCoding'][$question->id])) {
                    // Test-case graded (IO tests or HTML page checks)
                    $graded = $checks['gradedCoding'][$question->id];
                    $isCorrect = $graded['is_correct'];
                    $earned = $graded['earned'];
                    $testResults = isset($graded['checks'])
                        ? ['passed' => $graded['passed'], 'total' => $graded['total'], 'checks' => $graded['checks']]
                        : ['passed' => $graded['passed'], 'total' => $graded['total'], 'tests' => $graded['tests']];
                    $engineUnavailable = (bool) ($graded['engine_error'] ?? false);
                } elseif ($question->type === 'coding') {
                    $lang = $question->language ?: 'java';

                    if ($lang === 'html') {
                        // HTML goes straight to AI (no server runtime). When the AI
                        // service is unreachable we can't judge markup — mark it
                        // honestly so the UI can show "pending teacher review".
                        $isCorrect = $checks['aiAvailable'] ? ($checks['aiResults'][$question->id] ?? false) : false;
                        $aiUnavailable = ! $checks['aiAvailable'];
                    } elseif (isset($checks['codingStageOne'][$question->id])) {
                        // Stage-1 output matched deterministically. AI stage-2 was
                        // only an anti-hardcoding check — if the AI service is
                        // down, a matched output must NOT be marked wrong.
                        $isCorrect = $checks['aiAvailable']
                            ? ($checks['aiResults'][$question->id] ?? true)
                            : true;
                    }
                    if ($isCorrect) {
                        $earned = (float) $question->points;
                    }
                } elseif ($question->type === 'multiple_choice') {
                    $isCorrect = (string) $rawAnswer === (string) $question->expected_output;
                    if ($isCorrect) {
                        $earned = (float) $question->points;
                    }
                } elseif ($question->type === 'enumeration') {
                    if (! $rawAnswer || (is_array($rawAnswer) && empty(array_filter($rawAnswer)))) {
                        $isCorrect = false;
                    } else {
                        $correctItems = array_map(fn ($item) => strtolower(trim((string) $item)), $question->options);
                        $studentItems = array_map(fn ($item) => strtolower(trim((string) $item)), array_filter((array) $rawAnswer));
                        sort($correctItems);
                        sort($studentItems);

                        $isCorrect = $correctItems === $studentItems && count($studentItems) > 0;

                        // If exact match failed, check AI results
                        if (! $isCorrect && isset($checks['aiResults'][$question->id])) {
                            $isCorrect = $checks['aiResults'][$question->id];
                        }
                    }
                    if ($isCorrect) {
                        $earned = (float) $question->points;
                    }
                } elseif ($question->type === 'identification') {
                    $isCorrect = strtolower(trim((string) $rawAnswer)) === strtolower(trim((string) $question->expected_output));

                    if (! $isCorrect && isset($checks['aiResults'][$question->id])) {
                        $isCorrect = $checks['aiResults'][$question->id];
                    }
                    if ($isCorrect) {
                        $earned = (float) $question->points;
                    }
                } else {
                    // True/False and any other types
                    $isCorrect = strtolower(trim((string) $rawAnswer)) === strtolower(trim((string) $question->expected_output));
                    if ($isCorrect) {
                        $earned = (float) $question->points;
                    }
                }

                $totalScore += $earned;

                // Save the Answer (Exactly one row per question)
                StudentAnswer::create([
                    'attempt_id' => $attempt->id,
                    'question_id' => $question->id,
                    'submitted_answer' => is_array($rawAnswer) ? json_encode($rawAnswer) : (string) $rawAnswer,
                    'test_results' => $testResults,
                    'is_correct' => $isCorrect,
                    'answered_at' => now(),
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
                    'score' => round($earned, 2),
                    'correct_answer' => $correctAnswer,
                    'student_answer_text' => $studentAnswerText, // For multiple choice display
                    'test_results' => $testResults ? ['passed' => $testResults['passed'], 'total' => $testResults['total']] : null,
                    'ai_unavailable' => $aiUnavailable,
                    'engine_unavailable' => $engineUnavailable,
                ];
            }

            $attempt->update(['total_score' => round($totalScore, 2)]);

            $anyEngineUnavailable = collect($detailedResults)->contains(fn ($d) => $d['engine_unavailable']);

            return response()->json([
                'score' => round($totalScore, 2),
                'max_score' => $attemptMaxScore,
                'details' => $detailedResults,
                'engine_unavailable' => $anyEngineUnavailable,
            ]);
        });
    }

    /**
     * Runs every engine/AI-dependent check BEFORE the grading transaction:
     * test-case execution for coding questions, legacy stage-1 output matching,
     * and collection of questions that need the AI batch service.
     */
    private function runAutoChecks($activeQuestions, array $submittedAnswers, array $htmlCheckResults = []): array
    {
        $questionsForAI = [];
        $aiQuestionMap = [];
        $codingStageOne = [];
        $gradedCoding = [];

        foreach ($activeQuestions as $question) {
            if (! in_array($question->type, ['enumeration', 'identification', 'coding'])) {
                continue;
            }
            $rawAnswer = $submittedAnswers[$question->id] ?? null;

            if ($question->type === 'enumeration') {
                if ($rawAnswer && is_array($rawAnswer)) {
                    $studentItems = array_filter((array) $rawAnswer);
                    $correctItems = array_map(fn ($item) => strtolower(trim((string) $item)), $question->options);
                    $studentItems = array_map(fn ($item) => strtolower(trim((string) $item)), $studentItems);
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
                            'student_answer' => $studentItems,
                        ];
                        $aiQuestionMap[count($questionsForAI)] = $question->id;
                    }
                }
            } elseif ($question->type === 'identification') {
                if ($rawAnswer && strtolower(trim((string) $rawAnswer)) !== strtolower(trim((string) $question->expected_output))) {
                    $questionsForAI[] = [
                        'question_num' => count($questionsForAI) + 1,
                        'question_id' => $question->id,
                        'question_text' => $question->question_text,
                        'type' => 'identification',
                        'correct_answer' => $question->expected_output,
                        'student_answer' => (string) $rawAnswer,
                    ];
                    $aiQuestionMap[count($questionsForAI)] = $question->id;
                }
            } elseif ($question->type === 'coding') {
                if (! $rawAnswer || ! is_string($rawAnswer) || trim($rawAnswer) === '') {
                    continue;
                }

                $lang = $question->language ?: 'java';
                $testCases = $question->testCases->values();

                if ($testCases->isNotEmpty() && $lang !== 'html') {
                    // Test-case path: one engine run per test with its stdin,
                    // normalized stdout comparison. All-or-nothing by default;
                    // partial credit only when the question opts in.
                    $gradedCoding[$question->id] = CodingQuestionGrader::gradeTestCases(
                        $lang,
                        $rawAnswer,
                        $testCases,
                        (float) $question->points,
                        (bool) $question->partial_credit
                    );
                } elseif ($lang === 'html' && ! empty($question->html_checks)) {
                    // HTML page checks run in the student's browser against the
                    // rendered page (freeCodeCamp-style checklist). Grade from
                    // the results the frontend reported with this submission.
                    $reported = $htmlCheckResults[$question->id] ?? null;
                    if (is_array($reported)) {
                        $gradedCoding[$question->id] = CodingQuestionGrader::gradeHtmlChecks(
                            (float) $question->points,
                            CodingQuestionGrader::withLegacyExpected($question->html_checks, $question->expected_output),
                            $reported
                        );
                    }
                    // No reported results → fall through to the AI/review path
                    // below so an unrun submission still gets judged.
                    if (isset($gradedCoding[$question->id])) {
                        continue;
                    }

                    $questionsForAI[] = [
                        'question_num' => count($questionsForAI) + 1,
                        'question_id' => $question->id,
                        'question_text' => $question->question_text,
                        'type' => 'coding',
                        'language' => 'html',
                        'code' => $rawAnswer,
                        'expected_output' => trim((string) $question->expected_output),
                        'output_matched' => false,
                    ];
                    $aiQuestionMap[count($questionsForAI)] = $question->id;
                } elseif ($lang === 'html') {
                    // HTML has no server runtime — let the AI judge the markup.
                    $questionsForAI[] = [
                        'question_num' => count($questionsForAI) + 1,
                        'question_id' => $question->id,
                        'question_text' => $question->question_text,
                        'type' => 'coding',
                        'language' => 'html',
                        'code' => $rawAnswer,
                        'expected_output' => trim((string) $question->expected_output),
                        'output_matched' => false,
                    ];
                    $aiQuestionMap[count($questionsForAI)] = $question->id;
                } else {
                    // Legacy path: stage-1 deterministic output match, then the
                    // AI service verifies the code isn't hardcoded (stage-2).
                    $run = CodeRunner::execute($lang, $rawAnswer);
                    $output = CodeRunner::normalizeOutput($run['stdout']);
                    $expected = CodeRunner::normalizeOutput((string) $question->expected_output);

                    if ($expected !== '' && $output === $expected) {
                        $codingStageOne[$question->id] = true;
                        $questionsForAI[] = [
                            'question_num' => count($questionsForAI) + 1,
                            'question_id' => $question->id,
                            'question_text' => $question->question_text,
                            'type' => 'coding',
                            'language' => $lang,
                            'code' => $rawAnswer,
                            'expected_output' => trim((string) $question->expected_output),
                            'output_matched' => true,
                        ];
                        $aiQuestionMap[count($questionsForAI)] = $question->id;
                    }
                }
            }
        }

        $ai = $this->callAiBatch($questionsForAI);

        // Map AI results back to question ids
        $aiResults = [];
        foreach ($ai['results'] as $questionNum => $isCorrect) {
            if (isset($aiQuestionMap[$questionNum])) {
                $aiResults[$aiQuestionMap[$questionNum]] = $isCorrect;
            }
        }

        return [
            'aiResults' => $aiResults,
            'aiAvailable' => $ai['available'],
            'codingStageOne' => $codingStageOne,
            'gradedCoding' => $gradedCoding,
        ];
    }

    /**
     * Calls the AI batch endpoint. Returns `available: false` when the service
     * is unreachable so callers can apply their no-AI fallbacks instead of
     * silently marking everything wrong.
     */
    private function callAiBatch(array $questionsForAI): array
    {
        if (empty($questionsForAI)) {
            return ['results' => [], 'available' => true];
        }

        try {
            $aiUrl = env('AI_SERVICE_URL', 'http://localhost:8001');
            Log::info('QuizController: Sending questions to AI', ['count' => count($questionsForAI)]);
            $aiResponse = Http::timeout(10)->withHeaders(\App\Services\AiService::authHeader())->post("{$aiUrl}/ai/check-answers-batch", [
                'questions' => $questionsForAI,
            ]);

            if ($aiResponse->successful()) {
                $results = [];
                foreach ($aiResponse->json()['results'] ?? [] as $result) {
                    $results[$result['question_num']] = (bool) $result['is_correct'];
                }

                return ['results' => $results, 'available' => true];
            }

            Log::warning('QuizController: AI response not successful', ['status' => $aiResponse->status()]);
        } catch (\Throwable $e) {
            Log::error('QuizController: AI check failed', ['error' => $e->getMessage()]);
        }

        return ['results' => [], 'available' => false];
    }
}
