<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('class_activities', function (Blueprint $table) {
            if (Schema::hasColumn('class_activities', 'has_file')) {
                $table->dropColumn(['has_file', 'has_questions']);
            }
        });

        Schema::table('class_activities', function (Blueprint $table) {
            if (! Schema::hasColumn('class_activities', 'submission_type')) {
                $table->string('submission_type')->nullable()->after('activity_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('class_activities', function (Blueprint $table) {
            if (Schema::hasColumn('class_activities', 'submission_type')) {
                $table->dropColumn('submission_type');
            }
        });

        Schema::table('class_activities', function (Blueprint $table) {
            if (! Schema::hasColumn('class_activities', 'has_file')) {
                $table->boolean('has_file')->default(false)->after('activity_type');
                $table->boolean('has_questions')->default(false)->after('has_file');
            }
        });
    }
};
