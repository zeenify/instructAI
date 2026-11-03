<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Quiz results are sealed until the teacher explicitly reveals them — a
 * student who finishes early must not be able to read (and share) correct
 * answers. Null = sealed; a timestamp = the moment the teacher revealed.
 * Applies to module quizzes and class-activity quiz rooms alike; teacher
 * surfaces are never gated by it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            $table->timestamp('results_revealed_at')->nullable()->after('ai_enabled');
        });

        Schema::table('class_activities', function (Blueprint $table) {
            $table->timestamp('results_revealed_at')->nullable()->after('show_results');
        });
    }

    public function down(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            $table->dropColumn('results_revealed_at');
        });

        Schema::table('class_activities', function (Blueprint $table) {
            $table->dropColumn('results_revealed_at');
        });
    }
};
