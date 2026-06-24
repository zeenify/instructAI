<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Module;
use App\Models\Lesson;
use App\Models\Quiz;
use App\Models\LessonCompletion;
use App\Models\QuizAttempt;
use App\Models\CodeSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    // GET /api/teacher/classes/{classId}/courses/{courseId}/analytics/overview
    public function getOverview(Request $request, $classId, $courseId)
    {
        $user = $request->user();
        $classroom = Classroom::where('id', $classId)
            ->where('teacher_id', $user->id)
            ->firstOrFail();

        $course = Course::where('id', $courseId)
            ->where('class_id', $classId)
            ->first();

        if (!$course) {
            return response()->json(['error' => "Course {$courseId} not found in class {$classId}"], 404);
        }

        $enrolledStudentIds = $classroom->students()->pluck('users.id')->toArray();
        $courseItems = $this->getCourseItems($courseId);

        $totalStudents = count($enrolledStudentIds);

        $completionData = LessonCompletion::whereIn('lesson_id', $courseItems['lesson_ids'])
            ->whereIn('student_id', $enrolledStudentIds)
            ->count();

        $quizAttempts = QuizAttempt::whereIn('quiz_id', $courseItems['quiz_ids'])
            ->whereIn('student_id', $enrolledStudentIds)
            ->get();

        $avgQuizScore = 0;
        if ($quizAttempts->count() > 0) {
            $avgTotal = $quizAttempts->avg('total_score');
            $avgMax = $quizAttempts->avg('max_score');
            if ($avgMax > 0) {
                $avgQuizScore = round(($avgTotal / $avgMax) * 100);
            }
        }

        $totalItems = $courseItems['lessons'] + $courseItems['quizzes'];
        $avgCompletion = 0;
        if ($totalStudents > 0 && $totalItems > 0) {
            $avgCompletion = round(($completionData / ($totalStudents * $totalItems)) * 100);
        }

        return response()->json([
            'total_students' => $totalStudents,
            'total_items' => $totalItems,
            'avg_completion' => $avgCompletion,
            'avg_quiz_score' => $avgQuizScore
        ]);
    }

    // GET /api/teacher/classes/{classId}/courses/{courseId}/analytics/performance-trend
    public function getPerformanceTrend(Request $request, $classId, $courseId)
    {
        $user = $request->user();
        $classroom = Classroom::where('id', $classId)
            ->where('teacher_id', $user->id)
            ->firstOrFail();

        $course = Course::where('id', $courseId)
            ->where('class_id', $classId)
            ->first();

        if (!$course) {
            return response()->json(['error' => "Course {$courseId} not found in class {$classId}"], 404);
        }

        $enrolledStudentIds = $classroom->students()->pluck('users.id')->toArray();
        $courseItems = $this->getCourseItems($courseId);

        $totalItems = $courseItems['lessons'] + $courseItems['quizzes'];
        $totalStudents = count($enrolledStudentIds);

        if ($totalStudents === 0 || $totalItems === 0) {
            return response()->json(['data' => []]);
        }

        // Get completion trend by date
        $trend = DB::table('lesson_completions')
            ->whereIn('lesson_id', $courseItems['lesson_ids'])
            ->whereIn('student_id', $enrolledStudentIds)
            ->selectRaw('DATE(completed_at) as date, COUNT(DISTINCT student_id) as unique_students')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Calculate cumulative completion percentage
        $data = [];
        $cumulativeCompleted = 0;

        foreach ($trend as $item) {
            $cumulativeCompleted += $item->unique_students;
            $percentage = round(($cumulativeCompleted / $totalStudents) * 100);

            $data[] = [
                'date' => $item->date,
                'completion_percentage' => $percentage,
                'students_completed' => $cumulativeCompleted
            ];
        }

        return response()->json(['data' => $data]);
    }

    // GET /api/teacher/classes/{classId}/courses/{courseId}/analytics/quiz-scores
    public function getQuizScores(Request $request, $classId, $courseId)
    {
        $user = $request->user();
        $classroom = Classroom::where('id', $classId)
            ->where('teacher_id', $user->id)
            ->firstOrFail();

        $course = Course::where('id', $courseId)
            ->where('class_id', $classId)
            ->first();

        if (!$course) {
            return response()->json(['error' => "Course {$courseId} not found in class {$classId}"], 404);
        }

        $courseItems = $this->getCourseItems($courseId);

        $quizScores = DB::table('quiz_attempts')
            ->whereIn('quiz_id', $courseItems['quiz_ids'])
            ->selectRaw('quiz_id, AVG(total_score / max_score * 100) as avg_score, COUNT(DISTINCT student_id) as attempt_count')
            ->groupBy('quiz_id')
            ->get();

        $quizzes = Quiz::whereIn('id', $courseItems['quiz_ids'])
            ->get()
            ->keyBy('id');

        $data = [];
        foreach ($quizScores as $score) {
            $quiz = $quizzes->get($score->quiz_id);
            if ($quiz) {
                $data[] = [
                    'quiz_name' => $quiz->title,
                    'avg_score' => round($score->avg_score),
                    'attempt_count' => $score->attempt_count
                ];
            }
        }

        usort($data, fn($a, $b) => $b['avg_score'] <=> $a['avg_score']);

        return response()->json(['data' => $data]);
    }

    // GET /api/teacher/classes/{classId}/courses/{courseId}/analytics/content-engagement
    public function getContentEngagement(Request $request, $classId, $courseId)
    {
        $user = $request->user();
        $classroom = Classroom::where('id', $classId)
            ->where('teacher_id', $user->id)
            ->firstOrFail();

        $course = Course::where('id', $courseId)
            ->where('class_id', $classId)
            ->first();

        if (!$course) {
            return response()->json(['error' => "Course {$courseId} not found in class {$classId}"], 404);
        }

        $enrolledStudentIds = $classroom->students()->pluck('users.id')->toArray();
        $courseItems = $this->getCourseItems($courseId);

        // Batch query: all lesson completions across these lessons at once
        $lessonIds = $courseItems['all_lessons']->pluck('id')->toArray();

        $completionCounts = LessonCompletion::whereIn('lesson_id', $lessonIds)
            ->whereIn('student_id', $enrolledStudentIds)
            ->selectRaw('lesson_id, COUNT(*) as count')
            ->groupBy('lesson_id')
            ->pluck('count', 'lesson_id');

        // Batch query: all code submissions across these lessons at once
        $codeAttemptCounts = CodeSubmission::whereIn('lesson_id', $lessonIds)
            ->whereIn('student_id', $enrolledStudentIds)
            ->selectRaw('lesson_id, COUNT(*) as count')
            ->groupBy('lesson_id')
            ->pluck('count', 'lesson_id');

        $engagementData = [];
        foreach ($courseItems['all_lessons'] as $lesson) {
            $completions = $completionCounts[$lesson->id] ?? 0;
            $codeAttempts = $codeAttemptCounts[$lesson->id] ?? 0;
            $completionRate = count($enrolledStudentIds) > 0
                ? round(($completions / count($enrolledStudentIds)) * 100)
                : 0;

            $engagementData[] = [
                'lesson_name' => $lesson->title,
                'module_id' => $lesson->module_id,
                'attempts' => $codeAttempts,
                'completion_count' => $completions,
                'completion_rate' => $completionRate
            ];
        }

        // Sort by attempts (descending)
        usort($engagementData, fn($a, $b) => $b['attempts'] <=> $a['attempts']);

        return response()->json(['data' => $engagementData]);
    }

    private function getCourseItems($courseId)
    {
        $course = Course::with(['modules.lessons', 'modules.quizzes'])->find($courseId);
        $lessons = collect();
        $quizzes = collect();
        foreach ($course?->modules ?? [] as $module) {
            $lessons = $lessons->merge($module->lessons);
            $quizzes = $quizzes->merge($module->quizzes);
        }

        return [
            'lesson_ids' => $lessons->pluck('id')->toArray(),
            'quiz_ids' => $quizzes->pluck('id')->toArray(),
            'lessons' => $lessons->count(),
            'quizzes' => $quizzes->count(),
            'all_lessons' => $lessons,
            'all_quizzes' => $quizzes
        ];
    }
}
