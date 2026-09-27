<?php

namespace App\Services;

use App\Models\Lesson;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Automatic vector indexing for the student AI Tutor.
 *
 * Runs behind the scenes after lesson saves and publish changes — teachers
 * never see or trigger it. Design rules:
 *
 *  - ONLY published lessons are indexed (drafts would leak to students
 *    through retrieval, which is course-scoped).
 *  - The extracted text is hashed; when the hash matches what's already in
 *    the vector store, the call is skipped entirely — no repeated embedding
 *    cost on autosave.
 *  - Unpublishing, clearing content, or deleting a lesson removes its chunks
 *    (deletion of the lesson row also cascades via FK).
 *  - Indexing runs in the `terminating` phase (after the HTTP response is
 *    sent), so saves and publish clicks never wait on it.
 */
class LessonIndexer
{
    /** Schedule indexing work to run after the current response is sent. */
    public static function schedule(Lesson $lesson): void
    {
        app()->terminating(function () use ($lesson) {
            try {
                self::sync($lesson->fresh() ?? $lesson);
            } catch (\Throwable $e) {
                Log::warning("LessonIndexer: sync failed for lesson {$lesson->id}: " . $e->getMessage());
            }
        });
    }

    /** Bring the vector store in line with this lesson's current state. */
    public static function sync(Lesson $lesson): void
    {
        if (!$lesson->relationLoaded('module.course')) {
            $lesson->load('module.course');
        }
        $course = $lesson->module->course ?? null;
        if (!$course) {
            return;
        }

        $text = trim(self::extractText($lesson->content));

        // Empty or unpublished → the tutor must not serve this lesson
        if (!$lesson->is_published || $text === '') {
            self::remove($lesson, $course);
            return;
        }

        $hash = sha1($text);
        if ($lesson->indexed_hash === $hash) {
            Log::info("LessonIndexer: lesson {$lesson->id} unchanged — skipping embedding");
            return;
        }

        $response = Http::timeout(30)->withHeaders(\App\Services\AiService::authHeader())->post(env('AI_SERVICE_URL') . '/ai/index-lesson', [
            'class_id' => $course->class_id,
            'course_id' => $course->id,
            'lesson_id' => $lesson->id,
            'content' => $text,
        ]);

        if ($response->successful() && $response->json('status') !== 'error') {
            $lesson->forceFill(['indexed_hash' => $hash])->saveQuietly();
            Log::info("LessonIndexer: lesson {$lesson->id} indexed (hash {$hash})");
        } else {
            Log::warning("LessonIndexer: indexing failed for lesson {$lesson->id}: " . $response->body());
        }
    }

    /** Remove a lesson's chunks from the vector store (unpublish/clear). */
    public static function remove(Lesson $lesson): void
    {
        if (!$lesson->relationLoaded('module.course')) {
            $lesson->load('module.course');
        }
        $course = $lesson->module->course ?? null;
        if (!$course) {
            return;
        }

        $response = Http::timeout(30)->withHeaders(\App\Services\AiService::authHeader())->post(env('AI_SERVICE_URL') . '/ai/index-lesson', [
            'class_id' => $course->class_id,
            'course_id' => $course->id,
            'lesson_id' => $lesson->id,
            'content' => '',
        ]);

        if ($response->successful()) {
            $lesson->forceFill(['indexed_hash' => null])->saveQuietly();
            Log::info("LessonIndexer: lesson {$lesson->id} chunks removed");
        }
    }

    /** TipTap JSON blocks → plain text (same rules the manual indexer used). */
    public static function extractText($content): string
    {
        if (is_string($content)) {
            $decoded = json_decode($content, true);
            $content = is_array($decoded) ? $decoded : [];
        }
        if (!is_array($content)) {
            return '';
        }

        $text = '';
        foreach ($content as $block) {
            $data = $block['data'] ?? [];
            switch ($block['type'] ?? '') {
                case 'h1':
                case 'h2':
                case 'text':
                    $plain = trim(strip_tags($data['text'] ?? ''));
                    if ($plain !== '') {
                        $text .= $plain . "\n\n";
                    }
                    break;
                case 'code':
                    $desc = trim(strip_tags($data['description'] ?? ''));
                    if ($desc !== '') {
                        $text .= "Code example ({$data['language']}): {$desc}\n\n";
                    }
                    break;
                case 'video':
                    $title = trim($data['title'] ?? '');
                    if ($title !== '') {
                        $text .= "Video: {$title}\n\n";
                    }
                    break;
                case 'link':
                    $title = trim($data['title'] ?? '');
                    if ($title !== '') {
                        $text .= "Resource: {$title} ({$data['url']})\n\n";
                    }
                    break;
            }
        }

        return $text;
    }
}
