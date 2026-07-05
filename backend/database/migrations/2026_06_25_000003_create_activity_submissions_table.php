<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('activity_id')->constrained('class_activities')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->string('status')->default('draft'); // draft, submitted, graded, returned
            $table->timestamp('submitted_at')->nullable();
            $table->decimal('score', 8, 2)->nullable();
            $table->decimal('max_score', 8, 2)->nullable();
            $table->timestamp('graded_at')->nullable();
            $table->foreignId('graded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('teacher_notes')->nullable();
            $table->text('content')->nullable();
            $table->json('attachments')->nullable();
            $table->boolean('is_late')->default(false);
            $table->timestamps();

            $table->unique(['activity_id', 'student_id'], 'idx_sub_activity_student');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_submissions');
    }
};
