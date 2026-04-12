<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Course;    // <--- MUST HAVE THIS
use App\Models\Classroom; // <--- MUST HAVE THIS
use Illuminate\Http\Request;

class CourseController extends Controller
{
    public function store(Request $request, $classId)
    {
        // Try/Catch will help you see the error in the Response if it fails again
        try {
            $classroom = Classroom::findOrFail($classId);

            if ($classroom->teacher_id !== $request->user()->id) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $request->validate([
                'title' => 'required|string|max:255',
                'description' => 'nullable|string',
            ]);

            $course = Course::create([
                'teacher_id' => $request->user()->id,
                'class_id' => $classId,
                'title' => $request->title,
                'description' => $request->description,
                'is_published' => false,
                'order_index' => $classroom->courses()->count() + 1
            ]);

            return response()->json($course, 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
    public function show($id)
    {
        try {
            // This line is the one failing if Models aren't setup:
            $course = Course::with(['modules.lessons', 'modules.quizzes'])->findOrFail($id);
            
            // Security check
            if ($course->teacher_id !== auth()->id()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            return response()->json($course);
        } catch (\Exception $e) {
            // This will print the ACTUAL error to your browser's Network tab
            return response()->json([
                'error' => 'Backend Logic Error',
                'message' => $e->getMessage(),
                'line' => $e->getLine()
            ], 500);
        }
    }


}