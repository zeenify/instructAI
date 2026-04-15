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
        try {
            // Load quiz with its questions
            $quiz = Quiz::with('questions')->findOrFail($id);

            // Check if teacher owns the course this quiz belongs to
            if ($quiz->module->course->teacher_id !== auth()->id()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            return response()->json($quiz);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request, $moduleId)
    {
        $module = Module::findOrFail($moduleId);
        
        // Calculate next order index by counting ALL items in this module
        $nextOrder = $module->lessons()->count() + $module->quizzes()->count() + 1;

        $quiz = Quiz::create([
            'module_id' => $moduleId,
            'title' => $request->title,
            'is_randomized' => false,
            'time_limit_minutes' => 30,
            'order_index' => $nextOrder // <--- ADD THIS
        ]);

        return response()->json($quiz, 201);
    }


    public function update(Request $request, $id)
    {
        try {
            $quiz = Quiz::findOrFail($id);

            // Security check
            if ($quiz->module->course->teacher_id !== auth()->id()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $request->validate([
                'title' => 'required|string|max:255',
                'is_randomized' => 'boolean',
                'allow_ai_assistance' => 'boolean',
                'time_limit_minutes' => 'nullable|integer'
            ]);

            $quiz->update($request->all());

            return response()->json($quiz);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}