<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('class_activities', function (Blueprint $table) {
            $table->string('pacing_mode')->default('student'); // student, teacher
            $table->string('timer_mode')->default('none'); // none, entire_quiz, per_question
            $table->json('per_question_durations')->nullable(); // {question_type: seconds} overrides
            $table->boolean('shuffle_questions')->default(false);
            $table->string('show_results')->default('room_close'); // immediate, room_close
            $table->timestamp('close_room_at')->nullable();
        });

        Schema::table('activity_submissions', function (Blueprint $table) {
            $table->timestamp('started_at')->nullable();
            $table->json('question_order')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->integer('current_question_idx')->default(0);
            $table->timestamp('room_closed_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('class_activities', function (Blueprint $table) {
            $table->dropColumn(['pacing_mode', 'timer_mode', 'per_question_durations', 'shuffle_questions', 'show_results', 'close_room_at']);
        });

        Schema::table('activity_submissions', function (Blueprint $table) {
            $table->dropColumn(['started_at', 'question_order', 'last_seen_at', 'current_question_idx', 'room_closed_at']);
        });
    }
};
