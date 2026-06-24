<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Quiz;
use App\Models\Module;
use Illuminate\Http\Request;

class QuizController extends Controller
{
    /**
     * Fetch a single quiz
     * OPTIMIZED: Single query with eager loading and sorted questions
     */
    public function show($id)
    {
        $quiz = Quiz::with([
            'module.course',
            'questions' => function($q) {
                $q->orderBy('order_index', 'asc');
            }
        ])
        ->whereHas('module.course', function($query) {
            $query->where('teacher_id', auth()->id());
        })
        ->find($id);

        if (!$quiz) {
            return response()->json(['message' => 'Access Denied'], 403);
        }

        return response()->json($quiz);
    }

    public function store(Request $request, $moduleId)
    {
        $module = Module::findOrFail($moduleId);
        
        // Calculate next order index by counting ALL items in this module
        $nextOrder = $module->lessons()->count() + $module->quizzes()->count() + 1;

        $quiz = Quiz::create([
            'module_id' => $moduleId,
            'title' => $request->title,
            'is_published' => false, // <--- ADD THIS
            'is_randomized' => false,
            'time_limit_minutes' => 30,
            'order_index' => $nextOrder
        ]);

        return response()->json($quiz, 201);
    }


    public function update(Request $request, $id)
    {
        try {
            $quiz = Quiz::with('module.course')->findOrFail($id);

            if ($quiz->module->course->teacher_id !== auth()->id()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Changed 'required' to 'sometimes'
            $validated = $request->validate([
                'title' => 'sometimes|string|max:255',
                'is_published' => 'sometimes|boolean',
                'is_randomized' => 'sometimes|boolean',
                'ai_enabled' => 'sometimes|boolean',
'time_limit_minutes' => 'sometimes|nullable|numeric|min:0|max:300',
'passing_score' => 'sometimes|integer|min:0',
                'timer_mode' => 'sometimes|string|in:entire_quiz,per_question',
                'question_limit' => 'sometimes|nullable|integer|min:1'
            ]);

            $quiz->update($validated);

            return response()->json($quiz);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        // Deep security check: Quiz -> Module -> Course -> Teacher
        $quiz = Quiz::whereHas('module.course', function($q) {
            $q->where('teacher_id', auth()->id());
        })->findOrFail($id);

        $quiz->delete();
        return response()->json(['message' => 'Quiz removed.']);
    }
}