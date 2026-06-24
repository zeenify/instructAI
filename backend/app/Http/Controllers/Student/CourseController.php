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

        // Get all course IDs for batch queries
        $courseIds = $classroom->courses->pluck('id');
        $moduleIds = \App\Models\Module::whereIn('course_id', $courseIds)->pluck('id');

        // Batch: total published lessons per course
        $lessonCounts = DB::table('modules')
            ->whereIn('modules.course_id', $courseIds)
            ->join('lessons', 'modules.id', '=', 'lessons.module_id')
            ->where('lessons.is_published', true)
            ->selectRaw('modules.course_id, COUNT(*) as count')
            ->groupBy('modules.course_id')
            ->pluck('count', 'course_id');

        // Batch: total published quizzes per course
        $quizCounts = DB::table('modules')
            ->whereIn('modules.course_id', $courseIds)
            ->join('quizzes', 'modules.id', '=', 'quizzes.module_id')
            ->where('quizzes.is_published', true)
            ->selectRaw('modules.course_id, COUNT(*) as count')
            ->groupBy('modules.course_id')
            ->pluck('count', 'course_id');

        // Batch: completed lessons per course for this student
        $completedLessonCounts = DB::table('lesson_completions')
            ->join('lessons', 'lesson_completions.lesson_id', '=', 'lessons.id')
            ->join('modules', 'lessons.module_id', '=', 'modules.id')
            ->where('lesson_completions.student_id', $studentId)
            ->where('lessons.is_published', true)
            ->whereIn('modules.course_id', $courseIds)
            ->selectRaw('modules.course_id, COUNT(*) as count')
            ->groupBy('modules.course_id')
            ->pluck('count', 'course_id');

        // Batch: passed quizzes per course for this student
        $passedQuizCounts = DB::table('quiz_attempts')
            ->join('quizzes', 'quiz_attempts.quiz_id', '=', 'quizzes.id')
            ->join('modules', 'quizzes.module_id', '=', 'modules.id')
            ->where('quiz_attempts.student_id', $studentId)
            ->where('quiz_attempts.status', 'completed')
            ->where('quizzes.is_published', true)
            ->whereIn('modules.course_id', $courseIds)
            ->whereColumn('quiz_attempts.total_score', '>=', 'quizzes.passing_score')
            ->selectRaw('modules.course_id, COUNT(*) as count')
            ->groupBy('modules.course_id')
            ->pluck('count', 'course_id');

        // Map the pre-computed values onto each course
        foreach ($classroom->courses as $course) {
            $total = ($lessonCounts[$course->id] ?? 0) + ($quizCounts[$course->id] ?? 0);
            $done = ($completedLessonCounts[$course->id] ?? 0) + ($passedQuizCounts[$course->id] ?? 0);
            $course->progress_percent = $total > 0 ? (int) round(($done / $total) * 100) : 0;
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

    // 4. Fetch completions (Only from THIS course's modules)
    $doneLessons = \App\Models\LessonCompletion::where('student_id', $studentId)
        ->whereIn('lesson_id', function($q) use ($course) {
            $q->select('id')->from('lessons')->whereIn('module_id', function($sq) use ($course) {
                $sq->select('id')->from('modules')->where('course_id', $course->id);
            });
        })
        ->pluck('lesson_id')->toArray();

    // We check for successful attempts (Passing score) - Only from THIS course's modules
    $doneQuizzes = \App\Models\QuizAttempt::where('student_id', $studentId)
        ->where('status', 'completed')
        ->whereIn('quiz_id', function($q) use ($course) {
            $q->select('id')->from('quizzes')->whereIn('module_id', function($sq) use ($course) {
                $sq->select('id')->from('modules')->where('course_id', $course->id);
            });
        })
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