<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('submission_id')->constrained('activity_submissions')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('activity_questions')->cascadeOnDelete();
            $table->text('submitted_answer')->nullable();
            $table->boolean('is_correct')->nullable();
            $table->decimal('score', 8, 2)->nullable();
            $table->boolean('ai_evaluated')->default(false);
            $table->timestamps();

            $table->unique(['submission_id', 'question_id'], 'idx_ans_submission_question');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_answers');
    }
};
