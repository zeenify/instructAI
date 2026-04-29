<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Classroom;
use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB; 

class CourseController extends Controller
{
    public function showClass(Request $request, $id)
    {
        $studentId = $request->user()->id;

        // Ensure student is enrolled
        $isEnrolled = $request->user()->classes()->where('class_id', $id)->exists();
        if (!$isEnrolled) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Fetch Class and its published courses
        $classroom = Classroom::with(['teacher.teacherProfile', 'courses' => function($q) {
            $q->where('is_published', true)->orderBy('order_index', 'asc');
        }])->findOrFail($id);

        // 2. Attach progress data to each course object
        foreach ($classroom->courses as $course) {
            // Count all published Lessons and Quizzes in this course
            $totalItems = DB::table('lessons')->whereIn('module_id', function($q) use ($course) {
                $q->select('id')->from('modules')->where('course_id', $course->id);
            })->where('is_published', true)->count();

            $totalItems += DB::table('quizzes')->whereIn('module_id', function($q) use ($course) {
                $q->select('id')->from('modules')->where('course_id', $course->id);
            })->where('is_published', true)->count();

            if ($totalItems > 0) {
                // Count completed items
                $done = DB::table('lesson_completions')->where('student_id', $studentId)
                    ->whereIn('lesson_id', function($q) use ($course) {
                        $q->select('id')->from('lessons')->whereIn('module_id', function($sq) use ($course) {
                            $sq->select('id')->from('modules')->where('course_id', $course->id);
                        });
                    })->count();

                // Count passed quizzes
                $done += DB::table('quiz_attempts')->where('student_id', $studentId)
                    ->where('status', 'completed')
                    ->whereIn('quiz_id', function($q) use ($course) {
                        $q->select('id')->from('quizzes')->whereIn('module_id', function($sq) use ($course) {
                            $sq->select('id')->from('modules')->where('course_id', $course->id);
                        });
                    })
                    ->whereExists(function ($query) {
                        $query->select(DB::raw(1))->from('quizzes')
                            ->whereColumn('quizzes.id', 'quiz_attempts.quiz_id')
                            ->whereColumn('quiz_attempts.total_score', '>=', 'quizzes.passing_score');
                    })->count();

                $course->progress_percent = (int) round(($done / $totalItems) * 100);
            } else {
                $course->progress_percent = 0;
            }
        }

        return response()->json($classroom);
    }


// Show a specific course with its modules, lessons, and quizzes for the Netacad viewer
public function showCourse(Request $request, $id)
{
    // 1. Find the course first to check enrollment
    $course = Course::findOrFail($id);

    // 2. Check if student is enrolled in the CLASS this course belongs to
    $isEnrolled = $request->user()->classes()->where('class_id', $course->class_id)->exists();
    if (!$isEnrolled) {
        return response()->json(['message' => 'Unauthorized access.'], 403);
    }

    // Inside showCourse...
    $course->load([
        'modules' => fn($q) => $q->orderBy('order_index', 'asc'),
        'modules.lessons' => fn($q) => $q->where('is_published', true)->orderBy('order_index', 'asc'),
        'modules.quizzes' => fn($q) => $q->where('is_published', true)->orderBy('order_index', 'asc') // Added where is_published
    ]);

    $studentId = $request->user()->id;

    // 4. Fetch completions (Using namespaced models to be safe)
    $doneLessons = \App\Models\LessonCompletion::where('student_id', $studentId)->pluck('lesson_id')->toArray();
    
    // We check for successful attempts (Passing score)
    $doneQuizzes = \App\Models\QuizAttempt::where('student_id', $studentId)
        ->where('status', 'completed')
        ->whereExists(function ($query) {
            $query->select(DB::raw(1))
                  ->from('quizzes')
                  ->whereColumn('quizzes.id', 'quiz_attempts.quiz_id')
                  ->whereColumn('quiz_attempts.total_score', '>=', 'quizzes.passing_score');
        })
        ->pluck('quiz_id')->toArray();

    return response()->json([
        'course' => $course,
        'completed_lessons' => $doneLessons,
        'completed_quizzes' => $doneQuizzes,
    ]);
}

}