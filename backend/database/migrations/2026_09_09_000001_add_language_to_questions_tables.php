<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Language for coding questions (quizzes + class activities) and lesson
     * code blocks live client-side in lesson.content JSON, so only the two
     * question tables need the column.
     */
    public function up(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->string('language', 20)->default('java')->after('boilerplate');
        });

        Schema::table('activity_questions', function (Blueprint $table) {
            $table->string('language', 20)->default('java')->after('boilerplate');
        });
    }

    public function down(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->dropColumn('language');
        });

        Schema::table('activity_questions', function (Blueprint $table) {
            $table->dropColumn('language');
        });
    }
};
