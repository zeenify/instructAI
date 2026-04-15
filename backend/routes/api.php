<?php
use Illuminate\Http\Request;
use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Teacher\ClassroomController;
use App\Http\Controllers\Teacher\CourseController; 
use App\Http\Controllers\Teacher\ModuleController;
use App\Http\Controllers\Teacher\LessonController; 
use App\Http\Controllers\Teacher\QuizController;   
use App\Http\Controllers\Teacher\QuestionController;

// Public Routes
Route::post('/register/student', [AuthController::class, 'registerStudent']);
Route::post('/register/teacher', [AuthController::class, 'registerTeacher']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/login/google', [AuthController::class, 'loginWithGoogle']);

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

    // Inside the auth:sanctum group...
    Route::post('/teacher/classes/{classId}/courses', [CourseController::class, 'store']);
    Route::get('/teacher/courses/{id}', [CourseController::class, 'show']);
    Route::post('/teacher/courses/{courseId}/modules', [ModuleController::class, 'store']);

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
    Route::delete('/teacher/questions/{id}', [QuestionController::class, 'destroy']);



    // Stats for Overview
    Route::get('/teacher/stats', function (Request $request) {
        return [
            'classes_count' => $request->user()->managedClasses()->count(),
            'students_count' => 0, // Update this later when enrollments work
            'tokens_status' => 'Healthy'
        ];
    });
});
