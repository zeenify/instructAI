<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Enable pgvector extension
        DB::statement('CREATE EXTENSION IF NOT EXISTS vector');

        // Document chunks for RAG
        Schema::create('document_chunks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained('classes')->onDelete('cascade');
            $table->foreignId('course_id')->nullable()->constrained('courses')->onDelete('cascade');
            $table->foreignId('lesson_id')->nullable()->constrained('lessons')->onDelete('cascade');
            $table->text('chunk_text');
            $table->vector('embedding', 384);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('class_id');
            $table->index('lesson_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_chunks');
    }
};
