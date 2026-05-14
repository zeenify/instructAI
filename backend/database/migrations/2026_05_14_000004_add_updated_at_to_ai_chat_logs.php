<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_chat_logs', function (Blueprint $table) {
            $table->timestamp('updated_at')->useCurrent()->after('created_at');
        });
    }

    public function down(): void
    {
        Schema::table('ai_chat_logs', function (Blueprint $table) {
            $table->dropColumn('updated_at');
        });
    }
};
