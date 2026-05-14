<?php
namespace App\Http\Controllers\Student;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
class CodeExecutionController extends Controller
{
    public function execute(Request $request)
    {
        $request->validate([
            'code' => 'required|string',
            'language' => 'sometimes|string',
            'input' => 'nullable|string'
        ]);

        // Use 'java' as default if not provided
        $language = $request->input('language', 'java');
        $input = $request->input('input');
        $code = $request->code;

        // For Java: preprocess to work with execution engine
        if ($language === 'java') {
            // 1. Remove 'public' from class declarations
            $code = preg_replace('/\bpublic\s+class\b/', 'class', $code);

            // 2. Rename first class to 'Main' so execution engine can find it
            // Match: class ClassName { and replace with class Main {
            $code = preg_replace('/\bclass\s+\w+\s*\{/', 'class Main {', $code, 1);
        }

        // Try local first, then fallback to deployment
        $localUrl = 'http://localhost:3000/execute';
        $deployedUrl = env('EXECUTION_ENGINE_URL');

        $payload = [
            'language' => $language,
            'code' => $code,
        ];

        if ($input) {
            $payload['input'] = $input;
        }

        // Try localhost first
        try {
            \Log::info('CodeExecution: Trying local engine', ['url' => $localUrl]);
            $response = Http::timeout(20)->post($localUrl, $payload);

            if ($response->successful()) {
                \Log::info('CodeExecution: Local engine succeeded');
                return response()->json($response->json());
            }
        } catch (\Exception $localError) {
            \Log::warning('CodeExecution: Local engine failed', ['error' => $localError->getMessage()]);
        }

        // Fallback to deployed engine
        try {
            \Log::info('CodeExecution: Falling back to deployed engine', ['url' => $deployedUrl]);
            $response = Http::timeout(20)->post($deployedUrl, $payload);

            if ($response->successful()) {
                \Log::info('CodeExecution: Deployed engine succeeded');
                return response()->json($response->json());
            }

            return response()->json([
                'stderr' => 'The execution engine is temporarily unavailable.',
                'stdout' => ''
            ], 503);

        } catch (\Exception $deployedError) {
            \Log::error('CodeExecution: Both engines failed', [
                'local_error' => $localError->getMessage() ?? 'Not attempted',
                'deployed_error' => $deployedError->getMessage()
            ]);

            return response()->json([
                'stderr' => 'Engine Connection Error: No available execution engine.',
                'stdout' => ''
            ], 500);
        }
    }

    public function verifyCodeChallenge(Request $request)
    {
        $request->validate([
            'question_text' => 'required|string',
            'code' => 'required|string',
            'expected_output' => 'required|string'
        ]);

        try {
            $aiUrl = env('AI_SERVICE_URL', 'http://localhost:8001');
            \Log::info('CodeExecution: Verifying code challenge', ['url' => $aiUrl]);

            $response = Http::timeout(20)->post("{$aiUrl}/ai/verify-code-challenge", [
                'question_text' => $request->question_text,
                'code' => $request->code,
                'expected_output' => $request->expected_output
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