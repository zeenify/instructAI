<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Question;
use App\Models\Quiz;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QuestionController extends Controller
{
    public function store(Request $request, $quizId)
    {
        $allowedTypes = ['multiple_choice', 'true_false', 'identification', 'enumeration', 'short_answer', 'essay', 'coding'];
        $type = in_array($request->input('type'), $allowedTypes) ? $request->input('type') : 'multiple_choice';
        
        $question = Question::create([
            'quiz_id' => $quizId,
            'type' => $type,
            'question_text' => 'New Question',
            'options' => ($type === 'multiple_choice') ? ['Option 1', 'Option 2', 'Option 3', 'Option 4'] : 
                        (($type === 'enumeration') ? [''] : 
                        (($type === 'true_false') ? ['True', 'False'] : [])),
            'expected_output' => ($type === 'true_false') ? 'True' : '',
            'points' => 1
        ]);

        return response()->json($question, 201);
    }


    public function update(Request $request, $id)
    {
        try {
            $question = Question::findOrFail($id);

            $validated = $request->validate([
                'type' => 'sometimes|string|in:multiple_choice,true_false,identification,enumeration,short_answer,essay,coding',
                'question_text' => 'sometimes|string|max:5000',
                'options' => 'nullable|array',
                'options.*' => 'string|max:1000',
                'expected_output' => 'nullable|string|max:5000',
                'boilerplate' => 'nullable|string|max:5000',
                'points' => 'sometimes|numeric|min:1|max:99999',
                'order_index' => 'sometimes|integer|min:0',
            ]);

            $question->update($request->only([
                'type', 'question_text', 'options', 'expected_output', 'boilerplate', 'points', 'order_index',
            ]));

            return response()->json($question);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
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
        Question::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }
}