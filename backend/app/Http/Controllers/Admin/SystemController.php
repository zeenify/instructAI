<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

class SystemController extends Controller
{
    // Probes are slow by nature; the panel polls this every minute, so the
    // result is cached briefly. Never leaks env VALUES — presence booleans only.
    public function index(): JsonResponse
    {
        return response()->json(Cache::remember('admin:system-status', 30, fn () => [
            'services' => $this->probeServices(),
            'config' => $this->configPresence(),
            'volumes' => $this->volumes(),
            'checked_at' => now()->toIso8601String(),
        ]));
    }

    private function probeServices(): array
    {
        return [
            $this->ping('AI Tutor service', rtrim(env('AI_SERVICE_URL') ?: 'http://127.0.0.1:8001', '/') . '/ai/characters'),
            $this->ping(
                'Execution engine',
                rtrim(env('EXECUTION_ENGINE_URL') ?: 'http://127.0.0.1:3000', '/') . '/languages',
                filled(env('EXECUTION_ENGINE_TOKEN')) ? ['X-Engine-Token' => env('EXECUTION_ENGINE_TOKEN')] : null
            ),
        ];
    }

    private function ping(string $label, string $url, ?array $headers = null): array
    {
        // The engine is open-access unless IT was given an ENGINE_TOKEN; a
        // tokenless backend header set is valid and must still be probed, so
        // the only refusal is a real connectivity failure below.

        $start = microtime(true);
        try {
            $call = Http::timeout(3)->connectTimeout(2);
            if ($headers) {
                $call = $call->withHeaders($headers);
            }
            $response = $call->get($url);
            $ms = (int) round((microtime(true) - $start) * 1000);

            return [
                'label' => $label,
                'url' => $url,
                'ok' => $response->successful(),
                'status' => $response->status(),
                'latency_ms' => $ms,
            ];
        } catch (\Throwable $e) {
            return [
                'label' => $label,
                'url' => $url,
                'ok' => false,
                'latency_ms' => (int) round((microtime(true) - $start) * 1000),
                'note' => 'Unreachable',
            ];
        }
    }

    private function configPresence(): array
    {
        return collect([
            'AI_SERVICE_SECRET' => env('AI_SERVICE_SECRET'),
            'GEMINI_API_KEY' => env('GEMINI_API_KEY'),
            'GROQ_API_KEY_CHAT' => env('GROQ_API_KEY_CHAT'),
            'FISH_API_KEY' => env('FISH_API_KEY'),
            'EXECUTION_ENGINE_TOKEN' => env('EXECUTION_ENGINE_TOKEN'),
            'GOOGLE_CLIENT_ID' => env('GOOGLE_CLIENT_ID'),
            'CLOUDINARY credentials' => env('CLOUDINARY_CLOUD_NAME') && env('CLOUDINARY_API_SECRET'),
        ])->map(fn ($v, $key) => ['key' => $key, 'set' => (bool) $v])->values()->all();
    }

    private function volumes(): array
    {
        $tables = [
            'Users' => 'users',
            'Classes' => 'classes',
            'Courses' => 'courses',
            'Modules' => 'modules',
            'Lessons' => 'lessons',
            'Quizzes' => 'quizzes',
            'Enrollments' => 'enrollments',
            'Classwork activities' => 'class_activities',
            'Activity submissions' => 'activity_submissions',
            'AI tutor messages' => 'ai_chat_logs',
        ];

        return collect($tables)
            ->filter(fn ($table) => Schema::hasTable($table))
            ->map(fn ($table, $label) => ['label' => $label, 'rows' => DB::table($table)->count()])
            ->values()->all();
    }
}
