<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('activity_id')->constrained('class_activities')->cascadeOnDelete();
            $table->string('type'); // multiple_choice, true_false, identification, enumeration, coding, short_answer, essay
            $table->text('question_text');
            $table->json('options')->nullable();
            $table->text('expected_output')->nullable();
            $table->decimal('points', 8, 2)->default(1);
            $table->text('boilerplate')->nullable();
            $table->integer('order_index')->default(0);
            $table->timestamps();

            $table->index(['activity_id', 'order_index'], 'idx_act_q_activity_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_questions');
    }
};
