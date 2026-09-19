<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            // The programming language this course teaches (python, java,
            // javascript, cpp, html). Set by the teacher in the Curriculum
            // modal; the AI generator treats it as a hard requirement so code
            // blocks and coding questions never drift into other languages.
            $table->string('language')->nullable()->after('is_coding');
        });
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('language');
        });
    }
};
