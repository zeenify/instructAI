<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/**
 * Central HTTP client for the Python AI service. Every call carries the
 * shared internal secret the FastAPI service enforces on /ai/* routes.
 */
class AiService
{
    public static function url(string $path = ''): string
    {
        return rtrim(config('services.ai.url', 'http://127.0.0.1:8001'), '/') . $path;
    }

    public static function authHeader(): array
    {
        return ['X-Internal-Auth' => (string) config('services.ai.secret')];
    }

    public static function http(?int $timeout = null)
    {
        $client = Http::withHeaders(self::authHeader());

        return $timeout ? $client->timeout($timeout) : $client;
    }

    /** HMAC signature material for the one browser-facing route */
    public static function signPayload(string $payloadJson): array
    {
        $ts = time();

        return [
            'auth_sig' => hash_hmac('sha256', $payloadJson . $ts, (string) config('services.ai.secret')),
            'auth_ts' => $ts,
        ];
    }
}
