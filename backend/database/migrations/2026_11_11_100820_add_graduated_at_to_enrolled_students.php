<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mark an LRN as graduated when a student leaves the school.
     * NULL = currently enrolled (Active); a timestamp = graduated on that date.
     * No backfill is needed — every existing row stays Active (NULL).
     */
    public function up(): void
    {
        Schema::table('enrolled_students', function (Blueprint $table) {
            $table->timestamp('graduated_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('enrolled_students', function (Blueprint $table) {
            $table->dropColumn('graduated_at');
        });
    }
};
