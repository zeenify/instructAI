<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Quiz;
use App\Models\Module;
use Illuminate\Http\Request;

class QuizController extends Controller
{
    public function store(Request $request, $moduleId)
    {
        try {
            $module = Module::with('course')->findOrFail($moduleId);
            
            if ($module->course->teacher_id !== $request->user()->id) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $request->validate(['title' => 'required|string|max:255']);

            $quiz = Quiz::create([
                'module_id' => $moduleId,
                'title' => $request->title,
                'is_randomized' => false,
                'time_limit_minutes' => 30 
            ]);

            return response()->json($quiz->load('questions'), 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}