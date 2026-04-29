<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            $table->integer('passing_score')->default(1)->after('time_limit_minutes');
        });

        Schema::table('questions', function (Blueprint $table) {
            $table->text('boilerplate')->nullable()->after('question_text');
        });
    }
};
