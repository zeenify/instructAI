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
     */
    public function show($id)
    {
        // No try-catch here so Laravel can handle 404s automatically with CORS headers
        return Lesson::findOrFail($id);
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
        $lesson = Lesson::findOrFail($id);
        
        $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|array',
            'is_published' => 'required|boolean'
        ]);

        $lesson->update([
            'title' => $request->title,
            'content' => $request->content,
            'is_published' => $request->is_published
        ]);

        return response()->json($lesson);
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

            // Pull credentials from the environment, NOT hardcoded
            $config = [
                'cloud' => [
                    'cloud_name' => env('CLOUDINARY_CLOUD_NAME'),
                    'api_key'    => env('CLOUDINARY_API_KEY'),
                    'api_secret' => env('CLOUDINARY_API_SECRET'),
                ]
            ];

            $uploadApi = new \Cloudinary\Api\Upload\UploadApi($config);
            $file = $request->file('image');
            
            $result = $uploadApi->upload($file->getRealPath(), [
                'folder' => 'instructai/lessons',
                'quality' => 'auto',
            ]);

            return response()->json(['url' => $result['secure_url']]);

        } catch (\Exception $e) {
            return response()->json(['error' => 'Upload failed'], 500);
        }
    }

}