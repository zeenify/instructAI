<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Process\Process;

class TtsController extends Controller
{
    public function voices()
    {
        $voices = collect(config('services.fish.voices', []))
            ->map(fn ($v) => [
                'id' => $v['id'],
                'name' => $v['name'],
                'likes' => $v['likes'] ?? 0,
                'gain_db' => $v['gain_db'] ?? 0,
            ])
            ->values();

        return response()->json(['voices' => $voices]);
    }

    public function synthesize(Request $request)
    {
        $request->validate([
            'text' => 'required|string|max:5000',
            'reference_id' => 'nullable|string',
            'format' => 'nullable|string|in:mp3,wav',
        ]);

        $apiKey = config('services.fish.api_key');
        if (! $apiKey) {
            return response()->json(['error' => 'Server Fish Audio key not configured'], 500);
        }

        $referenceId = $request->input('reference_id');
        $gainDb = (float) collect(config('services.fish.voices', []))
            ->firstWhere('id', $referenceId)['gain_db'] ?? 0;

        try {
            $response = Http::timeout(60)
                ->withHeaders([
                    'Authorization' => 'Bearer '.$apiKey,
                    'model' => config('services.fish.model', 's2.1-pro-free'),
                ])
                ->post('https://api.fish.audio/v1/tts', [
                    'text' => $request->text,
                    'reference_id' => $referenceId,
                    'format' => $request->input('format', 'mp3'),
                ]);

            if (! $response->successful()) {
                return response()->json([
                    'error' => 'Fish Audio error '.$response->status(),
                    'detail' => $response->body(),
                ], $response->status() >= 500 ? 502 : 400);
            }

            $audio = $response->body();
            if ($gainDb != 0) {
                $audio = $this->applyGain($audio, $gainDb);
            }

            $contentType = $request->input('format', 'mp3') === 'wav'
                ? 'audio/wav'
                : 'audio/mpeg';

            return response($audio, 200)
                ->header('Content-Type', $contentType)
                ->header('Cache-Control', 'public, max-age=31536000, immutable');
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 502);
        }
    }

    private function applyGain(string $audio, float $gainDb): string
    {
        $ffmpeg = config('services.fish.ffmpeg');
        if (! $ffmpeg || ! is_file($ffmpeg)) {
            return $audio;
        }

        $in = tempnam(sys_get_temp_dir(), 'tts_').'.mp3';
        $out = tempnam(sys_get_temp_dir(), 'tts_').'.mp3';
        file_put_contents($in, $audio);

        try {
            $process = new Process([
                $ffmpeg,
                '-y',
                '-i', $in,
                '-af', 'volume='.number_format($gainDb, 1).'dB',
                '-c:a', 'libmp3lame',
                '-b:a', '192k',
                $out,
            ]);
            $process->setTimeout(30);
            $process->run();

            if ($process->isSuccessful() && is_file($out) && filesize($out) > 0) {
                return file_get_contents($out);
            }

            return $audio;
        } catch (\Throwable $e) {
            return $audio;
        } finally {
            @unlink($in);
            @unlink($out);
        }
    }
}
