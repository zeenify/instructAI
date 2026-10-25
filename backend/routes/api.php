<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\Student\AIChatController;
use App\Http\Controllers\Student\ClassActivityController as StudentClassActivityController;
use App\Http\Controllers\Student\CodeExecutionController;
use App\Http\Controllers\Student\CourseController as StudentCourseController;
use App\Http\Controllers\Student\EnrollmentController;
use App\Http\Controllers\Student\LessonController as StudentLessonController;
use App\Http\Controllers\Student\LiveQuizController;
use App\Http\Controllers\Student\QuizController as StudentQuizController;
use App\Http\Controllers\Student\ReviewerController;
use App\Http\Controllers\Student\TtsController;
use App\Http\Controllers\Teacher\AnalyticsController;
use App\Http\Controllers\Teacher\ClassActivityController;
use App\Http\Controllers\Teacher\CodeRunController;
use App\Http\Controllers\Teacher\ActivityQuestionController;
use App\Http\Controllers\Teacher\ActivityAiController;
use App\Http\Controllers\Teacher\ClassroomController;
use App\Http\Controllers\Admin\OverviewController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\ClassController;
use App\Http\Controllers\Admin\SystemController;
use App\Http\Controllers\Admin\StudentWhitelistController;
use App\Http\Controllers\Admin\TeacherWhitelistController;
use App\Http\Controllers\Teacher\CourseController;
use App\Http\Controllers\Teacher\IndexingController;
use App\Http\Controllers\Teacher\LessonController;
use App\Http\Controllers\Teacher\ModuleController;
use App\Http\Controllers\Teacher\QuestionController;
use App\Http\Controllers\Teacher\QuizController;
use App\Http\Controllers\Teacher\PilotController;
use App\Http\Controllers\Teacher\StudentMonitorController;
use App\Models\Enrollment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Public Routes
Route::post('/register/student', [AuthController::class, 'registerStudent']);
Route::post('/register/teacher', [AuthController::class, 'registerTeacher']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/login/google', [AuthController::class, 'loginWithGoogle']);
Route::post('/chat/message', [ChatController::class, 'chat']);
Route::post('/euna/tts', [ChatController::class, 'tts'])->middleware('throttle:20,1');

// Protected Routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        $user = $request->user();
        if ($user->role === 'admin') {
            // Admins have no profile row; their email + role is the identity.
            return $user;
        }

        return $user->load($user->role === 'teacher' ? 'teacherProfile' : 'studentProfile');
    });

    Route::post('/logout', [AuthController::class, 'logout']);
});

// ── TEACHER routes — role-checked: only teacher accounts may drive content,
// grading, live sessions and the EUNA pilot.
Route::middleware(['auth:sanctum', 'role:teacher'])->group(function () {
    Route::get('/teacher/classes', [ClassroomController::class, 'index']);
    Route::post('/teacher/classes', [ClassroomController::class, 'store']);
    Route::get('/teacher/classes/{id}', [ClassroomController::class, 'show']);
    Route::get('/teacher/classes/{id}/copy-preview', [ClassroomController::class, 'copyPreview']);
    Route::post('/teacher/classes/{id}/copy-from', [ClassroomController::class, 'copyFrom']);
    Route::delete('/teacher/class/{id}', [ClassroomController::class, 'destroy']);
    Route::get('/teacher/overview', [ClassroomController::class, 'overview']);
    Route::put('/teacher/classes/{id}/color', [ClassroomController::class, 'updateColor']);

    Route::post('/teacher/classes/{classId}/courses', [CourseController::class, 'store']);
    Route::get('/teacher/courses/{id}', [CourseController::class, 'show']);
    Route::put('/teacher/courses/{id}', [CourseController::class, 'update']);
    Route::post('/teacher/courses/{id}/upload-curriculum', [CourseController::class, 'uploadCurriculum']);
    Route::delete('/teacher/courses/{id}/curriculum', [CourseController::class, 'destroyCurriculum']);
    Route::post('/teacher/courses/{courseId}/modules', [ModuleController::class, 'store']);
    Route::post('/teacher/courses/{courseId}/modules/reorder', [ModuleController::class, 'reorderModules']);
    Route::put('/teacher/modules/{id}', [ModuleController::class, 'update']);
    Route::post('/teacher/courses/{id}/publish', [CourseController::class, 'togglePublish']);
    Route::post('/teacher/courses/{id}/ai-generate', [CourseController::class, 'generateWithAI']);
    Route::post('/teacher/courses/{id}/ai-generate-content', [CourseController::class, 'generateContent']);

    Route::post('/teacher/modules/{moduleId}/lessons', [LessonController::class, 'store']);
    Route::post('/teacher/modules/{moduleId}/quizzes', [QuizController::class, 'store']);
    Route::post('/teacher/modules/{moduleId}/reorder', [ModuleController::class, 'reorderItems']);

    Route::get('/teacher/lessons/{id}', [LessonController::class, 'show']);
    Route::put('/teacher/lessons/{id}', [LessonController::class, 'update']);
    Route::post('/teacher/lessons/upload-image', [LessonController::class, 'uploadImage']);

    // Quiz Management
    Route::get('/teacher/quizzes/{id}', [QuizController::class, 'show']);
    Route::put('/teacher/quizzes/{id}', [QuizController::class, 'update']);
    // Question Management
    Route::post('/teacher/quizzes/{quizId}/questions', [QuestionController::class, 'store']);
    Route::put('/teacher/questions/{id}', [QuestionController::class, 'update']);
    Route::post('/teacher/quizzes/{id}/reorder-questions', [QuestionController::class, 'reorder']);
    Route::delete('/teacher/questions/{id}', [QuestionController::class, 'destroy']);

    // Test cases + challenge verification (teacher-authored coding challenges)
    Route::get('/teacher/questions/{id}/test-cases', [QuestionController::class, 'testCases']);
    Route::put('/teacher/questions/{id}/test-cases', [QuestionController::class, 'updateTestCases']);
    Route::post('/teacher/questions/{id}/verify', [QuestionController::class, 'verify']);
    // Same for ACTIVITY coding questions (mirrors the quiz endpoints)
    Route::get('/teacher/activity-questions/{id}/test-cases', [ActivityQuestionController::class, 'testCases']);
    Route::put('/teacher/activity-questions/{id}/test-cases', [ActivityQuestionController::class, 'updateTestCases']);
    Route::post('/teacher/activity-questions/{id}/verify', [ActivityQuestionController::class, 'verify']);
    Route::post('/teacher/run-code', [CodeRunController::class, 'run'])->middleware('throttle:code-execution');
    // Which languages the engine can actually run (runtime installed or not)
    Route::get('/teacher/engine-languages', [CodeRunController::class, 'languages']);

    // delete
    Route::post('/teacher/courses/{id}/publish-all', [CourseController::class, 'publishAll']);
    Route::delete('/teacher/modules/{id}', [ModuleController::class, 'destroy']);
    Route::delete('/teacher/lessons/{id}', [LessonController::class, 'destroy']);
    Route::delete('/teacher/quizzes/{id}', [QuizController::class, 'destroy']);
    // ai
    Route::post('/teacher/courses/{id}/ai-commit', [CourseController::class, 'aiCommit']);
    Route::post('/teacher/courses/{id}/ai-prepare-stream', [CourseController::class, 'aiPrepareStream']);
    Route::post('/teacher/courses/{id}/ai-save-item', [CourseController::class, 'aiSaveItem']);
    Route::delete('/teacher/courses/{id}', [CourseController::class, 'destroy']);

    // Stats for Overview
    Route::get('/teacher/stats', function (Request $request) {
        $user = $request->user();
        // Count real data from Neon
        $classesCount = $user->managedClasses()->count();
        $studentsCount = Enrollment::whereIn('class_id', $user->managedClasses()->pluck('id'))->count();

        return [
            'classes_count' => $classesCount,
            'students_count' => $studentsCount,
            'tokens_status' => 'Healthy',
        ];
    });

    // EUNA Pilot (teacher dashboard copilot) — prepare signs the payload the
    // browser streams straight to Python; commit persists turn + audit rows;
    // lookup is the allowlisted teacher-scoped read API.
    // Throttled: prepare mints Gemini-backed streams and message rows, and
    // none of this had a limiter before.
    Route::post('/teacher/ai/pilot-prepare', [PilotController::class, 'prepare'])->middleware('throttle:30,1');
    Route::post('/teacher/ai/pilot-commit', [PilotController::class, 'commit'])->middleware('throttle:60,1');
    Route::post('/teacher/ai/pilot-lookup', [PilotController::class, 'lookup'])->middleware('throttle:60,1');

    // Indexing (Teacher)
    Route::post('/teacher/courses/{id}/index', [IndexingController::class, 'indexCourse']);
    Route::post('/teacher/lessons/{id}/index', [IndexingController::class, 'indexLesson']);
    Route::get('/teacher/courses/{id}/indexing-stats', [IndexingController::class, 'getIndexingStats']);
    Route::post('/teacher/courses/{id}/test-search', [IndexingController::class, 'testSearch']);

    // Student Monitoring (Teacher)
    Route::get('/teacher/classes/{classId}/courses/{courseId}/monitor/stats', [StudentMonitorController::class, 'getMonitorStats']);
    Route::get('/teacher/classes/{classId}/courses/{courseId}/monitor/students', [StudentMonitorController::class, 'getMonitorStudents']);
    Route::get('/teacher/classes/{classId}/courses/{courseId}/monitor/student/{studentId}', [StudentMonitorController::class, 'getStudentProfile']);

    // Analytics Routes
    Route::get('/teacher/classes/{classId}/courses/{courseId}/analytics/overview', [AnalyticsController::class, 'getOverview']);
    Route::get('/teacher/classes/{classId}/courses/{courseId}/analytics/performance-trend', [AnalyticsController::class, 'getPerformanceTrend']);
    Route::get('/teacher/classes/{classId}/courses/{courseId}/analytics/quiz-scores', [AnalyticsController::class, 'getQuizScores']);
    Route::get('/teacher/classes/{classId}/courses/{courseId}/analytics/content-engagement', [AnalyticsController::class, 'getContentEngagement']);

    // ── Classwork / Activities (Standalone assessments, quizzes, assignments) ──
    Route::get('/teacher/grading-queue', [ClassActivityController::class, 'gradingQueue']);
    Route::get('/teacher/classes/{classId}/activities', [ClassActivityController::class, 'index']);
    Route::post('/teacher/classes/{classId}/activities', [ClassActivityController::class, 'store']);
    Route::get('/teacher/activities/{id}', [ClassActivityController::class, 'show']);
    Route::put('/teacher/activities/{id}', [ClassActivityController::class, 'update']);
    Route::delete('/teacher/activities/{id}', [ClassActivityController::class, 'destroy']);
    Route::post('/teacher/activities/{id}/publish', [ClassActivityController::class, 'togglePublish']);
    Route::post('/teacher/activities/{id}/repost', [ClassActivityController::class, 'repost']);
    Route::post('/teacher/activities/{id}/start-live', [ClassActivityController::class, 'startLive']);
    Route::post('/teacher/activities/{id}/pause-live', [ClassActivityController::class, 'pauseLive']);
    Route::post('/teacher/activities/{id}/resume-live', [ClassActivityController::class, 'resumeLive']);
    Route::post('/teacher/activities/{id}/end-live', [ClassActivityController::class, 'endLive']);
    Route::post('/teacher/activities/{id}/reopen-live', [ClassActivityController::class, 'reopenLive']);
    Route::post('/teacher/activities/{id}/finalize-live', [ClassActivityController::class, 'finalizeLive']);
    Route::post('/teacher/activities/{id}/live/question', [ClassActivityController::class, 'setLiveQuestion']);
    Route::post('/teacher/activities/{id}/live/reveal', [ClassActivityController::class, 'revealLiveQuestion']);
    Route::get('/teacher/activities/{id}/live-board', [ClassActivityController::class, 'liveBoard']);

    Route::get('/teacher/activities/{id}/live-progress', [ClassActivityController::class, 'liveProgress']);

    Route::get('/teacher/activities/{id}/results-analysis', [ClassActivityController::class, 'resultsAnalysis']);

    // Live code monitoring + similarity flags
    Route::get('/teacher/activities/{id}/live-drafts', [ClassActivityController::class, 'liveDrafts']);
    Route::get('/teacher/activities/{id}/similarity', [ClassActivityController::class, 'similarity']);
    // Activity Questions
    Route::post('/teacher/activities/{activityId}/questions', [ClassActivityController::class, 'storeQuestion']);
    Route::put('/teacher/activities/{activityId}/questions/{questionId}', [ClassActivityController::class, 'updateQuestion']);
    Route::delete('/teacher/activities/{activityId}/questions/{questionId}', [ClassActivityController::class, 'destroyQuestion']);
    Route::post('/teacher/activities/{activityId}/questions/reorder', [ClassActivityController::class, 'reorderQuestions']);

    // Activity AI question generation (context tree → stream → commit)
    Route::get('/teacher/activities/{activityId}/ai-context', [ActivityAiController::class, 'context']);
    Route::post('/teacher/activities/{activityId}/ai-generate-prepare', [ActivityAiController::class, 'prepareGenerate']);
    Route::post('/teacher/activities/{activityId}/ai-generate-questions', [ActivityAiController::class, 'generate']);
    Route::post('/teacher/activities/{activityId}/ai-commit-questions', [ActivityAiController::class, 'commit']);

    // Activity Instruction Files
    Route::post('/teacher/activities/{id}/upload-instruction-file', [ClassActivityController::class, 'uploadInstructionFile']);
    Route::post('/teacher/activities/{id}/delete-instruction-file', [ClassActivityController::class, 'deleteInstructionFile']);

    // Activity Submissions (Grading)
    Route::get('/teacher/activities/{activityId}/submissions', [ClassActivityController::class, 'submissions']);
    Route::post('/teacher/activities/{activityId}/submissions/{submissionId}/grade', [ClassActivityController::class, 'gradeSubmission']);
    Route::get('/teacher/activities/{activityId}/enrolled-students', [ClassActivityController::class, 'getEnrolledWithStatus']);
    Route::post('/teacher/activities/{activityId}/grade-bulk', [ClassActivityController::class, 'gradeBulk']);

    // Gradebook
    Route::get('/teacher/classes/{classId}/gradebook', [ClassActivityController::class, 'gradebook']);
});

// ── STUDENT routes — role-checked.
Route::middleware(['auth:sanctum', 'role:student'])->group(function () {
    Route::get('/student/classes', [EnrollmentController::class, 'index']);
    Route::post('/student/enroll', [EnrollmentController::class, 'enroll']);

    Route::get('/student/classes/{id}', [StudentCourseController::class, 'showClass']);
    Route::get('/student/courses/{id}', [StudentCourseController::class, 'showCourse']);

    Route::get('/student/lessons/{id}', [StudentLessonController::class, 'show']);
    Route::post('/student/lessons/{id}/complete', [StudentLessonController::class, 'complete']);

    Route::get('/student/quizzes/{id}', [StudentQuizController::class, 'show']);
    Route::post('/student/attempts/{attemptId}/answer', [StudentQuizController::class, 'saveAnswer']);
    Route::post('/student/lessons/{id}/submit-code', [StudentLessonController::class, 'submitCode']);
    Route::post('/student/quizzes/{id}/submit', [StudentQuizController::class, 'submit']);

    // Remote Code Execution Proxy — throttled: each run spawns a process
    Route::post('/student/execute', [CodeExecutionController::class, 'execute'])->middleware('throttle:code-execution');
    Route::post('/student/execute-batch', [CodeExecutionController::class, 'executeBatch'])->middleware('throttle:code-execution');

    // AI Chat (Student) — streaming goes browser → Python directly;
    // Laravel runs the checks (prepare) and persists the turn (commit)
    Route::post('/student/ai/chat', [AIChatController::class, 'chat']);
    Route::post('/student/ai/chat-prepare', [AIChatController::class, 'chatPrepare']);
    Route::post('/student/ai/chat-commit', [AIChatController::class, 'chatCommit']);
    Route::post('/student/ai/history', [AIChatController::class, 'loadHistory']);
    Route::post('/student/ai/clear', [AIChatController::class, 'clearHistory']);

    Route::post('/student/generate-reviewer', [ReviewerController::class, 'generate']);
    Route::post('/student/reviewer/transform-tts', [ReviewerController::class, 'transformTts']);
    Route::post('/student/extract-text', [ReviewerController::class, 'extractText']);
    Route::post('/student/tts', [TtsController::class, 'synthesize']);
    Route::get('/student/tts/voices', [TtsController::class, 'voices']);

    // Student Class Activities
    Route::get('/student/classes/{classId}/activities', [StudentClassActivityController::class, 'index']);
    Route::get('/student/activities/{id}', [StudentClassActivityController::class, 'show']);
    Route::post('/student/activities/{id}/submit', [StudentClassActivityController::class, 'submit']);
    Route::post('/student/activities/{id}/unsubmit', [StudentClassActivityController::class, 'unsubmit']);
    Route::post('/student/activities/{id}/upload-file', [StudentClassActivityController::class, 'uploadFile']);
    Route::delete('/student/activities/{id}/remove-file', [StudentClassActivityController::class, 'removeFile']);

    // Student Live Quiz (student-paced)
    Route::post('/student/activities/{id}/quiz/join', [LiveQuizController::class, 'join']);
    Route::post('/student/activities/{id}/quiz/start', [LiveQuizController::class, 'start']);
    Route::post('/student/activities/{id}/quiz/answers', [LiveQuizController::class, 'answers']);
    Route::post('/student/activities/{id}/quiz/advance', [LiveQuizController::class, 'advance']);
    Route::post('/student/activities/{id}/quiz/finish', [LiveQuizController::class, 'finish']);
    Route::post('/student/activities/{id}/quiz/heartbeat', [LiveQuizController::class, 'heartbeat']);
    Route::get('/student/activities/{id}/quiz/state', [LiveQuizController::class, 'state']);
});

// Challenge verification backs the lesson coding flow students run — either
// authenticated role may call it.
Route::middleware(['auth:sanctum', 'role:student,teacher'])->group(function () {
    Route::post('/ai/verify-code-challenge', [CodeExecutionController::class, 'verifyCodeChallenge'])->middleware('throttle:code-execution');
});

// ── ADMIN routes — enrollment whitelists gate registration itself; only
// LRNs/emails on these lists can register as students/teachers of
// Penaranda Senior High School. The rest is the school-wide ops panel.
Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::get('/admin/student-whitelist', [StudentWhitelistController::class, 'index']);
    Route::post('/admin/student-whitelist', [StudentWhitelistController::class, 'store']);
    Route::delete('/admin/student-whitelist/{id}', [StudentWhitelistController::class, 'destroy']);

    Route::get('/admin/teacher-whitelist', [TeacherWhitelistController::class, 'index']);
    Route::post('/admin/teacher-whitelist', [TeacherWhitelistController::class, 'store']);
    Route::delete('/admin/teacher-whitelist/{id}', [TeacherWhitelistController::class, 'destroy']);

    // Panel: overview stats, user management, class oversight, system status.
    Route::get('/admin/overview', [OverviewController::class, 'index']);

    Route::get('/admin/users', [UserController::class, 'index']);
    Route::post('/admin/users/{user}/disable', [UserController::class, 'disable']);
    Route::post('/admin/users/{user}/enable', [UserController::class, 'enable']);
    Route::post('/admin/users/{user}/reset-password', [UserController::class, 'resetPassword']);
    Route::delete('/admin/users/{user}', [UserController::class, 'destroy']);

    Route::get('/admin/classes', [ClassController::class, 'index']);

    Route::get('/admin/system', [SystemController::class, 'index']);
});
