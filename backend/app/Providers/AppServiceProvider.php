<?php

namespace App\Providers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
    }
}
