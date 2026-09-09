<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Shared client for the instruct-execute engine.
 *
 * Tries the locally running engine first (dev convenience), then falls back to
 * the deployed EXECUTION_ENGINE_URL. Used by the student execute proxy, the
 * teacher run/verify tools and by quiz grading so all paths behave identically.
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
     * Prepares student code for the engine. Java is renamed so the engine can
     * find an entry class; used by BOTH the practice IDE proxy and quiz grading
     * so the same solution behaves identically in both places.
     */
    public static function preprocessForEngine(string $language, string $code): string
    {
        if ($language !== 'java') {
            return $code;
        }

        // 1. Remove 'public' from class declarations
        $code = preg_replace('/\bpublic\s+class\b/', 'class', $code);

        // 2. Rename the FIRST real class declaration to Main so `java Main`
        //    can run it. Comments are matched but left untouched — a "// class
        //    Foo {" joke comment must not hijack the rename (offsets stay valid
        //    because we only ever substitute inside the matched declaration).
        $seenClass = false;

        return preg_replace_callback(
            '/\/\/[^\n]*|\/\*.*?\*\/|\bclass\s+(\w+)\s*\{/s',
            function (array $match) use (&$seenClass) {
                if (! array_key_exists(1, $match) || $match[1] === null || $seenClass) {
                    return $match[0];
                }
                $seenClass = true;

                if (preg_match('/^\s*class\s+/', $match[0], $prefix) === 1) {
                    $start = strlen($prefix[0]);

                    return substr($match[0], 0, $start) . 'Main' . substr($match[0], $start + strlen($match[1]));
                }

                return $match[0];
            },
            $code
        );
    }

    /**
     * Canonical output normalization for grading: CRLF -> LF, trailing spaces
     * per line removed, trailing blank lines removed. Case-sensitive compare
     * stays (program output is data), but whitespace lies stop failing students.
     */
    public static function normalizeOutput(string $output): string
    {
        $output = str_replace("\r\n", "\n", $output);
        $lines = array_map(fn ($line) => rtrim($line), explode("\n", $output));

        while ($lines !== [] && end($lines) === '') {
            array_pop($lines);
        }

        return implode("\n", $lines);
    }

    /**
     * @return array{stdout: string, stderr: string, compile_output: string, exit_code: int|null, timed_out: bool}
     */
    public static function execute(string $language, string $code, ?string $input = null): array
    {
        $payload = [
            'language' => $language,
            'code' => self::preprocessForEngine($language, $code),
        ];

        if ($input !== null && $input !== '') {
            $payload['input'] = str_replace("\r\n", "\n", $input);
        }

        $localUrl = 'http://localhost:3000/execute';
        $deployedUrl = rtrim((string) env('EXECUTION_ENGINE_URL'), '/');
        if ($deployedUrl !== '' && ! str_ends_with($deployedUrl, '/execute')) {
            $deployedUrl .= '/execute';
        }

        $token = (string) env('EXECUTION_ENGINE_TOKEN', '');
        $withToken = function (string $url, array $payload) use ($token) {
            $request = Http::timeout(25)->asJson();
            if ($token !== '') {
                $request = $request->withHeaders(['X-Engine-Token' => $token]);
            }

            return $request->post($url, $payload);
        };

        try {
            $response = $withToken($localUrl, $payload);

            if ($response->successful()) {
                return self::normalize($response->json());
            }

            // Deterministic engine answers (bad language, missing runtime, busy)
            // must reach the student verbatim instead of being masked as
            // "engine unavailable" — retry the deployed engine only for real
            // connectivity/5xx-no-body cases.
            $body = $response->json();
            if (is_array($body) && isset($body['error']) && in_array($response->status(), [400, 401, 429, 503], true)) {
                return self::engineError((string) $body['error']);
            }

            Log::warning('CodeRunner: local engine responded unhealthy', ['status' => $response->status()]);
        } catch (\Throwable $e) {
            Log::info('CodeRunner: local engine unreachable, falling back', ['error' => $e->getMessage()]);
        }

        if ($deployedUrl === '') {
            return self::engineError('No execution engine is configured.');
        }

        try {
            $response = $withToken($deployedUrl, $payload);

            if ($response->successful()) {
                return self::normalize($response->json());
            }

            $body = $response->json();
            if (is_array($body) && isset($body['error']) && in_array($response->status(), [400, 401, 429, 503], true)) {
                return self::engineError((string) $body['error']);
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
