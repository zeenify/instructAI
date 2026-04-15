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
        Schema::table('quizzes', function (Blueprint $table) {
            $table->boolean('allow_ai_assistance')->default(false)->after('is_randomized');
        });

        // Note: If you used an ENUM for question types, we need to allow the new ones.
        // Since we used a string with a CHECK constraint in our master migration,
        // we just need to ensure the Controller handles the logic.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
