<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\DocumentChunk;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;

class IndexingController extends Controller
{
    public function getIndexingStats(Request $request, $id)
    {
        $course = Course::findOrFail($id);

        // Verify ownership
        if ($course->teacher_id != $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Get stats from database
        $stats = DB::table('document_chunks')
            ->where('class_id', $course->class_id)
            ->selectRaw('
                COUNT(*) as total_chunks,
                COUNT(DISTINCT lesson_id) as lessons_indexed,
                MAX(updated_at) as last_updated
            ')
            ->first();

        // Calculate approximate storage (384-dim vector = ~1.5KB per chunk, plus text)
        $avgBytesPerChunk = 1500 + 500; // embedding + text estimate
        $storageBytes = ($stats->total_chunks ?? 0) * $avgBytesPerChunk;
        $storageKB = round($storageBytes / 1024, 1);

        return response()->json([
            'total_chunks' => $stats->total_chunks ?? 0,
            'lessons_indexed' => $stats->lessons_indexed ?? 0,
            'storage_kb' => $storageKB,
            'last_updated' => $stats->last_updated,
        ]);
    }

    public function testSearch(Request $request, $id)
    {
        $request->validate([
            'query' => 'required|string|max:500',
        ]);

        $course = Course::findOrFail($id);

        // Verify ownership
        if ($course->teacher_id != $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        try {
            // Call FastAPI to embed and search
            $response = Http::timeout(30)->post(env('AI_SERVICE_URL') . '/ai/test-search', [
                'class_id' => $course->class_id,
                'query' => $request->input('query'),
            ]);

            if (!$response->successful()) {
                return response()->json(['error' => 'Search failed'], 500);
            }

            return response()->json($response->json());

        } catch (\Exception $e) {
            \Log::error('Test search error: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to test search'], 500);
        }
    }

    public function indexCourse(Request $request, $id)
    {
        $course = Course::with('modules.lessons')->findOrFail($id);

        // Verify ownership
        if ($course->teacher_id != $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        try {
            // Combine all course materials into one unified text
            $combinedContent = '';

            // Add curriculum if exists
            if ($course->curriculum_text) {
                $combinedContent .= "=== COURSE CURRICULUM ===\n\n";
                $combinedContent .= $course->curriculum_text . "\n\n";
            }

            // Add all lessons
            $lessonCount = 0;
            foreach ($course->modules as $module) {
                foreach ($module->lessons as $lesson) {
                    $lessonText = $this->extractLessonText($lesson->content);
                    if (!empty($lessonText)) {
                        $combinedContent .= "=== LESSON: {$lesson->title} ===\n\n";
                        $combinedContent .= $lessonText . "\n\n";
                        $lessonCount++;
                    }
                }
            }

            if (empty($combinedContent)) {
                return response()->json(['error' => 'No indexable content found in course'], 400);
            }

            // Send combined content to FastAPI for unified indexing
            $response = Http::timeout(60)->post(env('AI_SERVICE_URL') . '/ai/index-course-combined', [
                'class_id' => $course->class_id,
                'course_id' => $course->id,
                'combined_content' => $combinedContent,
            ]);

            if (!$response->successful()) {
                return response()->json(['error' => 'Indexing failed on AI service'], 500);
            }

            return response()->json([
                'message' => "Course indexed successfully. Indexed {$lessonCount} lessons + curriculum.",
                'lessons_indexed' => $lessonCount,
            ]);

        } catch (\Exception $e) {
            \Log::error('Indexing error: ' . $e->getMessage());
            return response()->json(['error' => 'Indexing failed: ' . $e->getMessage()], 500);
        }
    }

    public function indexLesson(Request $request, $id)
    {
        $lesson = Lesson::with('module.course')->findOrFail($id);

        // Verify ownership
        if ($lesson->module->course->teacher_id != $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $content = $this->extractLessonText($lesson->content);

        if (empty($content)) {
            return response()->json(['error' => 'Lesson has no indexable content'], 400);
        }

        try {
            Http::timeout(30)->post(env('AI_SERVICE_URL') . '/ai/index-lesson', [
                'class_id' => $lesson->module->course->class_id,
                'course_id' => $lesson->module->course->id,
                'lesson_id' => $lesson->id,
                'content' => $content,
            ]);

            return response()->json(['message' => 'Lesson indexed successfully']);

        } catch (\Exception $e) {
            \Log::error('Indexing error: ' . $e->getMessage());
            return response()->json(['error' => 'Indexing failed: ' . $e->getMessage()], 500);
        }
    }

    private function extractLessonText($content): string
    {
        if (!is_array($content)) return '';

        $text = '';
        foreach ($content as $block) {
            if (!is_array($block)) continue;

            if (isset($block['type'])) {
                // TipTap heading block
                if ($block['type'] === 'h1' && isset($block['data']['text'])) {
                    $text .= $block['data']['text'] . "\n\n";
                }
                // TipTap text block
                elseif ($block['type'] === 'text' && isset($block['data']['text'])) {
                    $text .= $block['data']['text'] . "\n\n";
                }
                // Code block - include description and language
                elseif ($block['type'] === 'code') {
                    if (isset($block['data']['description'])) {
                        $text .= "Code example: " . $block['data']['description'] . "\n";
                    }
                    if (isset($block['data']['language'])) {
                        $text .= "Language: " . $block['data']['language'] . "\n";
                    }
                    $text .= "\n";
                }
                // Image - include caption
                elseif ($block['type'] === 'image' && isset($block['data']['caption'])) {
                    $text .= "Image: " . $block['data']['caption'] . "\n\n";
                }
                // Video - include title and description
                elseif ($block['type'] === 'video') {
                    if (isset($block['data']['title'])) {
                        $text .= "Video: " . $block['data']['title'] . " ";
                    }
                    if (isset($block['data']['description'])) {
                        $text .= $block['data']['description'];
                    }
                    $text .= "\n\n";
                }
                // Link - include title and URL
                elseif ($block['type'] === 'link') {
                    if (isset($block['data']['title'])) {
                        $text .= "Link: " . $block['data']['title'] . " ";
                    }
                    if (isset($block['data']['url'])) {
                        $text .= "(" . $block['data']['url'] . ")";
                    }
                    $text .= "\n\n";
                }
            }
        }

        return trim($text);
    }
}
