<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Quiz;
use App\Models\Module;
use Illuminate\Http\Request;

class QuizController extends Controller
{
    // 1. ADD THIS SHOW METHOD
    public function show($id)
    {
        $quiz = Quiz::whereHas('module.course', function($query) {
            $query->where('teacher_id', auth()->id());
        })->with('questions')->find($id);

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
            $quiz = Quiz::findOrFail($id);

            if ($quiz->module->course->teacher_id !== auth()->id()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Changed 'required' to 'sometimes'
            $validated = $request->validate([
                'title' => 'sometimes|string|max:255',
                'is_published' => 'sometimes|boolean',
                'is_randomized' => 'sometimes|boolean',
                'allow_ai_assistance' => 'sometimes|boolean',
                'time_limit_minutes' => 'sometimes|nullable|integer'
            ]);

            $quiz->update($validated);

            return response()->json($quiz);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}