<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\ActivityQuestion;
use App\Models\QuestionTestCase;
use App\Support\CodingQuestionGrader;
use App\Support\CodeRunner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Test-case CRUD + reference-solution verification for ACTIVITY coding
 * questions. Mirrors Teacher\QuestionController so activities behave
 * exactly like quizzes; both share CodingQuestionGrader for grading.
 */
class ActivityQuestionController extends Controller
{
    /**
     * Ownership: question -> activity (carries its own teacher_id).
     */
    private function authorizeQuestion($id): ActivityQuestion
    {
        $question = ActivityQuestion::with('activity')->findOrFail($id);

        if (! $question->activity || $question->activity->teacher_id !== request()->user()->id) {
            abort(403, 'You do not own this question.');
        }

        return $question;
    }

    public function testCases($id)
    {
        $question = $this->authorizeQuestion($id);

        return response()->json([
            'test_cases' => $question->testCases()->get(['id', 'input', 'expected_output', 'hidden', 'order_index'])->values(),
            'reference_code' => $question->reference_code,
        ]);
    }

    /**
     * Bulk-replaces the test cases for an activity coding question. Sent as
     * one call from the authoring UI so ordering edits stay atomic.
     */
    public function updateTestCases(Request $request, $id)
    {
        $question = $this->authorizeQuestion($id);

        $validated = $request->validate([
            'test_cases' => 'required|array|max:20',
            'test_cases.*.input' => 'nullable|string|max:10000',
            'test_cases.*.expected_output' => 'required|string|max:10000',
            'test_cases.*.hidden' => 'boolean',
        ]);

        DB::transaction(function () use ($question, $validated) {
            $question->testCases()->delete();

            foreach ($validated['test_cases'] as $index => $testCase) {
                QuestionTestCase::create([
                    'testable_type' => ActivityQuestion::class,
                    'testable_id' => $question->id,
                    'input' => $testCase['input'] ?? '',
                    'expected_output' => $testCase['expected_output'],
                    'hidden' => (bool) ($testCase['hidden'] ?? false),
                    'order_index' => $index,
                ]);
            }
        });

        return response()->json([
            'test_cases' => $question->testCases()->get(['id', 'input', 'expected_output', 'hidden', 'order_index'])->values(),
        ]);
    }

    /**
     * Runs the teacher's reference solution against every test case so a
     * broken challenge is caught before students see it.
     */
    public function verify(Request $request, $id)
    {
        $question = $this->authorizeQuestion($id);

        $validated = $request->validate([
            'reference_code' => 'required|string|max:50000',
        ]);

        $lang = $question->language ?: 'java';
        $testCases = $question->testCases()->orderBy('order_index')->get();

        if ($testCases->isEmpty()) {
            return response()->json(['message' => 'Add at least one test case before verifying.'], 422);
        }

        if ($lang === 'html') {
            return response()->json(['message' => 'HTML questions are checked with page checks in the browser — use "Test page checks" instead.'], 422);
        }

        $question->update(['reference_code' => $validated['reference_code']]);

        return response()->json(
            CodingQuestionGrader::verifyReference($lang, $validated['reference_code'], $testCases)
        );
    }
}
