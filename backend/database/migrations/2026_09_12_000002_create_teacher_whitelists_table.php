<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Panel fix: teacher accounts also require school approval. The admin
     * maintains a whitelist of approved teacher emails — only emails on this
     * list can register (email or Google) as teachers.
     */
    public function up(): void
    {
        Schema::create('teacher_whitelists', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('position')->nullable();
            $table->boolean('claimed')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_whitelists');
    }
};
