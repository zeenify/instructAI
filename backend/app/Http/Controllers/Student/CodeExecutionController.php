<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Support\CodeRunner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class CodeExecutionController extends Controller
{
    public function execute(Request $request)
    {
        $request->validate([
            'code' => 'required|string',
            'language' => 'sometimes|string|in:'.implode(',', CodeRunner::LANGUAGES),
            'input' => 'nullable|string',
        ]);

        $language = $request->input('language', 'java');
        $input = $request->input('input');
        $code = $request->code;

        // HTML/CSS/JS has no server runtime — the sandboxed browser preview is
        // the runtime. Tell the client explicitly instead of round-tripping.
        if ($language === 'html') {
            return response()->json([
                'preview_only' => true,
                'message' => 'HTML runs in the browser preview.',
                'stdout' => '',
                'stderr' => '',
                'compile_output' => '',
            ]);
        }

        // For Java: preprocess to work with execution engine
        if ($language === 'java') {
            // 1. Remove 'public' from class declarations
            $code = preg_replace('/\bpublic\s+class\b/', 'class', $code);

            // 2. Rename first class to 'Main' so execution engine can find it
            $code = preg_replace('/\bclass\s+\w+\s*\{/', 'class Main {', $code, 1);
        }

        $result = CodeRunner::execute($language, $code, $input);

        $status = (str_contains($result['stderr'], 'No available execution engine')
            || str_contains($result['stderr'], 'temporarily unavailable')) ? 503 : 200;

        return response()->json($result, $status);
    }

    public function verifyCodeChallenge(Request $request)
    {
        $request->validate([
            'question_text' => 'required|string',
            'code' => 'required|string',
            'expected_output' => 'required|string',
            'language' => 'sometimes|string|in:'.implode(',', CodeRunner::LANGUAGES),
        ]);

        try {
            $aiUrl = env('AI_SERVICE_URL', 'http://localhost:8001');
            \Log::info('CodeExecution: Verifying code challenge', ['url' => $aiUrl]);

            $response = Http::timeout(20)->post("{$aiUrl}/ai/verify-code-challenge", [
                'question_text' => $request->question_text,
                'code' => $request->code,
                'expected_output' => $request->expected_output,
                'language' => $request->input('language', 'java'),
            ]);

            if ($response->successful()) {
                \Log::info('CodeExecution: Verification succeeded');

                return response()->json($response->json());
            }

            \Log::warning('CodeExecution: Verification failed', ['status' => $response->status()]);

            return response()->json(['passed' => false, 'reason' => 'Verification service error'], 500);

        } catch (\Exception $e) {
            \Log::error('CodeExecution: Verification error', ['error' => $e->getMessage()]);

            return response()->json(['passed' => false, 'reason' => 'Could not verify solution'], 500);
        }
    }
}
