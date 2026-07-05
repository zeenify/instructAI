<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('class_activities', function (Blueprint $table) {
            $table->string('submission_type')->nullable()->after('activity_type');
        });

        DB::statement("
            UPDATE class_activities
            SET submission_type = CASE
                WHEN activity_type = 'quiz' THEN NULL
                WHEN has_file = true THEN 'file'
                WHEN has_questions = true THEN 'questions'
                ELSE 'material'
            END
        ");

        Schema::table('class_activities', function (Blueprint $table) {
            $table->dropColumn(['has_file', 'has_questions']);
        });
    }

    public function down(): void
    {
        Schema::table('class_activities', function (Blueprint $table) {
            $table->boolean('has_file')->default(false)->after('activity_type');
            $table->boolean('has_questions')->default(false)->after('has_file');
        });

        DB::statement("
            UPDATE class_activities
            SET has_file = (submission_type = 'file'),
                has_questions = (submission_type = 'questions')
        ");

        Schema::table('class_activities', function (Blueprint $table) {
            $table->dropColumn('submission_type');
        });
    }
};
