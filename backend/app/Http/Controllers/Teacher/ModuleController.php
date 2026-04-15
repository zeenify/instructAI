<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Module; // <--- MUST HAVE THIS
use App\Models\Course; // <--- MUST HAVE THIS
use App\Models\Lesson;
use App\Models\Quiz;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ModuleController extends Controller
{
    public function store(Request $request, $courseId)
    {
        try {
            $course = Course::findOrFail($courseId);

            // Security: Only the teacher who owns the course can add modules
            if ($course->teacher_id !== $request->user()->id) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $request->validate([
                'title' => 'required|string|max:255'
            ]);

            // Create the module
            $module = Module::create([
                'course_id' => $courseId,
                'title' => $request->title,
                'order_index' => $course->modules()->count() + 1,
                'is_published' => false
            ]);

            // Return the module with empty lessons/quizzes so React doesn't crash
            return response()->json($module->load(['lessons', 'quizzes']), 201);

        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function reorderItems(Request $request, $moduleId)
    {
        $items = $request->items;

        // A Transaction ensures the DB doesn't save partial/messy data
        DB::transaction(function () use ($items) {
            foreach ($items as $index => $item) {
                $newPosition = $index + 1;

                if ($item['itemType'] === 'lesson') {
                    DB::table('lessons')->where('id', $item['id'])->update(['order_index' => $newPosition]);
                } elseif ($item['itemType'] === 'quiz') {
                    DB::table('quizzes')->where('id', $item['id'])->update(['order_index' => $newPosition]);
                }
            }
        });

        return response()->json(['message' => 'Timeline synchronized']);
    }



}