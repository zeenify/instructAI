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
        $module = Module::with('course')->findOrFail($moduleId);
        
        if ($module->course->teacher_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate(['title' => 'required|string|max:255']);

        $lesson = Lesson::create([
            'module_id' => $moduleId,
            'title' => $request->title,
            'content' => [], 
            'order_index' => $module->lessons()->count() + 1,
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
        if (!$request->hasFile('image')) {
            return response()->json(['error' => 'No image found'], 400);
        }

        $config = [
            'cloud' => [
                'cloud_name' => 'dbcewwqil',
                'api_key'    => '943439599195593',
                'api_secret' => 'Onj0z0LQGyUAMQvmWhNPy237x0E',
            ]
        ];

        $uploadApi = new UploadApi($config);
        $result = $uploadApi->upload($request->file('image')->getRealPath(), [
            'folder' => 'instructai/lessons',
            'quality' => 'auto',
        ]);

        return response()->json(['url' => $result['secure_url']]);
    }
}