<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\Student\AIChatController;
use App\Http\Controllers\Student\ClassActivityController as StudentClassActivityController;
use App\Http\Controllers\Student\CodeExecutionController;
use App\Http\Controllers\Student\CourseController as StudentCourseController;
use App\Http\Controllers\Student\EnrollmentController;
use App\Http\Controllers\Student\LessonController as StudentLessonController;
use App\Http\Controllers\Student\QuizController as StudentQuizController;
use App\Http\Controllers\Student\ReviewerController;
use App\Http\Controllers\Student\TtsController;
use App\Http\Controllers\Teacher\AnalyticsController;
use App\Http\Controllers\Teacher\ClassActivityController;
// --- ADD STUDENT CONTROLLERS ---
use App\Http\Controllers\Teacher\ClassroomController;
use App\Http\Controllers\Teacher\CourseController;
use App\Http\Controllers\Teacher\IndexingController;
use App\Http\Controllers\Teacher\LessonController;
use App\Http\Controllers\Teacher\ModuleController;
use App\Http\Controllers\Teacher\QuestionController;
use App\Http\Controllers\Teacher\QuizController;
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

// Protected Routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        $user = $request->user();
        $profile = $user->role === 'teacher' ? 'teacherProfile' : 'studentProfile';

        return $user->load($profile);
    });

    Route::post('/logout', [AuthController::class, 'logout']);
});

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/teacher/classes', [ClassroomController::class, 'index']);
    Route::post('/teacher/classes', [ClassroomController::class, 'store']);
    Route::get('/teacher/classes/{id}', [ClassroomController::class, 'show']);
    Route::delete('/teacher/class/{id}', [ClassroomController::class, 'destroy']);

    Route::post('/teacher/classes/{classId}/courses', [CourseController::class, 'store']);
    Route::get('/teacher/courses/{id}', [CourseController::class, 'show']);
    Route::put('/teacher/courses/{id}', [CourseController::class, 'update']);
    Route::post('/teacher/courses/{id}/upload-curriculum', [CourseController::class, 'uploadCurriculum']);
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

    // delete
    Route::post('/teacher/courses/{id}/publish-all', [CourseController::class, 'publishAll']);
    Route::delete('/teacher/modules/{id}', [ModuleController::class, 'destroy']);
    Route::delete('/teacher/lessons/{id}', [LessonController::class, 'destroy']);
    Route::delete('/teacher/quizzes/{id}', [QuizController::class, 'destroy']);
    // ai
    Route::post('/teacher/courses/{id}/ai-commit', [CourseController::class, 'aiCommit']);
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

    // ==========================================
    // STUDENT ROUTES (NEW!)
    // ==========================================
    Route::get('/student/classes', [EnrollmentController::class, 'index']);
    Route::post('/student/enroll', [EnrollmentController::class, 'enroll']);

    Route::get('/student/classes/{id}', [StudentCourseController::class, 'showClass']);
    Route::get('/student/courses/{id}', [StudentCourseController::class, 'showCourse']);

    Route::get('/student/lessons/{id}', [StudentLessonController::class, 'show']);
    Route::post('/student/lessons/{id}/complete', [StudentLessonController::class, 'complete']);

    Route::get('/student/quizzes/{id}', [StudentQuizController::class, 'show']);
    Route::post('/student/attempts/{attemptId}/submit', [StudentQuizController::class, 'submitAttempt']);
    Route::post('/student/lessons/{id}/submit-code', [StudentLessonController::class, 'submitCode']);
    Route::post('/student/quizzes/{id}/submit', [StudentQuizController::class, 'submit']);

    // Remote Code Execution Proxy
    Route::post('/student/execute', [CodeExecutionController::class, 'execute']);
    Route::post('/ai/verify-code-challenge', [CodeExecutionController::class, 'verifyCodeChallenge']);

    // AI Chat (Student)
    Route::post('/student/ai/chat', [AIChatController::class, 'chat']);
    Route::post('/student/ai/history', [AIChatController::class, 'loadHistory']);
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
    Route::get('/teacher/classes/{classId}/activities', [ClassActivityController::class, 'index']);
    Route::post('/teacher/classes/{classId}/activities', [ClassActivityController::class, 'store']);
    Route::get('/teacher/activities/{id}', [ClassActivityController::class, 'show']);
    Route::put('/teacher/activities/{id}', [ClassActivityController::class, 'update']);
    Route::delete('/teacher/activities/{id}', [ClassActivityController::class, 'destroy']);
    Route::post('/teacher/activities/{id}/publish', [ClassActivityController::class, 'togglePublish']);

    // Activity Questions
    Route::post('/teacher/activities/{activityId}/questions', [ClassActivityController::class, 'storeQuestion']);
    Route::put('/teacher/activities/{activityId}/questions/{questionId}', [ClassActivityController::class, 'updateQuestion']);
    Route::delete('/teacher/activities/{activityId}/questions/{questionId}', [ClassActivityController::class, 'destroyQuestion']);
    Route::post('/teacher/activities/{activityId}/questions/reorder', [ClassActivityController::class, 'reorderQuestions']);

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
