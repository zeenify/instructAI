<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Question;
use App\Models\QuestionTestCase;
use App\Support\CodingQuestionGrader;
use App\Support\CodeRunner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QuestionController extends Controller
{
    private function languageRule(): string
    {
        return 'nullable|string|in:'.implode(',', CodeRunner::LANGUAGES);
    }

    /**
     * Ownership: question -> quiz -> module -> course -> teacher. All mutating
     * question endpoints funnel through here so one teacher can never touch
     * another teacher's quiz questions.
     */
    private function authorizeQuestion($id): Question
    {
        $question = Question::with('quiz.module.course')->findOrFail($id);

        $course = $question->quiz->module->course ?? null;
        if (! $course || $course->teacher_id !== request()->user()->id) {
            abort(403, 'You do not own this question.');
        }

        return $question;
    }

    public function store(Request $request, $quizId)
    {
        $allowedTypes = ['multiple_choice', 'true_false', 'identification', 'enumeration', 'short_answer', 'essay', 'coding'];
        $type = in_array($request->input('type'), $allowedTypes) ? $request->input('type') : 'multiple_choice';

        $request->validate(['language' => $this->languageRule()]);

        $question = Question::create([
            'quiz_id' => $quizId,
            'type' => $type,
            'question_text' => 'New Question',
            'options' => ($type === 'multiple_choice') ? ['Option 1', 'Option 2', 'Option 3', 'Option 4'] :
                        (($type === 'enumeration') ? [''] :
                        (($type === 'true_false') ? ['True', 'False'] : [])),
            'expected_output' => ($type === 'true_false') ? 'True' : '',
            'language' => $type === 'coding' ? ($request->input('language') ?: 'java') : 'java',
            'points' => 1,
        ]);

        return response()->json($question, 201);
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'type' => 'sometimes|string|in:multiple_choice,true_false,identification,enumeration,short_answer,essay,coding',
            'question_text' => 'sometimes|string|max:5000',
            'options' => 'nullable|array',
            'options.*' => 'string|max:1000',
            'expected_output' => 'nullable|string|max:5000',
            'boilerplate' => 'nullable|string|max:5000',
            'language' => $this->languageRule(),
            'points' => 'sometimes|numeric|min:1|max:99999',
            'order_index' => 'sometimes|integer|min:0',
            'partial_credit' => 'sometimes|boolean',
            'html_checks' => 'nullable|array|max:50',
        ]);

        try {
            $question = $this->authorizeQuestion($id);

            $question->update($request->only([
                'type', 'question_text', 'options', 'expected_output', 'boilerplate', 'language', 'points', 'order_index',
                'partial_credit', 'html_checks',
            ]));

            return response()->json($question);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    // ---------- Test cases ----------

    public function testCases($id)
    {
        $question = $this->authorizeQuestion($id);

        return response()->json([
            'test_cases' => $question->testCases()->get(['id', 'input', 'expected_output', 'hidden', 'order_index'])->values(),
        ]);
    }

    /**
     * Bulk-replaces the test cases for a coding question. Sent as one call from
     * the authoring UI so ordering edits stay atomic.
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
                    'testable_type' => Question::class,
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
     * Runs the teacher's reference solution against every test case so a broken
     * challenge can be caught BEFORE 40 students see it. Stores the reference
     * for later reuse (e.g. hint generation).
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

    public function reorder(Request $request, $quizId)
    {
        $request->validate(['question_ids' => 'required|array']);

        DB::transaction(function () use ($request, $quizId) {
            foreach ($request->question_ids as $index => $id) {
                Question::where('id', $id)->where('quiz_id', $quizId)->update(['order_index' => $index + 1]);
            }
        });

        return response()->json(['message' => 'Reordered']);
    }

    public function destroy($id)
    {
        $question = $this->authorizeQuestion($id);
        $question->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
