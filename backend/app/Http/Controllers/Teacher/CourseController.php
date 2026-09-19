<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Classroom;
use App\Models\Module;
use App\Models\Lesson;
use App\Models\Quiz;
use App\Models\Question;
use App\Models\QuestionTestCase;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Cloudinary\Api\Upload\UploadApi;
use Illuminate\Support\Str;

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
                'curriculum_file' => 'nullable|file|mimes:pdf,doc,docx,txt|max:10240', // 10MB max
            ]);

            $curriculumFileUrl = null;
            $curriculumText = null;

            // Handle curriculum file upload
            if ($request->hasFile('curriculum_file')) {
                $file = $request->file('curriculum_file');

                // Get Cloudinary credentials
                $cloudName = env('CLOUDINARY_CLOUD_NAME');
                $apiKey    = env('CLOUDINARY_API_KEY');
                $apiSecret = env('CLOUDINARY_API_SECRET');

                if ($cloudName && $apiKey && $apiSecret) {
                    // Initialize Cloudinary
                    $config = [
                        'cloud' => [
                            'cloud_name' => $cloudName,
                            'api_key' => $apiKey,
                            'api_secret' => $apiSecret,
                        ]
                    ];

                    $uploadApi = new UploadApi($config);

                    // Get original filename
                    $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
                    $extension = $file->getClientOriginalExtension();

                    // Upload to Cloudinary with original filename
                    $result = $uploadApi->upload($file->getRealPath(), [
                        'folder' => 'instructai/curriculum',
                        'resource_type' => 'raw',
                        'public_id' => $originalName,
                        'format' => $extension
                    ]);

                    $curriculumFileUrl = $result['secure_url'];
                } else {
                    throw new \Exception("Cloudinary credentials missing");
                }

                // Extract text from uploaded file
                $curriculumText = $this->extractTextFromFile($file);
            }

            // Detect if curriculum contains programming content using AI
            $isCoding = false;
            if ($curriculumText) {
                try {
                    $aiServiceUrl = env('AI_SERVICE_URL', 'http://localhost:8001');
                    $response = Http::asJson()->post("{$aiServiceUrl}/ai/detect-programming-content", [
                        'curriculum_text' => $curriculumText
                    ]);

                    if ($response->successful()) {
                        $isCoding = $response->json('is_coding', false);
                        \Log::info("AI Detection Result", ['is_coding' => $isCoding, 'response' => $response->json()]);
                    } else {
                        \Log::warning("AI detection failed with status: " . $response->status());
                    }
                } catch (\Exception $detectionError) {
                    \Log::warning("AI detection failed during course creation: " . $detectionError->getMessage());
                    $isCoding = false;
                }
            }

            $course = Course::create([
                'teacher_id' => $request->user()->id,
                'class_id' => $classId,
                'title' => $request->title,
                'description' => $request->description,
                'curriculum_file_url' => $curriculumFileUrl,
                'curriculum_text' => $curriculumText,
                'is_coding' => $isCoding,
                'is_published' => false,
                'order_index' => $classroom->courses()->count() + 1
            ]);

            return response()->json($course, 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Extract text from uploaded file (PDF, DOCX, TXT)
     */
    private function extractTextFromFile($file)
    {
        if (!$file || !$file->isValid()) {
            return '';
        }

        $extension = strtolower($file->getClientOriginalExtension());
        $content = '';

        try {
            if ($extension === 'pdf') {
                // Use Smalot\PdfParser for PDF extraction
                $parser = new \Smalot\PdfParser\Parser();
                $pdf = $parser->parseFile($file->getRealPath());
                $content = $pdf ? $pdf->getText() : '';
            } elseif (in_array($extension, ['doc', 'docx'])) {
                // Use PhpOffice\PhpWord for DOCX extraction
                $phpWord = \PhpOffice\PhpWord\IOFactory::load($file->getRealPath());
                if ($phpWord) {
                    $sections = $phpWord->getSections();
                    if ($sections && is_array($sections)) {
                        foreach ($sections as $section) {
                            if (!$section) continue;
                            $elements = $section->getElements();
                            if ($elements && is_array($elements)) {
                                foreach ($elements as $element) {
                                    if ($element && method_exists($element, 'getText')) {
                                        $text = $element->getText();
                                        if ($text) {
                                            $content .= $text . "\n";
                                        }
                                    } elseif ($element && method_exists($element, 'getElements')) {
                                        // Handle nested elements (paragraphs with text runs)
                                        $subElements = $element->getElements();
                                        if ($subElements && is_array($subElements)) {
                                            foreach ($subElements as $subElement) {
                                                if ($subElement && method_exists($subElement, 'getText')) {
                                                    $text = $subElement->getText();
                                                    if ($text) {
                                                        $content .= $text;
                                                    }
                                                }
                                            }
                                            $content .= "\n";
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } elseif ($extension === 'txt') {
                // Plain text file
                $filePath = $file->getRealPath();
                if ($filePath && file_exists($filePath)) {
                    $content = file_get_contents($filePath);
                }
            }

            // Clean up and limit to 50,000 characters
            $content = trim($content);
            if (mb_strlen($content) > 50000) {
                $content = mb_substr($content, 0, 50000);
            }

            return $content ?: '';
        } catch (\Exception $e) {
            // If extraction fails, return empty string
            \Log::warning("Failed to extract text from file ({$extension}): " . $e->getMessage());
            return '';
        }
    }

    public function show($id)
    {
        $course = Course::where('id', $id)
            ->where('teacher_id', auth()->id())
            ->with([
                'modules' => fn($q) => $q->orderBy('order_index', 'asc'),
                'modules.lessons' => fn($q) => $q->orderBy('order_index', 'asc'),
                // questions_count powers the "N questions" meta on module rows
                'modules.quizzes' => fn($q) => $q->withCount('questions')->orderBy('order_index', 'asc')
            ])->firstOrFail();

        return response()->json($course);
    }

    public function update(Request $request, $id)
    {
        $course = Course::where('id', $id)
            ->where('teacher_id', auth()->id())
            ->firstOrFail();

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'is_coding' => 'sometimes|boolean',
        ]);

        $course->update($request->only(['title', 'description', 'is_coding']));

        return response()->json([
            'success' => true,
            'course' => $course
        ]);
    }

    public function togglePublish(Request $request, $id)
    {
        $request->validate(['is_published' => 'required|boolean']);
        $course = Course::where('id', $id)
            ->where('teacher_id', auth()->id())
            ->firstOrFail();
        $course->update(['is_published' => $request->boolean('is_published')]);
        return response()->json(['success' => true]);
    }

    public function uploadCurriculum(Request $request, $id)
    {
        $course = Course::where('id', $id)
            ->where('teacher_id', auth()->id())
            ->firstOrFail();

        $request->validate([
            'curriculum_file' => 'required|file|mimes:pdf,doc,docx,txt|max:10240', // 10MB max
        ]);

        try {
            $file = $request->file('curriculum_file');

            if (!$file || !$file->isValid()) {
                throw new \Exception('Invalid file upload');
            }

            // Get Cloudinary credentials
            $cloudName = env('CLOUDINARY_CLOUD_NAME');
            $apiKey    = env('CLOUDINARY_API_KEY');
            $apiSecret = env('CLOUDINARY_API_SECRET');

            if (!$cloudName || !$apiKey || !$apiSecret) {
                throw new \Exception("Cloudinary credentials are missing in .env");
            }

            // Initialize Cloudinary
            $config = [
                'cloud' => [
                    'cloud_name' => $cloudName,
                    'api_key' => $apiKey,
                    'api_secret' => $apiSecret,
                ]
            ];

            $uploadApi = new UploadApi($config);

            // Get original filename without extension for public_id
            $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
            $extension = $file->getClientOriginalExtension();

            // Upload to Cloudinary with original filename
            $result = $uploadApi->upload($file->getRealPath(), [
                'folder' => 'instructai/curriculum',
                'resource_type' => 'raw',
                'public_id' => $originalName,
                'format' => $extension
            ]);

            if (!$result || !isset($result['secure_url'])) {
                throw new \Exception('Cloudinary upload failed');
            }

            $curriculumFileUrl = $result['secure_url'];

            // Extract text from uploaded file
            $curriculumText = '';
            try {
                $curriculumText = $this->extractTextFromFile($file);
            } catch (\Exception $extractError) {
                \Log::warning("Text extraction failed but continuing: " . $extractError->getMessage());
            }

            // Detect if curriculum contains programming content using AI
            $isCoding = false;
            if ($curriculumText) {
                try {
                    $aiServiceUrl = env('AI_SERVICE_URL', 'http://localhost:8001');
                    $response = Http::asJson()->post("{$aiServiceUrl}/ai/detect-programming-content", [
                        'curriculum_text' => $curriculumText
                    ]);

                    if ($response->successful()) {
                        $isCoding = $response->json('is_coding', false);
                        \Log::info("AI Detection Result", ['is_coding' => $isCoding, 'response' => $response->json()]);
                    } else {
                        \Log::warning("AI detection failed with status: " . $response->status());
                    }
                } catch (\Exception $detectionError) {
                    \Log::warning("AI detection failed on upload: " . $detectionError->getMessage());
                    $isCoding = false;
                }
            }

            // Log detection result
            \Log::info("Curriculum Detection for Course {$id}", [
                'file_name' => $file->getClientOriginalName(),
                'text_length' => strlen($curriculumText),
                'is_coding' => $isCoding
            ]);

            // Update course with is_coding flag
            $course->update([
                'curriculum_file_url' => $curriculumFileUrl,
                'curriculum_text' => $curriculumText,
                'is_coding' => $isCoding,
            ]);

            $message = 'Curriculum document uploaded and text extracted successfully';

            return response()->json([
                'success' => true,
                'curriculum_file_url' => $curriculumFileUrl,
                'is_coding' => $isCoding,
                'course' => $course,
                'message' => $message
            ]);
        } catch (\Exception $e) {
            \Log::error("Upload curriculum failed: " . $e->getMessage());
            return response()->json(['error' => 'Failed to upload curriculum: ' . $e->getMessage()], 500);
        }
    }

    public function destroyCurriculum(Request $request, $id)
    {
        $course = Course::where('id', $id)
            ->where('teacher_id', auth()->id())
            ->firstOrFail();

        // Best-effort removal of the stored file — it may already be gone from
        // the cloud; the reference must clear either way
        if ($course->curriculum_file_url) {
            try {
                // For raw files the Cloudinary public_id INCLUDES the extension
                // (e.g. instructai/curriculum/syllabus.pdf)
                if (preg_match('#/raw/upload/(?:v\d+/)?(.+)$#', parse_url($course->curriculum_file_url, PHP_URL_PATH) ?? '', $m)) {
                    $uploadApi = new UploadApi([
                        'cloud' => [
                            'cloud_name' => env('CLOUDINARY_CLOUD_NAME'),
                            'api_key'    => env('CLOUDINARY_API_KEY'),
                            'api_secret' => env('CLOUDINARY_API_SECRET'),
                        ],
                    ]);
                    $result = $uploadApi->destroy($m[1], ['resource_type' => 'raw', 'invalidate' => true]);
                    \Log::info("Curriculum destroy for course {$id}: public_id={$m[1]} result=" . ($result['result'] ?? 'unknown'));
                }
            } catch (\Throwable $e) {
                \Log::warning("Curriculum file destroy failed for course {$id}: " . $e->getMessage());
            }
        }

        $course->update(['curriculum_file_url' => null, 'curriculum_text' => null]);

        return response()->json(['success' => true, 'course' => $course->fresh()]);
    }

    public function publishAll(Request $request, $id)
    {
        $course = Course::where('id', $id)
            ->where('teacher_id', auth()->id())
            ->firstOrFail();

        // Go Live means the course itself too — is_published gates student access
        $course->update(['is_published' => true]);

        $moduleIds = $course->modules()->pluck('id');
        $course->modules()->update(['is_published' => true]);
        \App\Models\Lesson::whereIn('module_id', $moduleIds)->update(['is_published' => true]);
        \App\Models\Quiz::whereIn('module_id', $moduleIds)->update(['is_published' => true]);

        return response()->json(['success' => true]);
    }
        
    public function generateWithAI(Request $request, $courseId)
    {
        $request->validate([
            'prompt' => 'required|string|max:10000',
            'file' => 'nullable|file|mimes:pdf,doc,docx,txt|max:10240',
            'difficulty' => 'nullable|string|max:50',
            'module_count' => 'nullable|string|max:10|regex:/^[1-9]\d?(-[1-9]\d?)?$/',
            'lessons_per_module' => 'nullable|string|max:10|regex:/^[1-9]\d?(-[1-9]\d?)?$/',
            'include_quiz' => 'nullable|string|max:5',
            'include_coding' => 'nullable|string|max:5',
            'pacing' => 'nullable|string|max:50',
        ]);

        // Get course to access curriculum_text
        $course = Course::where('id', $courseId)
            ->where('teacher_id', auth()->id())
            ->firstOrFail();

        return new StreamedResponse(function () use ($request, $course) {
            $aiUrl = env('AI_SERVICE_URL') . '/ai/generate-curriculum-stream';

            // Build multipart request
            $multipart = [
                ['name' => 'prompt', 'contents' => $request->prompt],
                ['name' => 'difficulty', 'contents' => $request->input('difficulty', 'beginner')],
                ['name' => 'module_count', 'contents' => $request->input('module_count', '3-5')],
                ['name' => 'lessons_per_module', 'contents' => $request->input('lessons_per_module', '3-5')],
                ['name' => 'include_quiz', 'contents' => $request->input('include_quiz', 'true')],
                ['name' => 'include_coding', 'contents' => $request->input('include_coding', 'true')],
                ['name' => 'pacing', 'contents' => $request->input('pacing', 'standard')],
            ];

            // Add curriculum text if exists
            if ($course->curriculum_text) {
                $multipart[] = ['name' => 'curriculum_text', 'contents' => $course->curriculum_text];
            }

            // Add file if provided
            if ($request->hasFile('file')) {
                $file = $request->file('file');
                $multipart[] = [
                    'name' => 'file',
                    'contents' => fopen($file->getRealPath(), 'r'),
                    'filename' => $file->getClientOriginalName()
                ];
            }

            // Stream from AI service
            set_time_limit(600); // structure generation streams for minutes
            $client = new \GuzzleHttp\Client();
            try {
                $response = $client->post($aiUrl, [
                    'multipart' => $multipart,
                    'stream' => true,
                    'timeout' => 120,
                    'read_timeout' => 300, // gaps between chunks (LLM thinking) can be long
                    'connect_timeout' => 30,
                ]);

                $body = $response->getBody();
                while (!$body->eof()) {
                    $chunk = $body->read(1024);
                    echo $chunk;
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();
                }
            } catch (\Exception $e) {
                echo "data: " . json_encode(['type' => 'error', 'message' => $e->getMessage()]) . "\n\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no', // Disable nginx buffering
        ]);
    }

    public function aiCommit(Request $request, $id)
    {
        $request->validate([
            'new_modules' => 'required|array|max:8',
            'new_modules.*.title' => 'required|string|max:255',
        ]);

        return DB::transaction(function () use ($request, $id) {
            // Only the owning teacher can commit AI-generated structure
            $course = Course::where('id', $id)
                ->where('teacher_id', auth()->id())
                ->firstOrFail();

            $modules = $request->input('new_modules', []);
            $savedModules = [];
            $baseOrderIndex = $course->modules()->count();

            foreach ($modules as $i => $m) {
                $newModule = \App\Models\Module::create([
                    'course_id' => $id,
                    'title' => $m['title'],
                    'order_index' => $baseOrderIndex + $i + 1
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

    public function destroy($id)
    {
        $course = Course::where('id', $id)
            ->where('teacher_id', auth()->id())
            ->firstOrFail();

        $course->delete();
        return response()->json(['success' => true]);
    }

    public function generateContent(Request $request, $id)
    {
        // Increase timeout for 3-stage AI pipeline (outline + content + formatting)
        set_time_limit(900); // 15 minutes

        $course = Course::where('id', $id)
            ->where('teacher_id', auth()->id())
            ->firstOrFail();

        $request->validate([
            'curriculum_structure' => 'required|string', // JSON of approved modules with IDs
            'content_params' => 'required|array',
        ]);

        return new StreamedResponse(function () use ($request, $course) {
            $aiUrl = env('AI_SERVICE_URL') . '/ai/generate-content-stream';
            $params = $request->input('content_params');

            // Build multipart request
            $multipart = [
                ['name' => 'curriculum_structure', 'contents' => $request->curriculum_structure],
                ['name' => 'difficulty', 'contents' => $params['difficulty'] ?? 'beginner'],
                ['name' => 'content_depth', 'contents' => $params['contentDepth'] ?? 'standard'],
                ['name' => 'writing_style', 'contents' => $params['writingStyle'] ?? 'conversational'],
                ['name' => 'question_type_distribution', 'contents' => $params['questionTypeDistribution'] ?? 'balanced'],
                ['name' => 'include_videos', 'contents' => ($params['includeVideos'] ?? false) ? 'true' : 'false'],
                ['name' => 'is_coding', 'contents' => $params['is_coding'] || $course->is_coding ? 'true' : 'false'],
            ];

            // Add curriculum text if exists
            if ($course->curriculum_text) {
                $multipart[] = ['name' => 'curriculum_text', 'contents' => $course->curriculum_text];
                \Log::info("Course {$course->id}: Sending " . strlen($course->curriculum_text) . " chars of curriculum text to AI");
            } else {
                \Log::warning("Course {$course->id}: NO curriculum_text - AI will generate GENERIC content based only on titles!");
                $multipart[] = ['name' => 'curriculum_text', 'contents' => ''];
            }

            // Stream from AI service and save to database
            $client = new \GuzzleHttp\Client();
            try {
                // Send initial status immediately to prevent timeout
                echo "data: " . json_encode(['type' => 'status', 'message' => 'Connecting to AI service...']) . "\n\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();

                $response = $client->post($aiUrl, [
                    'multipart' => $multipart,
                    'stream' => true,
                    'timeout' => 600, // 10 minutes for 3-stage pipeline
                    'read_timeout' => 600,
                    'connect_timeout' => 30,
                ]);

                $body = $response->getBody();
                $buffer = '';

                while (!$body->eof()) {
                    $chunk = $body->read(512); // Smaller chunk size for more responsive streaming
                    $buffer .= $chunk;

                    // Look for complete SSE messages (ending with \n\n)
                    while (($messageEnd = strpos($buffer, "\n\n")) !== false) {
                        $message = substr($buffer, 0, $messageEnd + 2);
                        $buffer = substr($buffer, $messageEnd + 2);

                        $line = trim($message);
                        if ($line !== '' && $line[0] === ':') {
                            // SSE comment (Python heartbeat) — pass through so
                            // proxies keep the browser stream alive during
                            // long LLM calls instead of timing out silently
                            echo $message;
                            if (ob_get_level() > 0) {
                                ob_flush();
                            }
                            flush();
                            continue;
                        }
                        if (strpos($line, 'data: ') === 0) {
                            $data = json_decode(substr($line, 6), true);

                            if ($data && isset($data['type'])) {
                                // Save lesson content to database
                                if ($data['type'] === 'lesson_complete') {
                                    $lessonData = $data['data'];
                                    // Scoped: the AI echoes back client-supplied IDs, so
                                    // the lesson MUST belong to this teacher's course
                                    // before its content is overwritten
                                    $lesson = Lesson::where('id', $lessonData['lesson_id'] ?? 0)
                                        ->whereHas('module.course', fn($q) => $q->where('teacher_id', $course->teacher_id))
                                        ->first();

                                    if ($lesson) {
                                        // Generate UUIDs for blocks
                                        $blocks = $lessonData['blocks'];
                                        foreach ($blocks as &$block) {
                                            $block['id'] = (string) Str::uuid();
                                        }

                                        $lesson->update(['content' => $blocks]);
                                    }
                                }

                                // Save quiz questions to database
                                if ($data['type'] === 'quiz_complete') {
                                    $quizData = $data['data'];
                                    $quiz = Quiz::where('id', $quizData['quiz_id'] ?? 0)
                                        ->whereHas('module.course', fn($q) => $q->where('teacher_id', $course->teacher_id))
                                        ->first();

                                    if ($quiz) {
                                        // Regeneration REPLACES: clear this quiz's previous
                                        // questions (and their test cases) so a re-run doesn't
                                        // stack a second copy of every question
                                        $existingQuestionIds = $quiz->questions()->pluck('id');
                                        if ($existingQuestionIds->isNotEmpty()) {
                                            QuestionTestCase::whereIn('testable_id', $existingQuestionIds)
                                                ->where('testable_type', Question::class)
                                                ->delete();
                                            Question::whereIn('id', $existingQuestionIds)->delete();
                                        }

                                        // Handle grouped structure (preferred) or flat array (fallback)
                                        $questions = [];
                                        if (isset($quizData['multiple_choice'])) {
                                            // New grouped format - flatten in order
                                            \Log::info("Quiz {$quiz->id}: Using grouped structure");
                                            $questions = array_merge(
                                                $quizData['multiple_choice'] ?? [],
                                                $quizData['true_false'] ?? [],
                                                $quizData['identification'] ?? [],
                                                $quizData['enumeration'] ?? [],
                                                $quizData['coding'] ?? []
                                            );
                                        } elseif (isset($quizData['questions'])) {
                                            // Old flat format - convert to grouped order
                                            \Log::warning("Quiz {$quiz->id}: AI returned flat structure, converting to grouped order");

                                            // Group questions by type
                                            $grouped = [
                                                'multiple_choice' => [],
                                                'true_false' => [],
                                                'identification' => [],
                                                'enumeration' => [],
                                                'coding' => []
                                            ];

                                            foreach ($quizData['questions'] as $q) {
                                                $type = $q['type'] ?? 'multiple_choice';
                                                if (isset($grouped[$type])) {
                                                    $grouped[$type][] = $q;
                                                }
                                            }

                                            // Flatten in correct order
                                            $questions = array_merge(
                                                $grouped['multiple_choice'],
                                                $grouped['true_false'],
                                                $grouped['identification'],
                                                $grouped['enumeration'],
                                                $grouped['coding']
                                            );
                                        } else {
                                            \Log::error("Quiz {$quiz->id}: Invalid quiz data format", ['keys' => array_keys($quizData)]);
                                            $questions = [];
                                        }

                                        // Use timer settings from content params
                                        $timeLimitMinutes = $request->input('content_params.quizTimeLimit', 15);
                                        $timerMode = $request->input('content_params.quizTimerMode', 'entire_quiz');

                                        $quiz->update([
                                            'time_limit_minutes' => $timeLimitMinutes,
                                            'timer_mode' => $timerMode
                                        ]);

                                        $totalPoints = 0;
                                        $orderIndex = 1;

                                        foreach ($questions as $questionData) {
                                            // Fallback: if AI used 'answer' instead of 'expected_output', use it
                                            $expectedOutput = $questionData['expected_output'] ?? $questionData['answer'] ?? '';

                                            // Fallback: if AI used 'question' instead of 'question_text', use it
                                            $questionText = $questionData['question_text'] ?? $questionData['question'] ?? '';

                                            // For enumeration, expected_output should always be empty string (answer is in options)
                                            if (isset($questionData['type']) && $questionData['type'] === 'enumeration') {
                                                $expectedOutput = '';
                                            }

                                            // For multiple_choice, if expected_output is answer text instead of index, find the index
                                            if (isset($questionData['type']) && $questionData['type'] === 'multiple_choice' && isset($questionData['options']) && !is_numeric($expectedOutput)) {
                                                // Case/whitespace-insensitive text match first…
                                                $index = false;
                                                foreach ($questionData['options'] as $i => $option) {
                                                    if (mb_strtolower(trim((string) $option)) === mb_strtolower(trim((string) $expectedOutput))) {
                                                        $index = $i;
                                                        break;
                                                    }
                                                }
                                                if ($index !== false) {
                                                    $expectedOutput = (string)$index;
                                                } else {
                                                    // …and if the text matches nothing, store an empty
                                                    // answer rather than an ungradeable string — the
                                                    // quiz builder flags it as "no correct answer yet"
                                                    $expectedOutput = '';
                                                }
                                            }

                                            // Set options based on type
                                            $questionType = $questionData['type'] ?? 'multiple_choice';
                                            $options = $questionData['options'] ?? null;

                                            // For non-MC/TF types, options should be empty array, not null
                                            if (in_array($questionType, ['identification', 'enumeration', 'coding']) && is_null($options)) {
                                                $options = [];
                                            }

                                            // Coding questions carry their language (the column is NOT NULL
                                            // with a java default, so fall back to it when the AI omitted
                                            // it) and the reference solution used to verify the generated
                                            // test cases.
                                            $question = Question::create([
                                                'quiz_id' => $quiz->id,
                                                'question_text' => $questionText,
                                                'type' => $questionType,
                                                'options' => $options,
                                                'expected_output' => $expectedOutput,
                                                'boilerplate' => $questionData['boilerplate'] ?? null,
                                                'language' => $questionType === 'coding' ? ($questionData['language'] ?? 'java') : 'java',
                                                'reference_code' => $questionType === 'coding' ? ($questionData['reference_solution'] ?? null) : null,
                                                'points' => $questionData['points'] ?? 1,
                                                'order_index' => $orderIndex++,
                                            ]);

                                            // Persist the AI-generated test cases (already verified
                                            // against the reference solution by the AI service) so
                                            // the question grades through the test-case engine.
                                            if ($questionType === 'coding' && isset($questionData['test_cases']) && is_array($questionData['test_cases'])) {
                                                foreach (array_slice($questionData['test_cases'], 0, 20) as $caseIndex => $case) {
                                                    if (! is_array($case) || ! isset($case['expected_output']) || trim((string) $case['expected_output']) === '') {
                                                        continue;
                                                    }
                                                    QuestionTestCase::create([
                                                        'testable_type' => Question::class,
                                                        'testable_id' => $question->id,
                                                        'input' => (string) ($case['input'] ?? ''),
                                                        'expected_output' => (string) $case['expected_output'],
                                                        'hidden' => (bool) ($case['hidden'] ?? false),
                                                        'order_index' => $caseIndex,
                                                    ]);
                                                }
                                            }

                                            $totalPoints += $questionData['points'] ?? 1;
                                        }

                                        // Calculate passing score from percentage
                                        $passingPercentage = $request->input('content_params.passingPercentage', 70);
                                        $passingScore = floor($totalPoints * $passingPercentage / 100);

                                        // Update quiz settings
                                        $quiz->update([
                                            'passing_score' => $passingScore,
                                            'ai_enabled' => $request->input('content_params.allowAIAssistance', false),
                                        ]);
                                    }
                                }
                            }

                            // Forward to frontend with proper SSE format
                            echo $message;
                            if (ob_get_level() > 0) {
                                ob_flush();
                            }
                            flush();
                        }
                    }
                }
            } catch (\Exception $e) {
                \Log::error("Content generation error: " . $e->getMessage());
                echo "data: " . json_encode(['type' => 'error', 'message' => $e->getMessage()]) . "\n\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
