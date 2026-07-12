<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\ClassActivity;
use App\Models\ActivitySubmission;
use App\Models\ActivityAnswer;
use App\Models\Enrollment;
use Cloudinary\Api\Upload\UploadApi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClassActivityController extends Controller
{
    private function checkEnrollment($classId)
    {
        $enrolled = Enrollment::where('student_id', auth()->id())
            ->where('class_id', $classId)
            ->exists();

        if (! $enrolled) {
            abort(403, 'Not enrolled in this class');
        }
    }

    private function getSubmission($activityId)
    {
        return ActivitySubmission::where('activity_id', $activityId)
            ->where('student_id', auth()->id())
            ->with('answers')
            ->first();
    }

    public function index($classId)
    {
        $this->checkEnrollment($classId);

        $activities = ClassActivity::where('class_id', $classId)
            ->where('is_published', true)
            ->withCount('questions')
            ->orderBy('created_at', 'desc')
            ->get();

        $studentId = auth()->id();
        $now = now();

        $result = $activities->map(function ($activity) use ($studentId, $now) {
            $submission = ActivitySubmission::where('activity_id', $activity->id)
                ->where('student_id', $studentId)
                ->first();

            $status = 'not_submitted';
            if ($submission) {
                $status = $submission->status;
            } elseif ($activity->deadline_at && $now->gt($activity->deadline_at) && $activity->deadline_behavior === 'hard') {
                $status = 'missed';
            }

            $activity->submission_status = $status;
            $activity->submission_summary = $submission ? [
                'score' => $submission->score,
                'max_score' => $submission->max_score,
                'status' => $submission->status,
                'submitted_at' => $submission->submitted_at,
            ] : null;

            return $activity;
        });

        return response()->json($result);
    }

    public function show($id)
    {
        $activity = ClassActivity::with([
            'questions' => fn($q) => $q->orderBy('order_index', 'asc'),
            'class',
        ])->findOrFail($id);

        $this->checkEnrollment($activity->class_id);

        $activity->questions->each(function ($question) {
            if ($question->type !== 'coding') {
                unset($question->expected_output);
            }
        });

        $submission = $this->getSubmission($id);

        return response()->json([
            'activity' => $activity,
            'submission' => $submission,
        ]);
    }

    public function submit(Request $request, $id)
    {
        $activity = ClassActivity::with('questions')->findOrFail($id);
        $this->checkEnrollment($activity->class_id);

        if ($activity->deadline_at && now()->gt($activity->deadline_at) && $activity->deadline_behavior === 'hard') {
            return response()->json(['message' => 'Deadline has passed'], 422);
        }

        $studentId = auth()->id();

        return DB::transaction(function () use ($request, $activity, $studentId) {
            $existing = ActivitySubmission::where('activity_id', $activity->id)
                ->where('student_id', $studentId)
                ->first();

            $isLate = $activity->deadline_at && now()->gt($activity->deadline_at);

            if ($existing && $existing->status === 'submitted' && $activity->submission_type === 'questions') {
                return response()->json(['message' => 'Already submitted'], 422);
            }

            $data = [
                'activity_id' => $activity->id,
                'student_id' => $studentId,
                'status' => 'submitted',
                'submitted_at' => now(),
                'is_late' => $isLate,
            ];

            if ($activity->submission_type === 'material') {
                $data['max_score'] = 0;
            }

            if ($activity->submission_type === 'questions') {
                $data['max_score'] = $activity->questions->sum('points');
            }

            if ($existing) {
                $existing->update($data);
                $submission = $existing;
            } else {
                $submission = ActivitySubmission::create($data);
            }

            if ($activity->submission_type === 'questions' && $request->has('answers')) {
                $answers = $request->input('answers', []);
                $totalScore = 0;

                foreach ($activity->questions as $question) {
                    $rawAnswer = $answers[$question->id] ?? null;
                    if ($rawAnswer === null) continue;

                    $isCorrect = false;
                    $score = 0;

                    if ($activity->grading_method === 'auto') {
                        if ($question->type === 'multiple_choice' || $question->type === 'true_false') {
                            $isCorrect = strtolower(trim((string) $rawAnswer)) === strtolower(trim((string) $question->expected_output));
                        } elseif (in_array($question->type, ['identification', 'short_answer'])) {
                            $isCorrect = strtolower(trim((string) $rawAnswer)) === strtolower(trim((string) $question->expected_output));
                        } elseif ($question->type === 'enumeration') {
                            $correctItems = array_map(fn($i) => strtolower(trim((string) $i)), $question->options ?? []);
                            $studentItems = array_map(fn($i) => strtolower(trim((string) $i)), (array) $rawAnswer);
                            $studentItems = array_values(array_filter($studentItems, fn($i) => $i !== ''));

                            $correctCount = 0;
                            foreach ($studentItems as $sItem) {
                                if (in_array($sItem, $correctItems)) {
                                    $correctCount++;
                                }
                            }
                            $itemPoints = $question->points / max(count($correctItems), 1);
                            $score = $correctCount * $itemPoints;
                            $isCorrect = $correctCount === count($correctItems);
                        }

                        if (! in_array($question->type, ['enumeration'])) {
                            $score = $isCorrect ? (float) $question->points : 0;
                        }
                    }

                    if (in_array($question->type, ['essay', 'coding'])) {
                        $score = 0;
                        $isCorrect = false;
                    }

                    ActivityAnswer::updateOrCreate(
                        [
                            'submission_id' => $submission->id,
                            'question_id' => $question->id,
                        ],
                        [
                            'submitted_answer' => is_array($rawAnswer) ? json_encode($rawAnswer) : (string) $rawAnswer,
                            'is_correct' => $isCorrect,
                            'score' => $score,
                        ]
                    );

                    $totalScore += $score;
                }

                if ($activity->grading_method === 'auto') {
                    $hasManualTypes = $activity->questions->contains(fn($q) => in_array($q->type, ['essay', 'coding']));
                    $submission->update([
                        'score' => $totalScore,
                        'status' => $hasManualTypes ? 'submitted' : 'graded',
                        'graded_at' => $hasManualTypes ? null : now(),
                    ]);
                }
            }

            if ($activity->submission_type === 'file') {
                $submission->update([
                    'status' => 'submitted',
                    'submitted_at' => now(),
                ]);
            }

            $submission->load('answers.question');
            return response()->json($submission);
        });
    }

    public function unsubmit($id)
    {
        $activity = ClassActivity::findOrFail($id);
        $this->checkEnrollment($activity->class_id);

        if ($activity->deadline_at && now()->gt($activity->deadline_at) && $activity->deadline_behavior === 'hard') {
            return response()->json(['message' => 'Deadline has passed'], 422);
        }

        $submission = ActivitySubmission::where('activity_id', $activity->id)
            ->where('student_id', auth()->id())
            ->first();

        if (!$submission || $submission->status === 'draft') {
            return response()->json(['message' => 'No submission to unsubmit'], 422);
        }

        $submission->update([
            'status' => 'draft',
            'submitted_at' => null,
            'score' => null,
            'max_score' => null,
            'graded_at' => null,
            'graded_by' => null,
        ]);

        return response()->json(['message' => 'Submission unsubmitted']);
    }

    public function uploadFile(Request $request, $id)
    {
        $activity = ClassActivity::findOrFail($id);
        $this->checkEnrollment($activity->class_id);

        if ($activity->submission_type !== 'file') {
            return response()->json(['message' => 'Not a file submission activity'], 422);
        }

        if ($activity->deadline_at && now()->gt($activity->deadline_at) && $activity->deadline_behavior === 'hard') {
            return response()->json(['message' => 'Deadline has passed'], 422);
        }

        $request->validate([
            'file' => 'required|file|max:51200',
        ]);

        $file = $request->file('file');

        $cloudName = env('CLOUDINARY_CLOUD_NAME');
        $apiKey = env('CLOUDINARY_API_KEY');
        $apiSecret = env('CLOUDINARY_API_SECRET');

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
            'folder' => 'instructai/student-submissions/'.$id,
            'resource_type' => 'auto',
            'public_id' => $originalName.'_'.time().'_'.auth()->id(),
        ]);

        $submission = ActivitySubmission::firstOrNew([
            'activity_id' => $id,
            'student_id' => auth()->id(),
        ]);

        if ($submission->exists && in_array($submission->status, ['submitted', 'graded'])) {
            $submission->update([
                'status' => 'draft',
                'score' => null,
                'graded_at' => null,
                'graded_by' => null,
            ]);
        }

        if (! $submission->exists) {
            $submission->fill([
                'status' => 'draft',
                'max_score' => $activity->max_points,
            ]);
        }

        $attachments = $submission->attachments ?? [];
        $attachments[] = [
            'name' => $file->getClientOriginalName(),
            'url' => $result['secure_url'],
            'size' => $file->getSize(),
            'public_id' => $result['public_id'],
        ];

        $submission->attachments = $attachments;
        $submission->save();

        return response()->json($attachments);
    }

    public function removeFile(Request $request, $id)
    {
        $activity = ClassActivity::findOrFail($id);
        $this->checkEnrollment($activity->class_id);

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
            \Log::warning('Cloudinary delete failed: '.$e->getMessage());
        }

        $submission = ActivitySubmission::where('activity_id', $id)
            ->where('student_id', auth()->id())
            ->firstOrFail();

        $attachments = array_values(array_filter($submission->attachments ?? [], fn($f) => ($f['public_id'] ?? '') !== $publicId));
        $submission->update(['attachments' => $attachments]);

        return response()->json($attachments);
    }
}
