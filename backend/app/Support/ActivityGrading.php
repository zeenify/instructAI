<?php

namespace App\Support;

use App\Models\ActivityQuestion;
use App\Models\ActivitySubmission;
use App\Models\ClassActivity;

class ActivityGrading
{
    public static function grade(ActivityQuestion $question, $rawAnswer): array
    {
        if ($rawAnswer === null || $rawAnswer === '') {
            return ['is_correct' => false, 'score' => 0.0];
        }

        if (in_array($question->type, ['essay', 'coding'])) {
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
            ]);
            $totalScore += $result['score'];

            if (in_array($question->type, ['essay', 'coding'])) {
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
}
