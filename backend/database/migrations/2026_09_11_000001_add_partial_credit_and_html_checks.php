<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Coding-assessment overhaul:
     * - partial_credit: all-or-nothing test-case scoring by default; when true,
     *   a question awards points × (tests passed / total) like before.
     * - html_checks: structured DOM/style checks (JSON) for HTML/CSS/JS
     *   questions — run in the student's browser against the rendered page.
     * - activity_questions.reference_code: teacher reference solution for the
     *   activity "verify" runner (quiz questions already have it).
     */
    public function up(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->boolean('partial_credit')->default(false)->after('language');
            $table->json('html_checks')->nullable()->after('partial_credit');
        });

        Schema::table('activity_questions', function (Blueprint $table) {
            $table->boolean('partial_credit')->default(false)->after('language');
            $table->json('html_checks')->nullable()->after('partial_credit');
            $table->text('reference_code')->nullable()->after('html_checks');
        });

        Schema::table('activity_answers', function (Blueprint $table) {
            $table->json('test_results')->nullable()->after('score');
        });
    }

    public function down(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->dropColumn(['partial_credit', 'html_checks']);
        });

        Schema::table('activity_questions', function (Blueprint $table) {
            $table->dropColumn(['partial_credit', 'html_checks', 'reference_code']);
        });

        Schema::table('activity_answers', function (Blueprint $table) {
            $table->dropColumn('test_results');
        });
    }
};
