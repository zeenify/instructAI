<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // EUNA Pilot conversation thread (one thread per teacher; tool traffic
        // inside a run travels in the Python turn payload, only start/answer
        // turns are persisted)
        Schema::create('pilot_messages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('teacher_id')->index();
            $table->string('run_id', 64)->nullable()->index();
            $table->string('route')->nullable();
            $table->string('sender', 16); // teacher | ai
            $table->text('message');
            $table->json('context_metadata')->nullable();
            $table->timestamps();
        });

        // Every command the agent executed, for the audit trail
        Schema::create('pilot_audit', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('teacher_id')->index();
            $table->string('run_id', 64)->nullable()->index();
            $table->string('route')->nullable();
            $table->string('explain')->nullable();
            $table->string('action', 32);
            $table->unsignedInteger('ref')->nullable();
            $table->boolean('ok')->nullable();
            $table->boolean('blocked')->nullable();
            $table->string('message')->nullable();
            $table->json('command')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pilot_audit');
        Schema::dropIfExists('pilot_messages');
    }
};
