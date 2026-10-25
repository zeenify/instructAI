<?php

namespace App\Support;

use Illuminate\Support\Collection;

/**
 * Shared grading engine for coding questions with test cases. Used by BOTH
 * the quiz submit path (QuizController) and activity grading (ActivityGrading)
 * so the two surfaces always score identically.
 */
class CodingQuestionGrader
{
    /**
     * Run $code once per test case and score it.
     *
     * Scoring policy: all-or-nothing by default — every test must pass for
     * full points. When $partialCredit is enabled the question awards
     * points × (tests passed / total) instead.
     *
     * An infrastructure outage (engine unreachable) never punishes the
     * student: the result is flagged with engine_error so the caller can send
     * the submission to teacher review instead of scoring a silent zero.
     *
     * @param  Collection<int, QuestionTestCase>|array  $testCases
     * @return array{earned: float, passed: int, total: int, is_correct: bool, tests: array<int, array{passed: bool, hidden: bool, timed_out?: bool, engine_error?: bool, input?: string, expected_output?: string, actual_output?: string, stderr?: string}>, engine_error: bool}
     */
    public static function gradeTestCases(string $language, string $code, $testCases, float $points, bool $partialCredit = false): array
    {
        $testCases = $testCases instanceof Collection ? $testCases->values() : collect($testCases);

        $passed = 0;
        $engineError = false;
        $tests = [];

        // One compile, every test input — grading used to compile the same
        // submission per test case, which on a cold free-tier engine pushed
        // whole submissions past timeouts. Grading runs in the background, so
        // it also asks the engine for patient runs (25s): under class load the
        // shared CPU can make a CORRECT program exceed the interactive 10s
        // cap, which used to score it as an infinite loop.
        $batch = CodeRunner::executeBatch(
            $language,
            $code,
            $testCases->map(fn ($tc) => (string) ($tc->input ?? ''))->all(),
            25000
        );

        $batchEngineError = ! empty($batch['engine_error']) || ! empty($batch['compile_timed_out']);
        $compileError = trim((string) ($batch['compile_output'] ?? ''));

        foreach ($testCases as $index => $testCase) {
            // A compile failure (student's own syntax error, or the engine
            // being busy) fails every case with that diagnostic; infra
            // failures are flagged, never scored.
            $run = $batch['results'][$index] ?? null;
            $runEngineError = $batchEngineError;
            if ($runEngineError) {
                $engineError = true;
            }

            $expected = CodeRunner::normalizeOutput((string) $testCase->expected_output);
            $actual = CodeRunner::normalizeOutput((string) ($run['stdout'] ?? ''));

            $ok = ! $runEngineError
                && $compileError === ''
                && $run !== null
                && ! ($run['timed_out'] ?? false)
                && $actual === $expected;

            $entry = [
                'passed' => $ok,
                'hidden' => (bool) $testCase->hidden,
                'timed_out' => (bool) ($run['timed_out'] ?? false),
                'engine_error' => $runEngineError,
            ];

            // Hidden cases are verdict-only. Quizzes can be retaken after a
            // failed attempt, so their inputs/expected/outputs must never
            // travel to the student — this array is persisted AND rendered by
            // the review screen, redacting later would be too easy to miss.
            if (! $testCase->hidden) {
                $entry['input'] = self::clip((string) ($testCase->input ?? ''));
                $entry['expected_output'] = self::clip($expected);
                $entry['actual_output'] = self::clip($actual);
                $entry['stderr'] = self::clip($compileError !== '' ? $compileError : (string) ($run['stderr'] ?? ''));
            }

            $tests[] = $entry;
            if ($ok) {
                $passed++;
            }
        }

        // A timed-out run under class load is usually the engine CPU being
        // oversubscribed, not the student's infinite loop — in load tests,
        // byte-identical correct code timed out for one student and passed
        // 3/3 for her classmates seconds later. Before believing a timeout,
        // re-run ONLY the timed-out inputs once, after a short breather.
        // Still-slow retries keep the timeout verdict (real infinite loops
        // stay failed, just with a patient cap).
        $timedOutIdx = [];
        foreach ($tests as $i => $t) {
            if (! empty($t['timed_out']) && empty($t['engine_error'])) {
                $timedOutIdx[] = $i;
            }
        }
        if ($timedOutIdx !== [] && ! $batchEngineError) {
            sleep(5);
            $retry = CodeRunner::executeBatch(
                $language,
                $code,
                collect($timedOutIdx)->map(fn ($i) => (string) ($testCases[$i]->input ?? ''))->all(),
                25000
            );
            $retryClean = empty($retry['engine_error'])
                && empty($retry['compile_timed_out'])
                && trim((string) ($retry['compile_output'] ?? '')) === '';
            if ($retryClean) {
                foreach ($timedOutIdx as $round => $i) {
                    $run = $retry['results'][$round] ?? null;
                    if ($run === null || ! empty($run['timed_out'])) {
                        continue;
                    }
                    $expected = CodeRunner::normalizeOutput((string) $testCases[$i]->expected_output);
                    $actual = CodeRunner::normalizeOutput((string) ($run['stdout'] ?? ''));
                    $tests[$i]['timed_out'] = false;
                    $tests[$i]['passed'] = $actual === $expected;
                    if (! $testCases[$i]->hidden) {
                        $tests[$i]['actual_output'] = self::clip($actual);
                        $tests[$i]['stderr'] = self::clip((string) ($run['stderr'] ?? ''));
                    }
                }
                $passed = collect($tests)->filter(fn ($t) => ! empty($t['passed']))->count();
            }
        }

        $total = $testCases->count();
        $allPassed = $total > 0 && $passed === $total;

        $earned = 0.0;
        if (! $engineError) {
            $earned = $allPassed
                ? (float) $points
                : ($partialCredit ? round(((float) $points) * $passed / max($total, 1), 2) : 0.0);
        }

        return [
            'earned' => $earned,
            'passed' => $passed,
            'total' => $total,
            'is_correct' => $allPassed,
            'tests' => $tests,
            'engine_error' => $engineError,
        ];
    }

    /**
     * Mirror of the client-side normalizeHtmlChecks: the quick "expected
     * output" text always counts as one more page-text check so the server
     * grades exactly the checklist the student saw.
     *
     * @param  array<int, array<string, mixed>>  $checks
     */
    public static function withLegacyExpected(array $checks, ?string $legacyExpected): array
    {
        $text = trim((string) $legacyExpected);
        if ($text === '') {
            return $checks;
        }

        foreach ($checks as $check) {
            if (($check['kind'] ?? null) === 'page-text'
                && trim((string) ($check['text'] ?? '')) === $text) {
                return $checks; // already covered by an explicit page-text check
            }
        }

        $checks[] = [
            'id' => 'page-text-auto',
            'kind' => 'page-text',
            'text' => $text,
            'label' => 'Page contains "' . $text . '"',
        ];

        return $checks;
    }

    /**
     * Grade an HTML question from its page checks, using the results the
     * student's browser reported for this submission. All checks must pass
     * for full points — HTML checks are a completion gate, mirroring the
     * lesson-challenge behavior.
     *
     * @param  array<int, array{id?: string, label?: string, ...}>  $checks  teacher-authored checks
     * @param  array<string, bool>  $reported  checkId => passed, from the preview iframe
     * @return array{earned: float, passed: int, total: int, is_correct: bool, checks: array<int, array{id: string, label: string, passed: bool}>, engine_error: bool}
     */
    public static function gradeHtmlChecks(float $points, array $checks, array $reported): array
    {
        $total = count($checks);
        $normalized = [];
        $passed = 0;

        foreach (array_values($checks) as $index => $check) {
            $id = (string) ($check['id'] ?? ('check-' . $index));
            $ok = (bool) ($reported[$id] ?? false);

            $normalized[] = [
                'id' => $id,
                'label' => (string) ($check['label'] ?? ('Check ' . ($index + 1))),
                'passed' => $ok,
            ];
            if ($ok) {
                $passed++;
            }
        }

        $allPassed = $total > 0 && $passed === $total;

        return [
            'earned' => $allPassed ? (float) $points : 0.0,
            'passed' => $passed,
            'total' => $total,
            'is_correct' => $allPassed,
            'checks' => $normalized,
            'engine_error' => false,
        ];
    }

    /**
     * Run a teacher's reference solution against every test case — powers the
     * "Verify" button in the test-case editor. Returns per-test diagnostics.
     * "Runtime not installed" is a server setup issue, not a wrong answer: it
     * comes back as environment_error so the UI renders a distinct banner
     * instead of a per-test "got …" row.
     *
     * @param  Collection<int, QuestionTestCase>|array  $testCases
     * @return array{passed: int, total: int, all_passed: bool, engine_error?: bool, environment_error?: string, results: array<int, array{test_case_index: int, passed: bool, input: string, expected_output: string, actual_output: string, compile_output: string, stderr: string, timed_out: bool}>}
     */
    public static function verifyReference(string $language, string $referenceCode, $testCases): array
    {
        $testCases = $testCases instanceof Collection ? $testCases->values() : collect($testCases);

        $passed = 0;
        $results = [];

        foreach ($testCases as $index => $testCase) {
            $run = CodeRunner::execute(
                $language,
                $referenceCode,
                ($testCase->input ?? '') !== '' ? $testCase->input : null
            );

            if (! empty($run['engine_error'])) {
                return [
                    'passed' => $passed,
                    'total' => $testCases->count(),
                    'all_passed' => false,
                    'engine_error' => true,
                    'environment_error' => (string) $run['stderr'],
                    'results' => $results,
                ];
            }

            $ok = ! $run['timed_out']
                && CodeRunner::normalizeOutput($run['stdout']) === CodeRunner::normalizeOutput((string) $testCase->expected_output);

            if ($ok) {
                $passed++;
            }

            $results[] = [
                'test_case_index' => $index,
                'passed' => $ok,
                'input' => (string) $testCase->input,
                'expected_output' => (string) $testCase->expected_output,
                'actual_output' => (string) $run['stdout'],
                'compile_output' => (string) $run['compile_output'],
                'stderr' => (string) $run['stderr'],
                'timed_out' => (bool) $run['timed_out'],
            ];
        }

        $total = $testCases->count();

        return [
            'passed' => $passed,
            'total' => $total,
            'all_passed' => $total > 0 && $passed === $total,
            'results' => $results,
        ];
    }

    /**
     * Per-case snapshots ride inside a JSON column and are shown in a review
     * table — keep one runaway program from storing megabytes of stdout.
     */
    private static function clip(string $value, int $limit = 2000): string
    {
        if (mb_strlen($value) <= $limit) {
            return $value;
        }

        return mb_substr($value, 0, $limit) . '…';
    }
}
