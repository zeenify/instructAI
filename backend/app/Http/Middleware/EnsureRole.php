<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    /**
     * Gate routes to a specific user role, e.g. ->middleware('role:admin').
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user || ( !empty($roles) && !in_array($user->role, $roles, true) )) {
            return response()->json(['message' => 'This area is restricted to ' . implode('/', $roles) . ' accounts.'], 403);
        }

        return $next($request);
    }
}
