<?php

namespace App\Support;

use App\Models\ActivityQuestion;
use App\Models\ActivitySubmission;
use App\Models\ClassActivity;

class ActivityGrading
{
    /**
     * @param  array<string, array<string, bool>>  $htmlCheckResults  optional
     *    per-question map of checkId => passed, reported by the student's
     *    browser for HTML questions that use page checks.
     */
    public static function grade(ActivityQuestion $question, $rawAnswer, array $htmlCheckResults = []): array
    {
        if ($rawAnswer === null || $rawAnswer === '') {
            return ['is_correct' => false, 'score' => 0.0];
        }

        if ($question->type === 'coding') {
            return self::gradeCoding($question, (string) $rawAnswer, $htmlCheckResults);
        }

        if ($question->type === 'essay') {
            return ['is_correct' => false, 'score' => 0.0];
        }

        if ($question->type === 'enumeration') {
            $correctItems = array_map(fn ($i) => strtolower(trim((string) $i)), $question->options ?? []);
            $correctItems = array_values(array_filter($correctItems, fn ($i) => $i !== ''));
            $studentItems = array_map(fn ($i) => strtolower(trim((string) $i)), (array) $rawAnswer);
            $studentItems = array_values(array_filter($studentItems, fn ($i) => $i !== ''));
            $studentItems = array_values(array_unique($studentItems));

            $correctCount = 0;
            foreach ($studentItems as $sItem) {
                if (in_array($sItem, $correctItems)) {
                    $correctCount++;
                }
            }

            $itemPoints = count($correctItems) > 0 ? $question->points / count($correctItems) : 0;

            return [
                'is_correct' => $correctCount === count($correctItems),
                'score' => round($correctCount * $itemPoints, 2),
            ];
        }

        $isCorrect = strtolower(trim((string) $rawAnswer)) === strtolower(trim((string) $question->expected_output));

        return [
            'is_correct' => $isCorrect,
            'score' => $isCorrect ? (float) $question->points : 0.0,
        ];
    }

    /**
     * Coding questions follow the exact same policy as quizzes: IO test cases
     * grade all-or-nothing (partial credit only when the question opts in),
     * HTML page checks are a completion gate graded from the student's
     * browser-reported results, and anything else stays with the teacher.
     */
    private static function gradeCoding(ActivityQuestion $question, string $rawAnswer, array $htmlCheckResults): array
    {
        $lang = $question->language ?: 'java';
        $testCases = $question->testCases->values();

        if ($testCases->isNotEmpty() && $lang !== 'html') {
            $graded = CodingQuestionGrader::gradeTestCases(
                $lang,
                $rawAnswer,
                $testCases,
                (float) $question->points,
                (bool) $question->partial_credit
            );

            return [
                'is_correct' => $graded['is_correct'],
                'score' => $graded['earned'],
                'test_results' => ['passed' => $graded['passed'], 'total' => $graded['total'], 'tests' => $graded['tests']],
            ];
        }

        if ($lang === 'html' && ! empty($question->html_checks)) {
            $reported = $htmlCheckResults[$question->id] ?? null;
            if (is_array($reported) && $reported !== []) {
                $graded = CodingQuestionGrader::gradeHtmlChecks(
                    (float) $question->points,
                    CodingQuestionGrader::withLegacyExpected($question->html_checks, $question->expected_output),
                    $reported
                );

                return [
                    'is_correct' => $graded['is_correct'],
                    'score' => $graded['earned'],
                    'test_results' => ['passed' => $graded['passed'], 'total' => $graded['total'], 'checks' => $graded['checks']],
                ];
            }

            // The student never ran the page — route to teacher review rather
            // than hard-zero an unjudged submission.
            return ['is_correct' => false, 'score' => 0.0];
        }

        // No tests and no checks -> manual grading (status quo)
        return ['is_correct' => false, 'score' => 0.0];
    }

    public static function normalizeAnswer($rawAnswer): string
    {
        return is_array($rawAnswer) ? json_encode($rawAnswer) : (string) $rawAnswer;
    }

    /**
     * Inverse of normalizeAnswer: stored strings are raw, arrays are JSON.
     */
    public static function decodeAnswer(string $stored)
    {
        $decoded = json_decode($stored, true);

        return json_last_error() === JSON_ERROR_NONE ? $decoded : $stored;
    }

    public static function finalizeSubmission(ActivitySubmission $submission, ClassActivity $activity, ?string $roomClosedAt = null): ActivitySubmission
    {
        $totalScore = 0;
        $hasManualTypes = false;

        $submission->loadMissing('answers');
        $activity->loadMissing('questions.testCases');

        foreach ($activity->questions as $question) {
            $answer = $submission->answers->firstWhere('question_id', $question->id);
            if (! $answer) {
                continue;
            }

            $raw = json_decode($answer->submitted_answer, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $raw = $answer->submitted_answer;
            }

            $result = static::grade($question, $raw);
            $answer->update([
                'is_correct' => $result['is_correct'],
                'score' => $result['score'],
                'test_results' => $result['test_results'] ?? null,
            ]);
            $totalScore += $result['score'];

            if (! self::autoGradable($question)) {
                $hasManualTypes = true;
            }
        }

        $submission->update([
            'status' => $hasManualTypes ? 'submitted' : 'graded',
            'score' => round($totalScore, 2),
            'max_score' => $activity->questions->sum('points'),
            'submitted_at' => now(),
            'graded_at' => $hasManualTypes ? null : now(),
            'room_closed_at' => $roomClosedAt,
        ]);

        return $submission->fresh();
    }

    /**
     * Mirror of the submit-path auto-gradability check, kept here so live-room
     * finalization and endLive use the same policy.
     */
    public static function autoGradable(ActivityQuestion $question): bool
    {
        if ($question->type === 'essay') {
            return false;
        }

        if ($question->type !== 'coding') {
            return true;
        }

        $lang = $question->language ?: 'java';

        return ($lang !== 'html' && $question->testCases->isNotEmpty())
            || ($lang === 'html' && ! empty($question->html_checks));
    }
}
