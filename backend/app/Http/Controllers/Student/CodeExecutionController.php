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
            'language' => 'sometimes|string'
        ]);

        // Use 'java' as default if not provided
        $language = $request->input('language', 'java');

        try {
            // REPLACE THIS with your actual Railway URL
            $engineUrl = env('EXECUTION_ENGINE_URL');

            $response = Http::timeout(20)->post($engineUrl, [
                'language' => $language,
                'code' => $request->code,
            ]);

            if ($response->failed()) {
                return response()->json([
                    'stderr' => 'The execution engine is temporarily unavailable.',
                    'stdout' => ''
                ], 503);
            }

            return response()->json($response->json());

        } catch (\Exception $e) {
            return response()->json([
                'stderr' => 'Engine Connection Error: ' . $e->getMessage(),
                'stdout' => ''
            ], 500);
        }
    }

}