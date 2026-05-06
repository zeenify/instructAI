<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Lesson;
use App\Models\Module;
use Illuminate\Http\Request;
// We only need these two for the manual Cloudinary SDK call
use Cloudinary\Configuration\Configuration;
use Cloudinary\Api\Upload\UploadApi;

class LessonController extends Controller
{
    /**
     * Fetch a single lesson
     * OPTIMIZED: Single query with eager loading
     */
    public function show($id)
    {
        // Single optimized query with authorization check and eager loading
        $lesson = Lesson::with('module.course')
            ->whereHas('module.course', function($query) {
                $query->where('teacher_id', auth()->id());
            })
            ->find($id);

        if (!$lesson) {
            return response()->json(['message' => 'Access Denied'], 403);
        }

        return response()->json($lesson);
    }

    /**
     * Create a new lesson
     */
    public function store(Request $request, $moduleId)
    {
        $module = Module::findOrFail($moduleId);

        // Calculate next order index by counting BOTH types
        $nextOrder = $module->lessons()->count() + $module->quizzes()->count() + 1;

        $lesson = Lesson::create([
            'module_id' => $moduleId,
            'title' => $request->title,
            'content' => [], 
            'order_index' => $nextOrder, // <--- UPDATED LOGIC
            'is_published' => false
        ]);

        return response()->json($lesson, 201);
    }


    /**
     * Update lesson blocks
     */
    public function update(Request $request, $id)
    {
        try {
            $lesson = Lesson::findOrFail($id);
            
            // Use 'sometimes' so we can update JUST the visibility without sending the whole content
            $validated = $request->validate([
                'title' => 'sometimes|string|max:255',
                'content' => 'sometimes|array',
                'is_published' => 'sometimes|boolean'
            ]);

            $lesson->update($validated);

            return response()->json($lesson);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Image Upload logic
     */
    public function uploadImage(Request $request)
    {
        try {
            if (!$request->hasFile('image')) {
                return response()->json(['error' => 'No image found'], 400);
            }

            // 1. Get credentials and verify they aren't empty
            $cloudName = env('CLOUDINARY_CLOUD_NAME');
            $apiKey    = env('CLOUDINARY_API_KEY');
            $apiSecret = env('CLOUDINARY_API_SECRET');

            if (!$cloudName || !$apiKey || !$apiSecret) {
                throw new \Exception("Cloudinary credentials are missing in .env");
            }

            $config = [
                'cloud' => [
                    'cloud_name' => $cloudName,
                    'api_key'    => $apiKey,
                    'api_secret' => $apiSecret,
                ]
            ];

            // 2. Initialize using the full path to avoid import errors
            $uploadApi = new \Cloudinary\Api\Upload\UploadApi($config);
            
            $file = $request->file('image');
            $result = $uploadApi->upload($file->getRealPath(), [
                'folder' => 'instructai/lessons',
                'quality' => 'auto',
            ]);

            return response()->json(['url' => $result['secure_url']]);

        } catch (\Exception $e) {
            // Log the error so you can see it in laravel.log
            \Log::error("Upload Error: " . $e->getMessage());
            
            return response()->json([
                'error' => $e->getMessage(),
                'hint' => 'Check your .env keys and laravel.log'
            ], 500);
        }
    }

    public function destroy($id)
    {
        // Deep security check: Lesson -> Module -> Course -> Teacher
        $lesson = Lesson::whereHas('module.course', function($q) {
            $q->where('teacher_id', auth()->id());
        })->findOrFail($id);

        $lesson->delete();
        return response()->json(['message' => 'Lesson removed.']);
    }

}