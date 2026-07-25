<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class ReviewerController extends Controller
{
    public function generate(Request $request)
    {
        $request->validate([
            'lesson_content' => 'required|string',
            'lesson_title' => 'nullable|string|max:255',
            'reviewer_types' => 'nullable|array',
            'reviewer_types.*' => 'string|in:flashcards,cloze,practice,summary',
            'counts' => 'nullable|array',
            'difficulty' => 'nullable|string|in:easy,medium,hard',
        ]);

        $student = $request->user();

        try {
            $response = Http::timeout(120)
                ->post(env('AI_SERVICE_URL') . '/ai/generate-reviewer', [
                    'lesson_content' => $request->lesson_content,
                    'lesson_title' => $request->input('lesson_title', ''),
                    'reviewer_types' => $request->input('reviewer_types', ['flashcards', 'cloze', 'practice', 'summary']),
                    'counts' => $request->input('counts', []),
                    'difficulty' => $request->input('difficulty', 'medium'),
                ]);

            if (!$response->successful()) {
                return response()->json(['error' => 'AI service error: ' . $response->body()], 500);
            }

            return response()->stream(function () use ($response) {
                $body = $response->getBody();
                while (!$body->eof()) {
                    echo $body->read(1024);
                    ob_flush();
                    flush();
                }
            }, 200, ['Content-Type' => 'text/event-stream']);
        } catch (\Exception $e) {
            \Log::error('Reviewer generation error: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to connect to AI service'], 500);
        }
    }

    public function extractText(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,docx,txt|max:51200',
        ]);

        try {
            $file = $request->file('file');
            $aiServiceUrl = env('AI_SERVICE_URL', 'http://localhost:8001');

            $response = Http::timeout(60)
                ->attach('file', file_get_contents($file->getPathname()), $file->getClientOriginalName())
                ->post($aiServiceUrl . '/ai/extract-text');

            if (!$response->successful()) {
                return response()->json(['error' => 'Extraction service error'], 500);
            }

            return $response->json();
        } catch (\Exception $e) {
            \Log::error('Text extraction error: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to extract text: ' . $e->getMessage()], 500);
        }
    }
}
