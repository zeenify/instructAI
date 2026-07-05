<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('activity_type'); // quiz, activity
            $table->string('submission_type')->nullable(); // file, questions, material (null for quiz)
            $table->string('grading_method')->nullable(); // auto, manual, none
            $table->decimal('max_points', 8, 2)->nullable();
            $table->timestamp('deadline_at')->nullable();
            $table->string('deadline_behavior')->default('hard'); // hard, soft
            $table->boolean('late_submission')->default(false);
            $table->decimal('late_penalty_pct', 5, 2)->nullable();
            $table->float('time_limit_minutes')->nullable();
            $table->boolean('is_published')->default(false);
            $table->boolean('is_live')->default(false);
            $table->string('live_status')->nullable(); // scheduled, active, paused, completed
            $table->timestamp('live_scheduled_at')->nullable();
            $table->integer('live_current_q')->default(0);
            $table->integer('order_index')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['class_id', 'is_published', 'order_index'], 'idx_activities_class_published_order');
            $table->index(['class_id', 'activity_type'], 'idx_activities_class_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_activities');
    }
};
