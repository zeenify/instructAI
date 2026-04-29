<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Lesson;
use App\Models\LessonCompletion;
use Illuminate\Http\Request;

class LessonController extends Controller
{
    public function show(Request $request, $id)
    {
        // 1. Get the lesson
        $lesson = Lesson::where('is_published', true)->findOrFail($id);
        
        // 2. Get previous code submissions for this student in this lesson
        $submissions = \App\Models\CodeSubmission::where('student_id', auth()->id())
            ->where('lesson_id', $id)
            ->get();

        return response()->json([
            'lesson' => $lesson,
            'previous_submissions' => $submissions
        ]);
    }

    public function submitCode(Request $request, $lessonId)
    {
        $request->validate([
            'block_id' => 'required|string',
            'code' => 'required|string'
        ]);

        // This either creates a new record or updates the existing one
        \App\Models\CodeSubmission::updateOrCreate(
            [
                'student_id' => auth()->id(), 
                'lesson_id' => $lessonId, 
                'block_id' => $request->block_id
            ],
            [
                'code' => $request->code,
                'submitted_at' => now()
            ]
        );

        return response()->json(['message' => 'Progress saved']);
    }


    public function complete(Request $request, $id)
    {
        LessonCompletion::firstOrCreate([
            'student_id' => $request->user()->id,
            'lesson_id'  => $id
        ]);

        return response()->json([
            'message' => 'Lesson marked as complete'
        ]);
    }
}
