<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('class_activities', function (Blueprint $table) {
            // When a pause started — lets resume restore per-question deadlines
            // and student whole-quiz timers for the exact paused duration.
            $table->timestamp('live_paused_at')->nullable()->after('live_started_at');
        });
    }

    public function down(): void
    {
        Schema::table('class_activities', function (Blueprint $table) {
            $table->dropColumn('live_paused_at');
        });
    }
};
