<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The executor's result messages quote typed values and routinely
        // blow past varchar(255) — those audit rows were failing to insert
        // (silently, the writer logs and moves on), losing the trail.
        Schema::table('pilot_audit', function ($table) {
            $table->text('route')->nullable()->change();
            $table->text('explain')->nullable()->change();
            $table->text('message')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('pilot_audit', function ($table) {
            $table->string('route')->nullable()->change();
            $table->string('explain')->nullable()->change();
            $table->string('message')->nullable()->change();
        });
    }
};
