<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Classroom;
use App\Models\Module; 
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;

class CourseController extends Controller
{
    public function store(Request $request, $classId)
    {
        try {
            $classroom = Classroom::findOrFail($classId);

            if ($classroom->teacher_id !== $request->user()->id) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $request->validate([
                'title' => 'required|string|max:255',
                'description' => 'nullable|string',
            ]);

            $course = Course::create([
                'teacher_id' => $request->user()->id,
                'class_id' => $classId,
                'title' => $request->title,
                'description' => $request->description,
                'is_published' => false,
                'order_index' => $classroom->courses()->count() + 1
            ]);

            return response()->json($course, 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function show($id)
    {
        $course = Course::where('id', $id)
            ->where('teacher_id', auth()->id())
            ->with([
                'modules' => fn($q) => $q->orderBy('order_index', 'asc'),
                'modules.lessons' => fn($q) => $q->orderBy('order_index', 'asc'),
                'modules.quizzes' => fn($q) => $q->orderBy('order_index', 'asc')
            ])->firstOrFail();

        return response()->json($course);
    }

    public function togglePublish(Request $request, $id)
    {
        $course = Course::findOrFail($id);
        $course->update(['is_published' => $request->is_published]);
        return response()->json(['success' => true]);
    }

    public function publishAll(Request $request, $id) 
    {
        $course = Course::findOrFail($id);
        
        $course->modules()->update(['is_published' => true]);
        \App\Models\Lesson::whereIn('module_id', $course->modules->pluck('id'))->update(['is_published' => true]);
        \App\Models\Quiz::whereIn('module_id', $course->modules->pluck('id'))->update(['is_published' => true]);
        
        return response()->json(['success' => true]);
    }
        
    public function generateWithAI(Request $request, $courseId)
    {
        $request->validate(['prompt' => 'required|string', 'file' => 'nullable|file']);

        $aiUrl = env('AI_SERVICE_URL') . '/ai/generate-curriculum';
        $apiCall = Http::asMultipart();
        
        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $apiCall->attach('file', file_get_contents($file), $file->getClientOriginalName());
        }
        $response = $apiCall->post($aiUrl, ['prompt' => $request->prompt]);

        return response()->json($response->json());
    }

    public function aiCommit(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $modules = $request->input('new_modules', []);
            $savedModules =[];

            foreach ($modules as $m) {
                // 1. Create the Module
                $newModule = \App\Models\Module::create([
                    'course_id' => $id,
                    'title' => $m['title'],
                    'order_index' => \App\Models\Module::where('course_id', $id)->count() + 1
                ]);

                $orderCounter = 1;

                // 2a. Handle explicit "lessons" array from AI
                if (isset($m['lessons']) && is_array($m['lessons'])) {
                    foreach ($m['lessons'] as $lesson) {
                        $newModule->lessons()->create([
                            'title' => $lesson['title'],
                            'order_index' => $orderCounter++,
                            'content' =>[],
                            'is_published' => false
                        ]);
                    }
                }

                // 2b. Handle explicit "quizzes" array from AI
                if (isset($m['quizzes']) && is_array($m['quizzes'])) {
                    foreach ($m['quizzes'] as $quiz) {
                        $newModule->quizzes()->create([
                            'title' => $quiz['title'],
                            'order_index' => $orderCounter++,
                            'is_published' => false
                        ]);
                    }
                }

                // 2c. Fallback for Unified "items" array (if modified by frontend)
                if (isset($m['items']) && is_array($m['items'])) {
                    foreach ($m['items'] as $item) {
                        if (!isset($item['type'])) continue;
                        
                        if ($item['type'] === 'lesson') {
                            $newModule->lessons()->create([
                                'title' => $item['title'],
                                'order_index' => $orderCounter++,
                                'content' => [],
                                'is_published' => false
                            ]);
                        } elseif ($item['type'] === 'quiz') {
                            $newModule->quizzes()->create([
                                'title' => $item['title'],
                                'order_index' => $orderCounter++,
                                'is_published' => false
                            ]);
                        }
                    }
                }
                
                // Reload with relations so the frontend sees them
                $savedModules[] = $newModule->load(['lessons', 'quizzes']);
            }

            return response()->json(['new_modules' => $savedModules]);
        });
    }

    public function streamAI(Request $request, $courseId)
    {
        return new StreamedResponse(function () use ($request, $courseId) {
            $client = new \GuzzleHttp\Client();
            $res = $client->post('https://your-fastapi.url/generate',[
                'json' => ['prompt' => $request->prompt, 'course_id' => $courseId],
                'stream' => true
            ]);

            $body = $res->getBody();
            while (!$body->eof()) {
                $chunk = $body->read(1024);
                echo "data: " . $chunk . "\n\n";
                ob_flush();
                flush();
            }
        }, 200,[
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
        ]);
    }
}