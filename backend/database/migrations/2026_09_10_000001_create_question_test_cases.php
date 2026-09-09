<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Test-case grading infrastructure:
     * - question_test_cases: stdin/expected-output pairs attached to quiz or
     *   activity questions (morphed), optionally hidden from students.
     * - questions.reference_code: the teacher's reference solution, used by
     *   the "verify challenge" endpoint.
     * - student_answers.test_results: per-test pass/fail snapshot for review.
     */
    public function up(): void
    {
        Schema::create('question_test_cases', function (Blueprint $table) {
            $table->id();
            $table->string('testable_type');
            $table->unsignedBigInteger('testable_id');
            $table->text('input')->nullable();
            $table->text('expected_output');
            $table->boolean('hidden')->default(false)->comment('Hidden tests are invisible to students but still graded');
            $table->integer('order_index')->default(0);
            $table->timestamps();

            $table->index(['testable_type', 'testable_id', 'order_index'], 'idx_test_cases_testable_order');
        });

        Schema::table('questions', function (Blueprint $table) {
            $table->text('reference_code')->nullable()->after('language');
        });

        Schema::table('student_answers', function (Blueprint $table) {
            $table->json('test_results')->nullable()->after('submitted_answer');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('question_test_cases');

        Schema::table('questions', function (Blueprint $table) {
            $table->dropColumn('reference_code');
        });

        Schema::table('student_answers', function (Blueprint $table) {
            $table->dropColumn('test_results');
        });
    }
};
