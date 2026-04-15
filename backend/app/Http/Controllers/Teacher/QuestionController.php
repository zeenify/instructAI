<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Question;
use App\Models\Quiz;
use Illuminate\Http\Request;

class QuestionController extends Controller
{
    public function store(Request $request, $quizId)
    {
        $type = $request->input('type', 'multiple_choice');
        
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
            $question->update($request->all());
            return response()->json($question);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        Question::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }
}