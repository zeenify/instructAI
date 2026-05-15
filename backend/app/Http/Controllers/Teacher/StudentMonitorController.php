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

class StudentMonitorController extends Controller
{
    // GET /api/teacher/classes/{classId}/courses/{courseId}/monitor/stats
    public function getMonitorStats(Request $request, $classId, $courseId)
    {
        $user = $request->user();
        $classroom = Classroom::where('id', $classId)
            ->where('teacher_id', $user->id)
            ->firstOrFail();

        $course = Course::where('id', $courseId)
            ->where('class_id', $classId)
            ->firstOrFail();

        // Get all students enrolled in this class
        $enrolledStudents = $classroom->students()->pluck('users.id');
        $totalEnrolled = $enrolledStudents->count();

        if ($totalEnrolled === 0) {
            return response()->json([
                'completion_percentage' => 0,
                'completed_count' => 0,
                'total_enrolled' => 0,
                'average_quiz_score' => 0,
                'not_started_count' => 0,
                'stuck_count' => 0
            ]);
        }

        // Get all lessons and quizzes in this course
        $courseItems = $this->getCourseItems($courseId);
        $totalLessons = $courseItems['lessons'];
        $totalQuizzes = $courseItems['quizzes'];
        $totalItems = $totalLessons + $totalQuizzes;

        // Count completed lessons per student
        $lessonCompletions = DB::table('lesson_completions')
            ->whereIn('student_id', $enrolledStudents)
            ->whereIn('lesson_id', $courseItems['lesson_ids'])
            ->groupBy('student_id')
            ->selectRaw('student_id, COUNT(DISTINCT lesson_id) as completed_lessons')
            ->get()
            ->keyBy('student_id');

        // Get latest quiz attempt per student per quiz
        $quizAttempts = QuizAttempt::whereIn('student_id', $enrolledStudents)
            ->whereIn('quiz_id', $courseItems['quiz_ids'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->groupBy('student_id')
            ->map(function($studentAttempts) {
                return $studentAttempts->groupBy('quiz_id')->map(fn($attempts) => $attempts->first());
            });

        // Count completed students (all lessons + all quizzes done)
        $completedCount = 0;
        $totalQuizScore = 0;
        $quizScoreCount = 0;

        foreach ($enrolledStudents as $studentId) {
            $lessonsCompleted = $lessonCompletions[$studentId]->completed_lessons ?? 0;
            $quizzesAttempted = isset($quizAttempts[$studentId]) ? $quizAttempts[$studentId]->count() : 0;

            if ($lessonsCompleted === $totalLessons && $quizzesAttempted === $totalQuizzes) {
                $completedCount++;
            }

            // Sum up quiz scores for average
            if (isset($quizAttempts[$studentId])) {
                foreach ($quizAttempts[$studentId] as $attempt) {
                    if ($attempt->max_score > 0) {
                        $score = round(($attempt->total_score / $attempt->max_score) * 100);
                        $totalQuizScore += $score;
                        $quizScoreCount++;
                    }
                }
            }
        }

        $completionPercentage = $totalEnrolled > 0 ? round(($completedCount / $totalEnrolled) * 100) : 0;
        $averageQuizScore = $quizScoreCount > 0 ? round($totalQuizScore / $quizScoreCount) : 0;

        // Count not started students
        $notStartedStudents = $this->getNotStartedStudents($enrolledStudents, $courseItems);
        $notStartedCount = count($notStartedStudents);

        // Count stuck students
        $stuckStudents = $this->getStuckStudents($enrolledStudents, $courseItems);
        $stuckCount = count($stuckStudents);

        return response()->json([
            'completion_percentage' => $completionPercentage,
            'completed_count' => $completedCount,
            'total_enrolled' => $totalEnrolled,
            'average_quiz_score' => $averageQuizScore,
            'not_started_count' => $notStartedCount,
            'stuck_count' => $stuckCount
        ]);
    }

    // GET /api/teacher/classes/{classId}/courses/{courseId}/monitor/students
    public function getMonitorStudents(Request $request, $classId, $courseId)
    {
        $user = $request->user();
        $classroom = Classroom::where('id', $classId)
            ->where('teacher_id', $user->id)
            ->firstOrFail();

        $course = Course::where('id', $courseId)
            ->where('class_id', $classId)
            ->firstOrFail();

        $sort = $request->query('sort', 'progress');
        $filter = $request->query('filter', 'all');

        $enrolledStudentIds = $classroom->students()->pluck('users.id')->toArray();
        $courseItems = $this->getCourseItems($courseId);

        // Batch fetch all data
        $students = \App\Models\User::whereIn('id', $enrolledStudentIds)->with('studentProfile')->get()->keyBy('id');

        $allCompletions = LessonCompletion::whereIn('lesson_id', $courseItems['lesson_ids'])
            ->whereIn('student_id', $enrolledStudentIds)
            ->get()
            ->groupBy('student_id');

        $allAttempts = QuizAttempt::whereIn('quiz_id', $courseItems['quiz_ids'])
            ->whereIn('student_id', $enrolledStudentIds)
            ->get()
            ->groupBy('student_id');

        $allSubmissions = CodeSubmission::whereIn('lesson_id', $courseItems['lesson_ids'])
            ->whereIn('student_id', $enrolledStudentIds)
            ->get()
            ->groupBy('student_id');

        $allLastActive = DB::table('lesson_completions')
            ->whereIn('lesson_id', $courseItems['lesson_ids'])
            ->whereIn('student_id', $enrolledStudentIds)
            ->select('student_id', DB::raw('MAX(completed_at) as last_active_time'))
            ->groupBy('student_id')
            ->pluck('last_active_time', 'student_id');

        $studentData = [];

        foreach ($enrolledStudentIds as $studentId) {
            $studentUser = $students->get($studentId);
            if (!$studentUser) continue;

            $profile = $studentUser->studentProfile;
            $studentName = $profile
                ? trim($profile->first_name . ' ' . $profile->last_name)
                : 'Unknown';

            $lessonsCompleted = isset($allCompletions[$studentId]) ? $allCompletions[$studentId]->count() : 0;
            $quizzesAttempted = isset($allAttempts[$studentId]) ? $allAttempts[$studentId]->count() : 0;
            $totalItems = $courseItems['lessons'] + $courseItems['quizzes'];
            $itemsCompleted = $lessonsCompleted + $quizzesAttempted;
            $percentage = $totalItems > 0 ? round(($itemsCompleted / $totalItems) * 100) : 0;

            $flags = $this->getStudentFlags($studentId, $courseItems, $allCompletions, $allAttempts, $allSubmissions);
            $lastActive = $allLastActive[$studentId] ?? null;

            $studentData[] = [
                'id' => $studentId,
                'name' => $studentName,
                'completion_percentage' => $percentage,
                'last_active' => $lastActive,
                'flags' => $flags
            ];
        }

        // Apply filters
        $studentData = $this->applyStudentFilters($studentData, $filter);

        // Apply sorting
        $studentData = $this->sortStudents($studentData, $sort);

        return response()->json(['students' => $studentData]);
    }

    // GET /api/teacher/classes/{classId}/courses/{courseId}/monitor/student/{studentId}
    public function getStudentProfile(Request $request, $classId, $courseId, $studentId)
    {
        $user = $request->user();
        $classroom = Classroom::where('id', $classId)
            ->where('teacher_id', $user->id)
            ->firstOrFail();

        $course = Course::where('id', $courseId)
            ->where('class_id', $classId)
            ->firstOrFail();

        // Verify student is enrolled in this class
        $classroom->students()->findOrFail($studentId);

        $studentUser = \App\Models\User::find($studentId);
        $profile = $studentUser->studentProfile;
        $studentName = $profile
            ? trim($profile->first_name . ' ' . $profile->last_name)
            : 'Unknown';

        $courseItems = $this->getCourseItems($courseId);
        $completionData = $this->calculateStudentCompletion($studentId, $courseItems);
        $lastActive = $this->getStudentLastActive($studentId, $courseItems);

        // Get modules with lessons and quizzes
        $modules = Module::where('course_id', $courseId)
            ->orderBy('order_index', 'asc')
            ->with(['lessons' => fn($q) => $q->orderBy('order_index', 'asc')])
            ->with(['quizzes' => fn($q) => $q->orderBy('order_index', 'asc')])
            ->get();

        $lessonIds = $modules->flatMap(fn($m) => $m->lessons->pluck('id'))->unique()->toArray();
        $quizIds = $modules->flatMap(fn($m) => $m->quizzes->pluck('id'))->unique()->toArray();

        // Batch fetch all data
        $lessonCompletions = LessonCompletion::where('student_id', $studentId)
            ->whereIn('lesson_id', $lessonIds)
            ->get()
            ->keyBy('lesson_id');

        $codeSubmissionCounts = CodeSubmission::where('student_id', $studentId)
            ->whereIn('lesson_id', $lessonIds)
            ->get()
            ->groupBy('lesson_id')
            ->map(fn($items) => $items->count());

        $quizAttempts = QuizAttempt::where('student_id', $studentId)
            ->whereIn('quiz_id', $quizIds)
            ->orderBy('created_at', 'desc')
            ->get()
            ->groupBy('quiz_id');

        $moduleData = [];
        foreach ($modules as $module) {
            $lessonData = [];
            foreach ($module->lessons as $lesson) {
                $completion = $lessonCompletions[$lesson->id] ?? null;
                $codeSubmissionCount = $codeSubmissionCounts[$lesson->id] ?? 0;
                $isStuck = $codeSubmissionCount > 0 && !$completion;

                $lessonData[] = [
                    'id' => $lesson->id,
                    'name' => $lesson->title,
                    'type' => 'lesson',
                    'status' => $completion ? 'completed' : ($codeSubmissionCount > 0 ? 'in_progress' : 'not_started'),
                    'completed_at' => $completion?->completed_at,
                    'code_attempts' => $codeSubmissionCount,
                    'is_stuck' => $isStuck
                ];
            }

            $quizData = [];
            foreach ($module->quizzes as $quiz) {
                $attempts = $quizAttempts[$quiz->id] ?? collect();

                $status = 'not_started';
                $score = null;
                $maxScore = null;
                $attemptCount = 0;
                $lastAttempt = null;

                if ($attempts->count() > 0) {
                    $status = 'completed';
                    $latestAttempt = $attempts->first();
                    $score = $latestAttempt->total_score;
                    $maxScore = $latestAttempt->max_score;
                    $attemptCount = $attempts->count();
                    $lastAttempt = $latestAttempt->created_at;
                }

                $quizData[] = [
                    'id' => $quiz->id,
                    'name' => $quiz->title,
                    'type' => 'quiz',
                    'status' => $status,
                    'score' => $score,
                    'max_score' => $maxScore,
                    'attempts' => $attemptCount,
                    'last_attempt' => $lastAttempt
                ];
            }

            $moduleData[] = [
                'id' => $module->id,
                'name' => $module->title,
                'lessons' => $lessonData,
                'quizzes' => $quizData
            ];
        }

        // Quiz summary (all quizzes in course) - use already fetched $quizAttempts
        $allQuizAttempts = QuizAttempt::where('student_id', $studentId)
            ->whereIn('quiz_id', $courseItems['quiz_ids'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->groupBy('quiz_id');

        $quizSummary = [];
        foreach ($courseItems['all_quizzes'] as $quiz) {
            $attempts = $allQuizAttempts[$quiz->id] ?? collect();

            if ($attempts->count() > 0) {
                $latestAttempt = $attempts->first();
                // total_score is the actual score, max_score is the max possible
                $percentage = $latestAttempt->max_score > 0
                    ? round(($latestAttempt->total_score / $latestAttempt->max_score) * 100)
                    : 0;

                $quizSummary[] = [
                    'quiz_id' => $quiz->id,
                    'name' => $quiz->title,
                    'score' => $latestAttempt->total_score,
                    'max_score' => $latestAttempt->max_score,
                    'percentage' => $percentage,
                    'attempts' => $attempts->count(),
                    'last_attempt' => $latestAttempt->created_at
                ];
            } else {
                $quizSummary[] = [
                    'quiz_id' => $quiz->id,
                    'name' => $quiz->title,
                    'score' => null,
                    'max_score' => null,
                    'percentage' => null,
                    'attempts' => 0,
                    'last_attempt' => null
                ];
            }
        }

        return response()->json([
            'student' => [
                'id' => $studentUser->id,
                'name' => $studentName,
                'completion_percentage' => $completionData['percentage'],
                'items_completed' => $completionData['items_completed'],
                'total_items' => $completionData['total_items'],
                'last_active' => $lastActive
            ],
            'modules' => $moduleData,
            'quiz_summary' => $quizSummary
        ]);
    }

    // Helper: Get course items (lessons, quizzes, ids)
    private function getCourseItems($courseId)
    {
        $modules = Module::where('course_id', $courseId)->get();
        $lessons = Lesson::whereIn('module_id', $modules->pluck('id'))->get();
        $quizzes = Quiz::whereIn('module_id', $modules->pluck('id'))->get();

        return [
            'lesson_ids' => $lessons->pluck('id')->toArray(),
            'quiz_ids' => $quizzes->pluck('id')->toArray(),
            'lessons' => $lessons->count(),
            'quizzes' => $quizzes->count(),
            'all_quizzes' => $quizzes
        ];
    }

    // Helper: Calculate student completion percentage
    private function calculateStudentCompletion($studentId, $courseItems)
    {
        $lessonsCompleted = LessonCompletion::whereIn('lesson_id', $courseItems['lesson_ids'])
            ->where('student_id', $studentId)
            ->count();

        $quizzesAttempted = QuizAttempt::whereIn('quiz_id', $courseItems['quiz_ids'])
            ->where('student_id', $studentId)
            ->distinct('quiz_id')
            ->count();

        $totalItems = $courseItems['lessons'] + $courseItems['quizzes'];
        $itemsCompleted = $lessonsCompleted + $quizzesAttempted;

        $percentage = $totalItems > 0 ? round(($itemsCompleted / $totalItems) * 100) : 0;

        return [
            'percentage' => $percentage,
            'items_completed' => $itemsCompleted,
            'total_items' => $totalItems
        ];
    }

    // Helper: Get student's last active timestamp
    private function getStudentLastActive($studentId, $courseItems)
    {
        $lastLessonCompletion = LessonCompletion::whereIn('lesson_id', $courseItems['lesson_ids'])
            ->where('student_id', $studentId)
            ->orderBy('completed_at', 'desc')
            ->first();

        $lastQuizAttempt = QuizAttempt::whereIn('quiz_id', $courseItems['quiz_ids'])
            ->where('student_id', $studentId)
            ->orderBy('created_at', 'desc')
            ->first();

        $lastCodeSubmission = CodeSubmission::where('student_id', $studentId)
            ->whereIn('lesson_id', $courseItems['lesson_ids'])
            ->orderBy('submitted_at', 'desc')
            ->first();

        $timestamps = [];
        if ($lastLessonCompletion) $timestamps[] = $lastLessonCompletion->completed_at;
        if ($lastQuizAttempt) $timestamps[] = $lastQuizAttempt->created_at;
        if ($lastCodeSubmission) $timestamps[] = $lastCodeSubmission->submitted_at;

        return !empty($timestamps) ? max($timestamps) : null;
    }

    // Helper: Get student flags (batch processed)
    private function getStudentFlags($studentId, $courseItems, $allCompletions = null, $allAttempts = null, $allSubmissions = null)
    {
        $flags = [];

        // Flag 1: Not Started
        $hasLessonCompletion = $allCompletions && isset($allCompletions[$studentId]) && $allCompletions[$studentId]->count() > 0;
        $hasQuizAttempt = $allAttempts && isset($allAttempts[$studentId]) && $allAttempts[$studentId]->count() > 0;
        if (!$hasLessonCompletion && !$hasQuizAttempt) {
            $flags[] = 'not_started';
        }

        // Flag 2: Stuck
        if ($allSubmissions && isset($allSubmissions[$studentId])) {
            $submittedLessons = $allSubmissions[$studentId]->pluck('lesson_id')->unique();
            foreach ($submittedLessons as $lessonId) {
                $hasCompletion = $allCompletions && isset($allCompletions[$studentId])
                    ? $allCompletions[$studentId]->where('lesson_id', $lessonId)->count() > 0
                    : false;
                if (!$hasCompletion) {
                    $flags[] = 'stuck';
                    break;
                }
            }
        }

        // Flag 3: Failed Quiz Twice
        if ($allAttempts && isset($allAttempts[$studentId])) {
            $attemptsGrouped = $allAttempts[$studentId]->groupBy('quiz_id');
            foreach ($attemptsGrouped as $quizId => $attempts) {
                if ($attempts->count() >= 2) {
                    $latestScore = $attempts->sortByDesc('created_at')->first()->max_score;
                    if ($latestScore < 70) {
                        $flags[] = 'failed_quiz_twice';
                        break;
                    }
                }
            }
        }

        return $flags;
    }

    private function getNotStartedStudents($enrolledStudents, $courseItems)
    {
        $allCompletions = LessonCompletion::whereIn('lesson_id', $courseItems['lesson_ids'])
            ->whereIn('student_id', $enrolledStudents)
            ->get()
            ->groupBy('student_id');

        $allAttempts = QuizAttempt::whereIn('quiz_id', $courseItems['quiz_ids'])
            ->whereIn('student_id', $enrolledStudents)
            ->get()
            ->groupBy('student_id');

        return array_filter($enrolledStudents->toArray(), function($studentId) use ($allCompletions, $allAttempts) {
            $hasLessonCompletion = isset($allCompletions[$studentId]) && $allCompletions[$studentId]->count() > 0;
            $hasQuizAttempt = isset($allAttempts[$studentId]) && $allAttempts[$studentId]->count() > 0;
            return !$hasLessonCompletion && !$hasQuizAttempt;
        });
    }

    private function getStuckStudents($enrolledStudents, $courseItems)
    {
        $allCompletions = LessonCompletion::whereIn('lesson_id', $courseItems['lesson_ids'])
            ->whereIn('student_id', $enrolledStudents)
            ->get()
            ->groupBy('student_id');

        $allSubmissions = CodeSubmission::whereIn('lesson_id', $courseItems['lesson_ids'])
            ->whereIn('student_id', $enrolledStudents)
            ->get()
            ->groupBy('student_id');

        return array_filter($enrolledStudents->toArray(), function($studentId) use ($allSubmissions, $allCompletions) {
            if (!isset($allSubmissions[$studentId])) return false;

            $submittedLessons = $allSubmissions[$studentId]->pluck('lesson_id')->unique();
            foreach ($submittedLessons as $lessonId) {
                $hasCompletion = isset($allCompletions[$studentId]) && $allCompletions[$studentId]->where('lesson_id', $lessonId)->count() > 0;
                if (!$hasCompletion) {
                    return true;
                }
            }
            return false;
        });
    }

    // Helper: Apply student filters
    private function applyStudentFilters($studentData, $filter)
    {
        switch ($filter) {
            case 'not_started':
                return array_filter($studentData, fn($s) => in_array('not_started', $s['flags']));
            case 'stuck':
                return array_filter($studentData, fn($s) => in_array('stuck', $s['flags']));
            case 'inactive':
                // Inactive = no activity in last 7 days
                $sevenDaysAgo = now()->subDays(7);
                return array_filter($studentData, fn($s) => !$s['last_active'] || $s['last_active'] < $sevenDaysAgo);
            default:
                return $studentData;
        }
    }

    // Helper: Sort students
    private function sortStudents($studentData, $sort)
    {
        switch ($sort) {
            case 'progress':
                usort($studentData, fn($a, $b) => $b['completion_percentage'] <=> $a['completion_percentage']);
                break;
            case 'progress_asc':
                usort($studentData, fn($a, $b) => $a['completion_percentage'] <=> $b['completion_percentage']);
                break;
            case 'last_active':
                usort($studentData, function($a, $b) {
                    if (!$a['last_active']) return 1;
                    if (!$b['last_active']) return -1;
                    return $b['last_active'] <=> $a['last_active'];
                });
                break;
            case 'name':
                usort($studentData, fn($a, $b) => strcmp($a['name'], $b['name']));
                break;
            default:
                usort($studentData, fn($a, $b) => $b['completion_percentage'] <=> $a['completion_percentage']);
        }

        return $studentData;
    }
}
