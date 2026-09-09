<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Shared client for the instruct-execute engine.
 *
 * Tries the locally running engine first (dev convenience), then falls back to
 * the deployed EXECUTION_ENGINE_URL. Used by the student execute proxy and by
 * quiz grading so both paths behave identically.
 */
class CodeRunner
{
    /**
     * Languages the platform understands end to end. 'html' never reaches the
     * engine — the browser preview is its runtime — but it is accepted as a
     * coding-question language.
     */
    public const LANGUAGES = ['java', 'python', 'javascript', 'cpp', 'html'];

    /**
     * @return array{stdout: string, stderr: string, compile_output: string, exit_code: int|null, timed_out: bool}
     */
    public static function execute(string $language, string $code, ?string $input = null): array
    {
        $payload = [
            'language' => $language,
            'code' => $code,
        ];

        if ($input !== null && $input !== '') {
            $payload['input'] = $input;
        }

        $localUrl = 'http://localhost:3000/execute';
        $deployedUrl = rtrim((string) env('EXECUTION_ENGINE_URL'), '/');
        if ($deployedUrl !== '' && ! str_ends_with($deployedUrl, '/execute')) {
            $deployedUrl .= '/execute';
        }

        try {
            $response = Http::timeout(25)->post($localUrl, $payload);

            if ($response->successful()) {
                return self::normalize($response->json());
            }

            Log::warning('CodeRunner: local engine responded unhealthy', ['status' => $response->status()]);
        } catch (\Throwable $e) {
            Log::info('CodeRunner: local engine unreachable, falling back', ['error' => $e->getMessage()]);
        }

        if ($deployedUrl === '') {
            return self::engineError('No execution engine is configured.');
        }

        try {
            $response = Http::timeout(25)->post($deployedUrl, $payload);

            if ($response->successful()) {
                return self::normalize($response->json());
            }

            Log::warning('CodeRunner: deployed engine responded unhealthy', ['status' => $response->status()]);

            return self::engineError('The execution engine is temporarily unavailable.');
        } catch (\Throwable $e) {
            Log::error('CodeRunner: both engines failed', ['error' => $e->getMessage()]);

            return self::engineError('Engine Connection Error: No available execution engine.');
        }
    }

    private static function normalize(?array $data): array
    {
        return [
            'stdout' => (string) ($data['stdout'] ?? ''),
            'stderr' => (string) ($data['stderr'] ?? ''),
            'compile_output' => (string) ($data['compile_output'] ?? ''),
            'exit_code' => $data['exit_code'] ?? null,
            'timed_out' => (bool) ($data['timed_out'] ?? false),
        ];
    }

    private static function engineError(string $message): array
    {
        return [
            'stdout' => '',
            'stderr' => $message,
            'compile_output' => '',
            'exit_code' => null,
            'timed_out' => false,
        ];
    }
}
