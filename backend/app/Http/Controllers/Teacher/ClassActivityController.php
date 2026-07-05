<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\ActivityQuestion;
use App\Models\ActivitySubmission;
use App\Models\ClassActivity;
use App\Models\Classroom;
use Cloudinary\Api\Upload\UploadApi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClassActivityController extends Controller
{
    private function authorizeTeacher($classId)
    {
        $classroom = Classroom::where('id', $classId)
            ->where('teacher_id', auth()->id())
            ->first();

        if (! $classroom) {
            abort(403, 'Class not found or unauthorized');
        }

        return $classroom;
    }

    private function authorizeActivity($id)
    {
        $activity = ClassActivity::with('class')
            ->whereHas('class', function ($q) {
                $q->where('teacher_id', auth()->id());
            })
            ->findOrFail($id);

        return $activity;
    }

    public function index($classId)
    {
        $this->authorizeTeacher($classId);

        $activities = ClassActivity::where('class_id', $classId)
            ->withCount(['submissions', 'questions'])
            ->orderBy('order_index', 'asc')
            ->get();

        return response()->json($activities);
    }

    public function store(Request $request, $classId)
    {
        $this->authorizeTeacher($classId);

        $rules = [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'activity_type' => 'required|string|in:quiz,activity',
            'grading_method' => 'nullable|string|in:auto,manual,none',
            'max_points' => 'nullable|numeric|min:0',
            'deadline_at' => 'nullable|date',
            'deadline_behavior' => 'nullable|string|in:hard,soft',
            'late_submission' => 'nullable|boolean',
            'late_penalty_pct' => 'nullable|numeric|min:0|max:100',
            'time_limit_minutes' => 'nullable|numeric|min:0',
        ];

        if ($request->activity_type === 'activity') {
            $rules['submission_type'] = 'required|string|in:file,questions,material';
        }

        $validated = $request->validate($rules);

        $maxOrder = ClassActivity::where('class_id', $classId)->max('order_index') ?? 0;

        $activity = ClassActivity::create([
            'class_id' => $classId,
            'teacher_id' => auth()->id(),
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'activity_type' => $validated['activity_type'],
            'submission_type' => $validated['submission_type'] ?? null,
            'grading_method' => $validated['grading_method'] ?? match ($validated['submission_type'] ?? null) {
                'file' => 'manual',
                'questions' => 'auto',
                'material' => 'none',
                default => null,
            },
            'max_points' => $validated['max_points'] ?? null,
            'deadline_at' => $validated['deadline_at'] ?? null,
            'deadline_behavior' => $validated['deadline_behavior'] ?? 'hard',
            'late_submission' => $validated['late_submission'] ?? false,
            'late_penalty_pct' => $validated['late_penalty_pct'] ?? null,
            'time_limit_minutes' => $validated['time_limit_minutes'] ?? null,
            'order_index' => $maxOrder + 1,
        ]);

        return response()->json($activity, 201);
    }

    public function show($id)
    {
        $activity = $this->authorizeActivity($id);

        $activity->load([
            'questions' => function ($q) {
                $q->orderBy('order_index', 'asc');
            },
            'submissions' => function ($q) {
                $q->with('student.studentProfile');
            },
        ]);

        $activity->loadCount('submissions');

        return response()->json($activity);
    }

    public function update(Request $request, $id)
    {
        $activity = $this->authorizeActivity($id);

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|nullable|string',
            'activity_type' => 'sometimes|string|in:quiz,activity',
            'submission_type' => 'sometimes|string|in:file,questions,material',
            'grading_method' => 'sometimes|nullable|string|in:auto,manual,none',
            'max_points' => 'sometimes|nullable|numeric|min:0',
            'deadline_at' => 'sometimes|nullable|date',
            'deadline_behavior' => 'sometimes|string|in:hard,soft',
            'late_submission' => 'sometimes|boolean',
            'late_penalty_pct' => 'sometimes|nullable|numeric|min:0|max:100',
            'time_limit_minutes' => 'sometimes|nullable|numeric|min:0',
            'is_published' => 'sometimes|boolean',
            'is_live' => 'sometimes|boolean',
            'live_status' => 'sometimes|string|in:scheduled,active,paused,completed',
            'live_scheduled_at' => 'sometimes|nullable|date',
        ]);

        $activity->update($validated);

        return response()->json($activity);
    }

    public function destroy($id)
    {
        $activity = $this->authorizeActivity($id);
        $activity->delete();

        return response()->json(['message' => 'Activity removed.']);
    }

    public function togglePublish($id)
    {
        $activity = $this->authorizeActivity($id);
        $activity->update(['is_published' => ! $activity->is_published]);

        return response()->json($activity);
    }

    // ── Questions ──

    public function storeQuestion(Request $request, $activityId)
    {
        $this->authorizeActivity($activityId);

        $maxOrder = ActivityQuestion::where('activity_id', $activityId)->max('order_index') ?? 0;

        $question = ActivityQuestion::create([
            'activity_id' => $activityId,
            'type' => $request->input('type', 'multiple_choice'),
            'question_text' => $request->input('question_text', 'New Question'),
            'options' => $request->input('options', []),
            'expected_output' => $request->input('expected_output', ''),
            'boilerplate' => $request->input('boilerplate', ''),
            'points' => $request->input('points', 1),
            'order_index' => $maxOrder + 1,
        ]);

        return response()->json($question, 201);
    }

    public function updateQuestion(Request $request, $activityId, $questionId)
    {
        $this->authorizeActivity($activityId);

        $question = ActivityQuestion::where('id', $questionId)
            ->where('activity_id', $activityId)
            ->firstOrFail();

        $question->update($request->all());

        return response()->json($question);
    }

    public function destroyQuestion($activityId, $questionId)
    {
        $this->authorizeActivity($activityId);

        $question = ActivityQuestion::where('id', $questionId)
            ->where('activity_id', $activityId)
            ->firstOrFail();

        $question->delete();

        return response()->json(['message' => 'Question removed.']);
    }

    public function reorderQuestions(Request $request, $activityId)
    {
        $this->authorizeActivity($activityId);

        $request->validate(['question_ids' => 'required|array']);

        DB::transaction(function () use ($request, $activityId) {
            foreach ($request->question_ids as $index => $id) {
                ActivityQuestion::where('id', $id)
                    ->where('activity_id', $activityId)
                    ->update(['order_index' => $index + 1]);
            }
        });

        return response()->json(['message' => 'Reordered']);
    }

    // ── Submissions (for teacher grading) ──

    public function submissions($activityId)
    {
        $this->authorizeActivity($activityId);

        $submissions = ActivitySubmission::where('activity_id', $activityId)
            ->with(['student.studentProfile', 'answers'])
            ->orderBy('submitted_at', 'desc')
            ->get();

        return response()->json($submissions);
    }

    public function gradeSubmission(Request $request, $activityId, $submissionId)
    {
        $this->authorizeActivity($activityId);

        $validated = $request->validate([
            'score' => 'required|numeric|min:0',
            'teacher_notes' => 'nullable|string',
        ]);

        $submission = ActivitySubmission::where('id', $submissionId)
            ->where('activity_id', $activityId)
            ->firstOrFail();

        $submission->update([
            'score' => $validated['score'],
            'teacher_notes' => $validated['teacher_notes'] ?? null,
            'status' => 'graded',
            'graded_at' => now(),
            'graded_by' => auth()->id(),
        ]);

        return response()->json($submission);
    }

    // ── Instruction Files ──

    public function uploadInstructionFile(Request $request, $id)
    {
        $activity = $this->authorizeActivity($id);

        $request->validate([
            'file' => 'required|file|mimes:pdf,doc,docx,txt,ppt,pptx,xls,xlsx,jpg,jpeg,png,zip|max:20480',
        ]);

        $file = $request->file('file');

        if (! $file || ! $file->isValid()) {
            throw new \Exception('Invalid file upload');
        }

        $cloudName = env('CLOUDINARY_CLOUD_NAME');
        $apiKey = env('CLOUDINARY_API_KEY');
        $apiSecret = env('CLOUDINARY_API_SECRET');

        if (! $cloudName || ! $apiKey || ! $apiSecret) {
            throw new \Exception('Cloudinary credentials are missing in .env');
        }

        $config = [
            'cloud' => [
                'cloud_name' => $cloudName,
                'api_key' => $apiKey,
                'api_secret' => $apiSecret,
            ],
        ];

        $uploadApi = new UploadApi($config);

        $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $extension = $file->getClientOriginalExtension();

        $result = $uploadApi->upload($file->getRealPath(), [
            'folder' => 'instructai/class-activities',
            'resource_type' => 'auto',
            'public_id' => $originalName.'_'.time(),
            'format' => $extension,
        ]);

        if (! $result || ! isset($result['secure_url'])) {
            throw new \Exception('Cloudinary upload failed');
        }

        $files = $activity->instruction_files ?? [];
        $files[] = [
            'name' => $file->getClientOriginalName(),
            'url' => $result['secure_url'],
            'size' => $file->getSize(),
            'public_id' => $result['public_id'],
        ];

        $activity->update(['instruction_files' => $files]);

        return response()->json($files);
    }

    public function deleteInstructionFile(Request $request, $id)
    {
        $activity = $this->authorizeActivity($id);

        $request->validate(['public_id' => 'required|string']);

        $publicId = $request->input('public_id');

        try {
            $cloudName = env('CLOUDINARY_CLOUD_NAME');
            $apiKey = env('CLOUDINARY_API_KEY');
            $apiSecret = env('CLOUDINARY_API_SECRET');

            if ($cloudName && $apiKey && $apiSecret) {
                $config = [
                    'cloud' => [
                        'cloud_name' => $cloudName,
                        'api_key' => $apiKey,
                        'api_secret' => $apiSecret,
                    ],
                ];
                (new UploadApi($config))->destroy($publicId);
            }
        } catch (\Exception $e) {
            \Log::warning('Cloudinary delete failed (continuing): '.$e->getMessage());
        }

        $files = $activity->instruction_files ?? [];
        $files = array_values(array_filter($files, fn ($f) => ($f['public_id'] ?? '') !== $publicId));

        $activity->update(['instruction_files' => $files]);

        return response()->json($files);
    }
}
