<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('class_activities', function (Blueprint $table) {
            $table->timestamp('live_question_deadline_at')->nullable()->after('live_current_q');
            $table->timestamp('live_question_revealed_at')->nullable()->after('live_question_deadline_at');
        });
    }

    public function down(): void
    {
        Schema::table('class_activities', function (Blueprint $table) {
            $table->dropColumn(['live_question_deadline_at', 'live_question_revealed_at']);
        });
    }
};
