<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_chat_logs', function (Blueprint $table) {
            $table->string('character_name')->after('class_id')->default('professor');
            $table->foreignId('lesson_id')->nullable()->after('character_name')->constrained('lessons')->onDelete('set null');
            $table->foreignId('quiz_id')->nullable()->after('lesson_id')->constrained('quizzes')->onDelete('set null');
            $table->enum('mode', ['normal', 'restricted'])->default('normal')->after('quiz_id');
            $table->json('context_metadata')->nullable()->after('mode');

            $table->index(['student_id', 'class_id', 'character_name', 'lesson_id']);
        });
    }

    public function down(): void
    {
        Schema::table('ai_chat_logs', function (Blueprint $table) {
            $table->dropIndex(['student_id', 'class_id', 'character_name', 'lesson_id']);
            $table->dropColumn(['character_name', 'lesson_id', 'quiz_id', 'mode', 'context_metadata']);
        });
    }
};
