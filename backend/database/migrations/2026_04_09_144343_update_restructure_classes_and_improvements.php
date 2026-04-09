<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create the NEW Classes table
        Schema::create('classes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
            $table->string('name');
            $table->string('class_code')->unique();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        // 2. Restructure Courses
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('class_code'); // Moving this to Classes
            $table->foreignId('class_id')->after('teacher_id')->constrained('classes')->onDelete('cascade');
            $table->boolean('is_published')->default(false);
            $table->integer('order_index')->default(0);
        });

        // 3. Restructure Enrollments (Link to Class instead of Course)
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropForeign(['course_id']);
            $table->dropUnique(['student_id', 'course_id']);
            $table->dropColumn('course_id');
            
            $table->foreignId('class_id')->constrained('classes')->onDelete('cascade');
            $table->unique(['student_id', 'class_id']);
        });

        // 4. Restructure AI Chat Logs (Link to Class)
        Schema::table('ai_chat_logs', function (Blueprint $table) {
            $table->dropForeign(['course_id']);
            $table->dropColumn('course_id');
            $table->foreignId('class_id')->constrained('classes')->onDelete('cascade');
        });

        // 5. Add status to Modules
        Schema::table('modules', function (Blueprint $table) {
            $table->boolean('is_published')->default(false);
        });

        // 6. Add status to Lessons
        Schema::table('lessons', function (Blueprint $table) {
            $table->boolean('is_published')->default(false);
        });

        // 7. Add time limit to Quizzes
        Schema::table('quizzes', function (Blueprint $table) {
            $table->integer('time_limit_minutes')->nullable();
        });

        // 8. Add Analytics timestamps
        Schema::table('quiz_attempts', function (Blueprint $table) {
            $table->timestamp('finished_at')->nullable();
        });

        Schema::table('student_answers', function (Blueprint $table) {
            $table->timestamp('answered_at')->nullable();
        });

        // 9. Create Code Submissions table
        Schema::create('code_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('lesson_id')->constrained('lessons')->onDelete('cascade');
            $table->text('code');
            $table->text('output')->nullable();
            $table->timestamp('submitted_at')->useCurrent();
        });

        // 10. Create Notifications table
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('type'); // e.g., 'course_published', 'quiz_graded'
            $table->text('message');
            $table->boolean('is_read')->default(false);
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        // Reverse steps in logic order
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('code_submissions');
        
        Schema::table('student_answers', function (Blueprint $table) { $table->dropColumn('answered_at'); });
        Schema::table('quiz_attempts', function (Blueprint $table) { $table->dropColumn('finished_at'); });
        Schema::table('quizzes', function (Blueprint $table) { $table->dropColumn('time_limit_minutes'); });
        Schema::table('lessons', function (Blueprint $table) { $table->dropColumn('is_published'); });
        Schema::table('modules', function (Blueprint $table) { $table->dropColumn('is_published'); });

        Schema::table('ai_chat_logs', function (Blueprint $table) {
            $table->dropForeign(['class_id']);
            $table->dropColumn('class_id');
            $table->foreignId('course_id')->constrained('courses')->onDelete('cascade');
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropForeign(['class_id']);
            $table->dropUnique(['student_id', 'class_id']);
            $table->dropColumn('class_id');
            $table->foreignId('course_id')->constrained('courses')->onDelete('cascade');
            $table->unique(['student_id', 'course_id']);
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->string('class_code')->unique()->nullable();
            $table->dropForeign(['class_id']);
            $table->dropColumn(['class_id', 'is_published', 'order_index']);
        });

        Schema::dropIfExists('classes');
    }
};