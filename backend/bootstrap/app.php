<?php

use App\Http\Middleware\RequestTiming;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            RequestTiming::class,
        ]);
        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureRole::class,
        ]);
        // SPA + token auth: there is no named 'login' route, and the auth
        // middleware evaluates redirectGuestsTo while constructing the
        // AuthenticationException — before the exception handler runs.
        // Returning null yields a clean 401 (JSON for api/* via the
        // exception config below) instead of "Route [login] not defined".
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // API callers must get JSON errors — never the HTML welcome page or
        // a 302 validation redirect
        $exceptions->shouldRenderJsonWhen(
            fn ($request) => $request->is('api/*') || $request->expectsJson()
        );

        // This app has no named 'login' route (SPA + tokens), so Sanctum's
        // default redirect target 500s every unauthenticated API call —
        // answer 401 JSON instead
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
        });
    })->create();
