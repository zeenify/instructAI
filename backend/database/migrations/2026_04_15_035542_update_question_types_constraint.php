<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // PostgreSQL/MySQL only — SQLite does not support ALTER TABLE ... DROP CONSTRAINT
        if (DB::getDriverName() === 'pgsql' || DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_type_check');
            DB::statement("ALTER TABLE questions ADD CONSTRAINT questions_type_check CHECK (type IN ('multiple_choice', 'coding', 'identification', 'true_false', 'enumeration'))");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql' || DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_type_check');
            DB::statement("ALTER TABLE questions ADD CONSTRAINT questions_type_check CHECK (type IN ('multiple_choice', 'coding'))");
        }
    }
};
