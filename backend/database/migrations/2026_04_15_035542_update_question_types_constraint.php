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
        // We drop the old check and add the new one including all types
        DB::statement('ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_type_check');
        DB::statement("ALTER TABLE questions ADD CONSTRAINT questions_type_check CHECK (type IN ('multiple_choice', 'coding', 'identification', 'true_false', 'enumeration'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_type_check');
        DB::statement("ALTER TABLE questions ADD CONSTRAINT questions_type_check CHECK (type IN ('multiple_choice', 'coding'))");
    }
};
