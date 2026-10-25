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

        // Java: preprocess so the engine can find an entry class — shared with
        // the quiz grading path so the same code behaves identically in both.
        $code = CodeRunner::preprocessForEngine($language, $code);

        $result = CodeRunner::execute($language, $code, $input);

        $status = (str_contains($result['stderr'], 'No available execution engine')
            || str_contains($result['stderr'], 'temporarily unavailable')) ? 503 : 200;

        return response()->json($result, $status);
    }

    /**
     * Compile once, run every input — the quiz Run button's sample checks.
     * 10 inputs max protects the shared engine from one giant request.
     */
    public function executeBatch(Request $request)
    {
        $request->validate([
            'code' => 'required|string',
            'language' => 'sometimes|string|in:'.implode(',', CodeRunner::LANGUAGES),
            'inputs' => 'required|array|min:1|max:10',
            'inputs.*' => 'nullable|string',
        ]);

        $language = $request->input('language', 'java');

        if ($language === 'html') {
            return response()->json([
                'preview_only' => true,
                'message' => 'HTML runs in the browser preview.',
            ]);
        }

        $code = CodeRunner::preprocessForEngine($language, $request->code);
        $result = CodeRunner::executeBatch($language, $code, (array) $request->input('inputs', []));

        return response()->json($result, ! empty($result['engine_error']) ? 503 : 200);
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

            $response = Http::timeout(20)->withHeaders(\App\Services\AiService::authHeader())->post("{$aiUrl}/ai/verify-code-challenge", [
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
