<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Update Student Profiles
        Schema::table('student_profiles', function (Blueprint $table) {
            // SQLite cannot drop a column while an index references it
            $table->dropUnique(['lrn_number']);
            $table->dropColumn(['lrn_number', 'grade_level']);
        });

        // Update Teacher Profiles
        Schema::table('teacher_profiles', function (Blueprint $table) {
            $table->dropUnique(['employee_id']);
            $table->dropColumn(['employee_id', 'department']);
            $table->string('organization')->nullable()->after('last_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // If we "rollback", we put the columns back
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->string('lrn_number')->unique()->nullable();
            $table->string('grade_level')->nullable();
        });

        Schema::table('teacher_profiles', function (Blueprint $table) {
            $table->string('employee_id')->unique()->nullable();
            $table->string('department')->nullable();
            $table->dropColumn('organization');
        });
    }
};