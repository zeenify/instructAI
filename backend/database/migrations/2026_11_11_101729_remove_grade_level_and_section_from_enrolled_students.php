<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The whitelist used to carry grade_level and section columns, but this
     * system has no grade/section hierarchy — classes are flat named rooms
     * (Google-Classroom style). The fields were never enforced, never used
     * for access decisions, and only implied a model the school does not
     * have. Remove them so the schema matches reality.
     */
    public function up(): void
    {
        Schema::table('enrolled_students', function (Blueprint $table) {
            $table->dropColumn(['grade_level', 'section']);
        });
    }

    public function down(): void
    {
        Schema::table('enrolled_students', function (Blueprint $table) {
            $table->string('grade_level')->nullable()->after('last_name');
            $table->string('section')->nullable()->after('grade_level');
        });
    }
};
