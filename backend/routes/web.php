<?php

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/_perf', function () {
    $logFile = storage_path('logs/laravel.log');
    if (!file_exists($logFile)) {
        return view('perf', ['entries' => []]);
    }

    $lines = file($logFile, FILE_IGNORE_NEW_LINES);
    $lines = array_slice($lines, -200);
    $entries = [];

    foreach (array_reverse($lines) as $line) {
        // Match timestamp and type
        if (!preg_match('/^\[([^\]]+)\].*?(Slow query|Slow request|Lazy loading detected)/', $line, $m)) {
            continue;
        }

        $time = trim($m[1]);
        $type = str_contains($m[2], 'query') ? 'query' : (str_contains($m[2], 'request') ? 'request' : 'lazy');

        // Extract duration from "Slow query (123ms):" or "Slow request ..."
        $duration = 0;
        if (preg_match('/\((\d+\.?\d*)ms\)/', $line, $d)) {
            $duration = (int) round((float) $d[1]);
        }

        // Extract the relevant detail part
        $detail = $line;
        if ($type === 'query') {
            // Extract SQL: after ": " and before the JSON object
            if (preg_match('/:\s(.*?)\s*\{.*\}$/', $line, $sqlMatch)) {
                $detail = $sqlMatch[1];
            }
        } elseif ($type === 'request') {
            // Extract method + URL + status
            preg_match('/\{.*\}$/', $line, $j);
            $d = $j ? json_decode($j[0], true) : [];
            $detail = ($d['method'] ?? '') . ' ' . ($d['url'] ?? '') . ' → ' . ($d['status'] ?? '');
        }

        $entries[] = [
            'time' => $time,
            'type' => $type,
            'duration' => $duration,
            'detail' => $detail,
        ];

        if (count($entries) >= 50) break;
    }

    return view('perf', ['entries' => $entries]);
});
