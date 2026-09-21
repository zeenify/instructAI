<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Support\CodeRunner;
use Illuminate\Http\Request;

/**
 * Teacher-facing execution: "run it yourself" while grading a student's code
 * and verifying challenges against test cases. Same engine, teacher-scoped
 * route, throttled.
 */
class CodeRunController extends Controller
{
    public function run(Request $request)
    {
        if ($request->user()->role !== 'teacher') {
            return response()->json(['message' => 'Teacher access only.'], 403);
        }

        $request->validate([
            'language' => 'required|string|in:'.implode(',', CodeRunner::LANGUAGES),
            'code' => 'required|string|max:50000',
            'input' => 'nullable|string|max:20000',
        ]);

        $language = $request->input('language');

        if ($language === 'html') {
            return response()->json([
                'preview_only' => true,
                'message' => 'HTML runs in the browser preview.',
                'stdout' => '',
                'stderr' => '',
                'compile_output' => '',
            ]);
        }

        $result = CodeRunner::execute($language, $request->input('code'), $request->input('input'));

        return response()->json($result);
    }

    /**
     * Which languages the execution engine can actually run — the question
     * builders use this to disable languages whose runtime isn't installed
     * (a dev box without g++, for instance) instead of letting teachers build
     * exercises that can never execute.
     */
    public function languages(Request $request)
    {
        if ($request->user()->role !== 'teacher') {
            return response()->json(['message' => 'Teacher access only.'], 403);
        }

        return response()->json(CodeRunner::languages());
    }
}
