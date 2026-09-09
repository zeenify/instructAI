<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Test-case grading awards partial credit (e.g. 6.67 of 10) — integer
     * score columns would reject it.
     */
    public function up(): void
    {
        Schema::table('quiz_attempts', function (Blueprint $table) {
            $table->decimal('total_score', 8, 2)->default(0)->change();
            $table->decimal('max_score', 8, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('quiz_attempts', function (Blueprint $table) {
            $table->integer('total_score')->default(0)->change();
            $table->integer('max_score')->nullable()->change();
        });
    }
};
