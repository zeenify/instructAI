<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->string('lrn_number', 12)->nullable()->after('last_name');
        });

        // Backfill existing rows with temporary unique LRNs
        $existing = DB::table('student_profiles')->whereNull('lrn_number')->get();
        foreach ($existing as $profile) {
            $tempLrn = 'TEMP' . str_pad($profile->id, 8, '0', STR_PAD_LEFT);
            DB::table('student_profiles')
                ->where('id', $profile->id)
                ->update(['lrn_number' => $tempLrn]);
        }

        Schema::table('student_profiles', function (Blueprint $table) {
            $table->string('lrn_number', 12)->nullable(false)->change();
            $table->unique('lrn_number');
        });
    }

    public function down(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn('lrn_number');
        });
    }
};
