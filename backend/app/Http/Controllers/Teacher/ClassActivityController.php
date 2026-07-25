<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\ActivityAnswer;
use App\Models\ActivityQuestion;
use App\Models\ActivitySubmission;
use App\Models\ClassActivity;
use App\Models\Classroom;
use App\Models\Enrollment;
use App\Models\User;
use Cloudinary\Api\Upload\UploadApi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClassActivityController extends Controller
{
    private function cloudinary(): ?UploadApi
    {
        $cloudName = env('CLOUDINARY_CLOUD_NAME');
        $apiKey = env('CLOUDINARY_API_KEY');
        $apiSecret = env('CLOUDINARY_API_SECRET');

        if (! $cloudName || ! $apiKey || ! $apiSecret) {
            return null;
        }

        return new UploadApi([
            'cloud' => [
                'cloud_name' => $cloudName,
                'api_key' => $apiKey,
                'api_secret' => $apiSecret,
            ],
        ]);
    }

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
            'deadline_behavior' => 'nullable|string|in:hard,soft',
            'late_submission' => 'nullable|boolean',
            'late_penalty_pct' => 'nullable|numeric|min:0|max:100',
            'time_limit_minutes' => 'nullable|numeric|min:0',
        ];

        if ($request->activity_type === 'activity') {
            $rules['submission_type'] = 'required|string|in:file,questions,material';
            $rules['deadline_at'] = $request->submission_type === 'material' ? 'nullable|date' : 'required|date';
        } else {
            $rules['deadline_at'] = 'required|date';
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

        if ($activity->is_published && $activity->submissions()->exists()) {
            $allowed = ['deadline_at', 'deadline_behavior', 'is_published'];
            $validated = array_intersect_key($validated, array_flip($allowed));
        }

        $activity->update($validated);

        return response()->json($activity);
    }

    public function destroy($id)
    {
        $activity = $this->authorizeActivity($id);

        $files = $activity->instruction_files ?? [];
        if (! empty($files)) {
            $uploadApi = $this->cloudinary();
            if ($uploadApi) {
                foreach ($files as $file) {
                    if (! empty($file['public_id'])) {
                        try { $uploadApi->destroy($file['public_id']); } catch (\Exception $e) { \Log::warning('Cloudinary cleanup: '.$e->getMessage()); }
                    }
                }
            }
        }

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
        $activity = $this->authorizeActivity($activityId);

        if ($activity->deadline_at && now()->gt($activity->deadline_at) && $activity->deadline_behavior === 'hard') {
            return response()->json(['message' => 'Cannot modify questions past deadline'], 422);
        }

        if ($activity->is_published && $activity->submissions()->exists()) {
            return response()->json(['message' => 'Cannot modify questions once submissions exist'], 422);
        }

        $validated = $request->validate([
            'type' => 'required|string|in:multiple_choice,true_false,identification,enumeration,short_answer,essay,coding',
            'question_text' => 'required|string|max:5000',
            'options' => 'nullable|array',
            'options.*' => 'string|max:1000',
            'expected_output' => 'nullable|string|max:5000',
            'boilerplate' => 'nullable|string|max:5000',
            'points' => 'required|numeric|min:0|max:99999',
        ]);

        $maxOrder = ActivityQuestion::where('activity_id', $activityId)->max('order_index') ?? 0;

        if (in_array($validated['type'], ['multiple_choice', 'true_false']) && empty($validated['options'])) {
            return response()->json(['message' => 'Options are required for this question type'], 422);
        }

        $question = ActivityQuestion::create([
            'activity_id' => $activityId,
            'type' => $validated['type'],
            'question_text' => $validated['question_text'],
            'options' => $validated['options'] ?? [],
            'expected_output' => $validated['expected_output'] ?? '',
            'boilerplate' => $validated['boilerplate'] ?? '',
            'points' => $validated['points'],
            'order_index' => $maxOrder + 1,
        ]);

        return response()->json($question, 201);
    }

    public function updateQuestion(Request $request, $activityId, $questionId)
    {
        $activity = $this->authorizeActivity($activityId);

        if ($activity->deadline_at && now()->gt($activity->deadline_at) && $activity->deadline_behavior === 'hard') {
            return response()->json(['message' => 'Cannot modify questions past deadline'], 422);
        }

        if ($activity->is_published && $activity->submissions()->exists()) {
            return response()->json(['message' => 'Cannot modify questions once submissions exist'], 422);
        }

        $question = ActivityQuestion::where('id', $questionId)
            ->where('activity_id', $activityId)
            ->firstOrFail();

        $validated = $request->validate([
            'type' => 'sometimes|string|in:multiple_choice,true_false,identification,enumeration,short_answer,essay,coding',
            'question_text' => 'sometimes|string|max:5000',
            'options' => 'nullable|array',
            'options.*' => 'string|max:1000',
            'expected_output' => 'nullable|string|max:5000',
            'boilerplate' => 'nullable|string|max:5000',
            'points' => 'sometimes|numeric|min:0|max:99999',
            'order_index' => 'sometimes|integer|min:0',
        ]);

        if (isset($validated['type']) && in_array($validated['type'], ['multiple_choice', 'true_false'])) {
            $options = $validated['options'] ?? $question->options;
            if (empty($options)) {
                return response()->json(['message' => 'Options are required for this question type'], 422);
            }
        }

        $question->update($validated);

        return response()->json($question);
    }

    public function destroyQuestion($activityId, $questionId)
    {
        $activity = $this->authorizeActivity($activityId);

        if ($activity->deadline_at && now()->gt($activity->deadline_at) && $activity->deadline_behavior === 'hard') {
            return response()->json(['message' => 'Cannot modify questions past deadline'], 422);
        }

        if ($activity->is_published && $activity->submissions()->exists()) {
            return response()->json(['message' => 'Cannot modify questions once submissions exist'], 422);
        }

        $question = ActivityQuestion::where('id', $questionId)
            ->where('activity_id', $activityId)
            ->firstOrFail();

        $question->delete();

        return response()->json(['message' => 'Question removed.']);
    }

    public function reorderQuestions(Request $request, $activityId)
    {
        $activity = $this->authorizeActivity($activityId);

        if ($activity->deadline_at && now()->gt($activity->deadline_at) && $activity->deadline_behavior === 'hard') {
            return response()->json(['message' => 'Cannot reorder questions past deadline'], 422);
        }

        if ($activity->is_published && $activity->submissions()->exists()) {
            return response()->json(['message' => 'Cannot reorder questions once submissions exist'], 422);
        }

        $validated = $request->validate([
            'question_ids' => 'required|array|min:1',
            'question_ids.*' => 'integer|exists:activity_questions,id',
        ]);

        DB::transaction(function () use ($validated, $activityId) {
            foreach ($validated['question_ids'] as $index => $id) {
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
            ->with(['student.studentProfile', 'answers.question'])
            ->orderBy('submitted_at', 'desc')
            ->get();

        return response()->json($submissions);
    }

    public function gradeSubmission(Request $request, $activityId, $submissionId)
    {
        $this->authorizeActivity($activityId);

        $validated = $request->validate([
            'score' => 'sometimes|nullable|numeric|min:0',
            'teacher_notes' => 'nullable|string',
            'answers' => 'sometimes|array',
            'answers.*.question_id' => 'required|exists:activity_questions,id',
            'answers.*.score' => 'required|numeric|min:0',
        ]);

        $submission = ActivitySubmission::where('id', $submissionId)
            ->where('activity_id', $activityId)
            ->firstOrFail();

        DB::transaction(function () use ($submission, $validated) {
            if (!empty($validated['answers'])) {
                $total = 0;
                foreach ($validated['answers'] as $a) {
                    ActivityAnswer::where('submission_id', $submission->id)
                        ->where('question_id', $a['question_id'])
                        ->update([
                            'score' => $a['score'],
                            'is_correct' => $a['score'] > 0,
                        ]);
                    $total += $a['score'];
                }
                $validated['score'] = $total;
            }

            $submission->update([
                'score' => $validated['score'] ?? $submission->score,
                'teacher_notes' => $validated['teacher_notes'] ?? null,
                'status' => 'graded',
                'graded_at' => now(),
                'graded_by' => auth()->id(),
            ]);
        });

        $submission->load(['answers.question', 'student.studentProfile']);

        return response()->json($submission);
    }

    public function getEnrolledWithStatus($activityId)
    {
        $activity = $this->authorizeActivity($activityId);

        $submissions = ActivitySubmission::where('activity_id', $activityId)
            ->get()
            ->keyBy('student_id');

        $enrolled = Enrollment::where('class_id', $activity->class_id)
            ->with('student.studentProfile')
            ->get()
            ->map(function ($e) use ($submissions) {
                $s = $submissions->get($e->student_id);
                return [
                    'student' => $e->student,
                    'submission_id' => $s?->id,
                    'submission_status' => $s?->status ?? 'none',
                    'submitted_at' => $s?->submitted_at,
                    'score' => $s?->score,
                    'max_score' => $s?->max_score,
                ];
            });

        return response()->json($enrolled);
    }

    public function gradeBulk(Request $request, $activityId)
    {
        $this->authorizeActivity($activityId);

        $request->validate([
            'submission_ids' => 'required|array',
            'submission_ids.*' => 'exists:activity_submissions,id',
        ]);

        $count = ActivitySubmission::whereIn('id', $request->submission_ids)
            ->where('activity_id', $activityId)
            ->whereNull('graded_at')
            ->where('status', 'submitted')
            ->update([
                'status' => 'graded',
                'graded_at' => now(),
                'graded_by' => auth()->id(),
            ]);

        return response()->json(['message' => "{$count} submission(s) graded"]);
    }

    // ── Gradebook ──

    public function gradebook($classId)
    {
        $this->authorizeTeacher($classId);

        $activities = ClassActivity::where('class_id', $classId)
            ->where('is_published', true)
            ->withCount('questions')
            ->orderBy('created_at', 'asc')
            ->get(['id', 'title', 'activity_type', 'submission_type', 'max_points', 'deadline_at']);

        $students = User::whereHas('enrollments', fn($q) => $q->where('class_id', $classId))
            ->with('studentProfile')
            ->orderBy('email')
            ->get(['id', 'email', 'avatar']);

        $submissions = ActivitySubmission::whereIn('activity_id', $activities->pluck('id'))
            ->whereIn('student_id', $students->pluck('id'))
            ->get(['id', 'student_id', 'activity_id', 'score', 'max_score', 'status', 'submitted_at']);

        $grades = [];
        foreach ($submissions as $s) {
            $grades[$s->student_id][$s->activity_id] = [
                'score' => $s->score,
                'max_score' => $s->max_score,
                'status' => $s->status,
                'submitted_at' => $s->submitted_at,
            ];
        }

        return response()->json(compact('activities', 'students', 'grades'));
    }

    // ── Instruction Files ──

    public function uploadInstructionFile(Request $request, $id)
    {
        $activity = $this->authorizeActivity($id);

        if ($activity->is_published && $activity->submissions()->exists()) {
            return response()->json(['message' => 'Cannot modify activity once submissions exist'], 422);
        }

        $request->validate([
            'file' => 'required|file|mimes:pdf,doc,docx,txt,ppt,pptx,xls,xlsx,jpg,jpeg,png,zip|max:20480',
        ]);

        $file = $request->file('file');

        if (! $file || ! $file->isValid()) {
            throw new \Exception('Invalid file upload');
        }

        $uploadApi = $this->cloudinary();

        if (! $uploadApi) {
            throw new \Exception('Cloudinary credentials are missing in .env');
        }

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

        if ($activity->is_published && $activity->submissions()->exists()) {
            return response()->json(['message' => 'Cannot modify activity once submissions exist'], 422);
        }

        $request->validate(['public_id' => 'required|string']);

        $publicId = $request->input('public_id');

        try {
            $uploadApi = $this->cloudinary();
            if ($uploadApi) {
                $uploadApi->destroy($publicId);
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
