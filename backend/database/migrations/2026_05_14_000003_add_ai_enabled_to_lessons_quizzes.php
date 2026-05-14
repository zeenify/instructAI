<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->boolean('ai_enabled')->default(true)->after('is_published');
        });

        Schema::table('quizzes', function (Blueprint $table) {
            if (Schema::hasColumn('quizzes', 'allow_ai_assistance')) {
                $table->renameColumn('allow_ai_assistance', 'ai_enabled');
            } else {
                $table->boolean('ai_enabled')->default(false)->after('is_randomized');
            }
        });
    }

    public function down(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->dropColumn('ai_enabled');
        });

        Schema::table('quizzes', function (Blueprint $table) {
            if (Schema::hasColumn('quizzes', 'ai_enabled')) {
                $table->renameColumn('ai_enabled', 'allow_ai_assistance');
            }
        });
    }
};
