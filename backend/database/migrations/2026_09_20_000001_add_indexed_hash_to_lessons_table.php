<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            // Hash of the extracted text currently embedded in the vector
            // store — lets auto-indexing skip lessons whose content didn't
            // actually change (no repeated embedding cost on autosave)
            $table->string('indexed_hash')->nullable()->after('ai_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->dropColumn('indexed_hash');
        });
    }
};
