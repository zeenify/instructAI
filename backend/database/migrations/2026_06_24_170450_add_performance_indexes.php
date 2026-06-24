<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quiz_attempts', function (Blueprint $table) {
            $table->index(['student_id', 'quiz_id', 'status'], 'idx_quiz_attempts_student_quiz_status');
        });

        Schema::table('code_submissions', function (Blueprint $table) {
            $table->index(['student_id', 'lesson_id'], 'idx_code_submissions_student_lesson');
        });

        Schema::table('modules', function (Blueprint $table) {
            $table->index(['course_id', 'order_index'], 'idx_modules_course_order');
        });

        Schema::table('lessons', function (Blueprint $table) {
            $table->index(['module_id', 'is_published', 'order_index'], 'idx_lessons_module_published_order');
        });

        Schema::table('quizzes', function (Blueprint $table) {
            $table->index(['module_id', 'is_published', 'order_index'], 'idx_quizzes_module_published_order');
        });
    }

    public function down(): void
    {
        Schema::table('quiz_attempts', function (Blueprint $table) {
            $table->dropIndex('idx_quiz_attempts_student_quiz_status');
        });
        Schema::table('code_submissions', function (Blueprint $table) {
            $table->dropIndex('idx_code_submissions_student_lesson');
        });
        Schema::table('modules', function (Blueprint $table) {
            $table->dropIndex('idx_modules_course_order');
        });
        Schema::table('lessons', function (Blueprint $table) {
            $table->dropIndex('idx_lessons_module_published_order');
        });
        Schema::table('quizzes', function (Blueprint $table) {
            $table->dropIndex('idx_quizzes_module_published_order');
        });
    }
};
