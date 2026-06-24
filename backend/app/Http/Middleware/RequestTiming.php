<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class RequestTiming
{
    public function handle(Request $request, Closure $next): Response
    {
        $start = microtime(true);

        $response = $next($request);

        $duration = (int)((microtime(true) - $start) * 1000);

        if ($duration > 500) {
            Log::info("Slow request", [
                'method' => $request->method(),
                'url' => $request->path(),
                'status' => $response->getStatusCode(),
                'duration_ms' => $duration,
            ]);
        }

        return $response;
    }
}
