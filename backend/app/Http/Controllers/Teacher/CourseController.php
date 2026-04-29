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
        // Added ->where('id', $id) to ensure we get the CORRECT course
        $course = Course::where('id', $id)
            ->where('teacher_id', auth()->id())
            ->with([
                'modules' => fn($q) => $q->orderBy('order_index', 'asc'),
                'modules.lessons' => fn($q) => $q->orderBy('order_index', 'asc'),
                'modules.quizzes' => fn($q) => $q->orderBy('order_index', 'asc')
            ])->firstOrFail(); // Use firstOrFail to catch errors

        return response()->json($course);
    }

    public function togglePublish(Request $request, $id)
    {
        $course = Course::findOrFail($id);
        $course->update(['is_published' => $request->is_published]);
        return response()->json(['success' => true]);
    }
        


}