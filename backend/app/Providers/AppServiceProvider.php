<?php

namespace App\Providers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        if (app()->isLocal()) {
            Model::preventLazyLoading(true);
        }

        Model::handleLazyLoadingViolationUsing(function ($model, $relation) {
            Log::warning("Lazy loading detected", [
                'model' => get_class($model),
                'relation' => $relation,
            ]);
        });

        DB::listen(function ($query) {
            if ($query->time > 100) {
                Log::warning("Slow query ({$query->time}ms): {$query->sql}", [
                    'bindings' => $query->bindings,
                    'time_ms' => $query->time,
                ]);
            }
        });

        // Every code-execution run spawns a process on the engine — cap how
        // often one account (or one IP) can trigger them.
        RateLimiter::for('code-execution', function (Request $request) {
            return [
                Limit::perMinute(30)->by($request->user()?->id ?: $request->ip()),
                Limit::perMinute(120)->by('ip:'.$request->ip()),
            ];
        });
    }
}
