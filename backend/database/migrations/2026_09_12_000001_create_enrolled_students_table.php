<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Panel fix: sign-in/registration must be limited to Penaranda Senior High
     * School students. Teachers maintain this whitelist of official LRNs —
     * a student can only register (email or Google) with an LRN on this list.
     */
    public function up(): void
    {
        Schema::create('enrolled_students', function (Blueprint $table) {
            $table->id();
            $table->string('lrn_number', 12)->unique();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('grade_level')->nullable();
            $table->string('section')->nullable();
            $table->boolean('claimed')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enrolled_students');
    }
};
