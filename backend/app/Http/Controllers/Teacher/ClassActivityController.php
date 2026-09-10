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
use App\Support\ActivityGrading;
use App\Support\CodeRunner;
use App\Support\CodeSimilarity;
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

    /**
     * A whole-quiz timer without minutes yields a zero-second limit, which
     * instantly expires every submission. Block it wherever a quiz can be
     * created, edited, published, or launched.
     */
    private function entireQuizTimerError(?ClassActivity $activity, array $validated = []): ?string
    {
        if ($activity ? $activity->activity_type !== 'quiz' : ($validated['activity_type'] ?? 'quiz') !== 'quiz') {
            return null;
        }

        $timerMode = $validated['timer_mode'] ?? ($activity->timer_mode ?? 'none');
        $minutes = array_key_exists('time_limit_minutes', $validated)
            ? $validated['time_limit_minutes']
            : ($activity->time_limit_minutes ?? null);

        if ($timerMode === 'entire_quiz' && (! $minutes || (int) $minutes < 1)) {
            return 'Set the minutes for the whole-quiz timer before publishing';
        }

        return null;
    }

    private function quizQuestionsError(ClassActivity $activity): ?string
    {
        if ($activity->activity_type === 'quiz' && $activity->questions()->count() === 0) {
            return 'Add at least one question before publishing the quiz';
        }

        return null;
    }

    public function index($classId)
    {
        $this->authorizeTeacher($classId);

        $activities = ClassActivity::where('class_id', $classId)
            ->withCount(['submissions', 'questions'])
            ->orderBy('order_index', 'asc')
            ->get();

        $enrolledCount = Enrollment::where('class_id', $classId)->count();
        $activities->each->setAttribute('enrolled_count', $enrolledCount);

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
            'max_points' => 'nullable|numeric|min:0|max:99999',
            'deadline_behavior' => 'nullable|string|in:hard,soft',
            'late_submission' => 'nullable|boolean',
            'late_penalty_pct' => 'nullable|numeric|min:0|max:100',
            'time_limit_minutes' => 'nullable|numeric|min:0|max:300',
            'pacing_mode' => 'nullable|string|in:student,teacher',
            'timer_mode' => 'nullable|string|in:none,entire_quiz,per_question',
            'per_question_durations' => 'nullable|array|max:10',
            'per_question_durations.*' => 'nullable|integer|min:5|max:900',
            'shuffle_questions' => 'nullable|boolean',
            'show_results' => 'nullable|string|in:immediate,room_close',
        ];

        if ($request->activity_type === 'activity') {
            $rules['submission_type'] = 'required|string|in:file,questions,material';
            $rules['deadline_at'] = $request->submission_type === 'material' ? 'nullable|date' : 'required|date';
        } else {
            // D1: quizzes are live-only — no deadlines
            $rules['deadline_at'] = 'nullable|date';
        }

        $validated = $request->validate($rules);

        if ($error = $this->entireQuizTimerError(null, $validated)) {
            return response()->json(['message' => $error], 422);
        }

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
            'deadline_at' => $validated['activity_type'] === 'quiz' ? null : ($validated['deadline_at'] ?? null),
            'deadline_behavior' => $validated['deadline_behavior'] ?? 'hard',
            'late_submission' => $validated['late_submission'] ?? false,
            'late_penalty_pct' => $validated['late_penalty_pct'] ?? null,
            'time_limit_minutes' => $validated['time_limit_minutes'] ?? null,
            'pacing_mode' => $validated['pacing_mode'] ?? 'student',
            'timer_mode' => ($validated['pacing_mode'] ?? 'student') === 'teacher'
                ? 'none'
                : ($validated['timer_mode'] ?? 'none'),
            'per_question_durations' => $validated['per_question_durations'] ?? null,
            'shuffle_questions' => ($validated['pacing_mode'] ?? 'student') === 'teacher'
                ? false
                : ($validated['shuffle_questions'] ?? false),
            'show_results' => $validated['show_results'] ?? 'room_close',
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
            'max_points' => 'sometimes|nullable|numeric|min:0|max:99999',
            'deadline_at' => 'sometimes|nullable|date',
            'deadline_behavior' => 'sometimes|string|in:hard,soft',
            'late_submission' => 'sometimes|boolean',
            'late_penalty_pct' => 'sometimes|nullable|numeric|min:0|max:100',
            'time_limit_minutes' => 'sometimes|nullable|numeric|min:0|max:300',
            'is_published' => 'sometimes|boolean',
            'is_live' => 'sometimes|boolean',
            'live_status' => 'sometimes|string|in:scheduled,active,paused,completed',
            'live_scheduled_at' => 'sometimes|nullable|date',
            'pacing_mode' => 'sometimes|string|in:student,teacher',
            'timer_mode' => 'sometimes|string|in:none,entire_quiz,per_question',
            'per_question_durations' => 'sometimes|nullable|array|max:10',
            'per_question_durations.*' => 'nullable|integer|min:5|max:900',
            'shuffle_questions' => 'sometimes|boolean',
            'show_results' => 'sometimes|string|in:immediate,room_close',
        ]);

        if ($activity->activity_type === 'quiz') {
            // D1: quizzes are live-only — deadlines are an activity concept
            $validated['deadline_at'] = null;
            unset($validated['deadline_behavior'], $validated['late_submission'], $validated['late_penalty_pct']);

            // Lock quiz settings while the room is live
            if ($activity->is_live) {
                $quizSettings = ['pacing_mode', 'timer_mode', 'per_question_durations', 'shuffle_questions', 'show_results', 'time_limit_minutes'];
                $validated = array_diff_key($validated, array_flip($quizSettings));
            }

            // Teacher-paced quizzes have no whole-quiz clock — the teacher controls pace
            $effectivePacing = $validated['pacing_mode'] ?? $activity->pacing_mode;
            if ($effectivePacing === 'teacher' && ($validated['timer_mode'] ?? $activity->timer_mode) === 'entire_quiz') {
                return response()->json(['message' => 'Teacher-paced quizzes cannot use a whole-quiz timer'], 422);
            }

            // A whole-quiz timer with no minutes expires every submission instantly
            if ($error = $this->entireQuizTimerError($activity, $validated)) {
                return response()->json(['message' => $error], 422);
            }

            // Shuffle defeats teacher pacing (the teacher reads questions in order)
            if ($effectivePacing === 'teacher' && array_key_exists('shuffle_questions', $validated)) {
                $validated['shuffle_questions'] = false;
            }
        }

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
                        try {
                            $uploadApi->destroy($file['public_id']);
                        } catch (\Exception $e) {
                            \Log::warning('Cloudinary cleanup: '.$e->getMessage());
                        }
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

        if (! $activity->is_published) {
            // Guardrails so a broken quiz can never reach students
            if ($error = $this->quizQuestionsError($activity)) {
                return response()->json(['message' => $error], 422);
            }
            if ($error = $this->entireQuizTimerError($activity)) {
                return response()->json(['message' => $error], 422);
            }
        }

        $activity->update(['is_published' => ! $activity->is_published]);

        return response()->json($activity);
    }

    /**
     * Post a copy of this activity into another class the teacher owns.
     * Content (title, settings, questions, test cases) is duplicated; live
     * state and student submissions stay with the original.
     */
    public function repost(Request $request, $id)
    {
        $activity = $this->authorizeActivity($id);

        $validated = $request->validate([
            'class_id' => 'required|integer',
        ]);

        if ((int) $validated['class_id'] === (int) $activity->class_id) {
            return response()->json(['message' => 'This activity is already posted in that class'], 422);
        }

        $targetClass = $this->authorizeTeacher($validated['class_id']);

        $clone = DB::transaction(function () use ($activity, $targetClass) {
            $copy = $activity->replicate();
            $copy->class_id = $targetClass->id;
            $copy->teacher_id = auth()->id();
            $copy->is_published = false;
            $copy->is_live = false;
            $copy->live_status = 'scheduled';
            $copy->live_scheduled_at = null;
            $copy->live_started_at = null;
            $copy->live_paused_at = null;
            $copy->live_current_q = 0;
            $copy->live_question_deadline_at = null;
            $copy->live_question_revealed_at = null;
            $copy->close_room_at = null;
            $copy->order_index = (ClassActivity::where('class_id', $targetClass->id)->max('order_index') ?? 0) + 1;
            // Instruction files live on Cloudinary under the original — a clone
            // would dangle once the original (and its uploads) are deleted.
            $copy->instruction_files = [];
            $copy->save();

            foreach ($activity->questions()->with('testCases')->get() as $question) {
                $questionCopy = $question->replicate();
                $questionCopy->activity_id = $copy->id;
                $questionCopy->save();

                foreach ($question->testCases as $testCase) {
                    $caseCopy = $testCase->replicate();
                    $caseCopy->testable_type = ActivityQuestion::class;
                    $caseCopy->testable_id = $questionCopy->id;
                    $caseCopy->save();
                }
            }

            return $copy;
        });

        return response()->json([
            'message' => "Posted to {$targetClass->name} as a draft — review and publish it there",
            'activity' => $clone->fresh(['questions']),
        ], 201);
    }

    // ── Live quiz room (student-paced) ──

    public function startLive($id)
    {
        $activity = $this->authorizeActivity($id);

        if ($activity->activity_type !== 'quiz') {
            return response()->json(['message' => 'Only quizzes can go live'], 422);
        }

        if (! $activity->is_published) {
            return response()->json(['message' => 'Publish the quiz before starting the room'], 422);
        }

        if ($error = $this->entireQuizTimerError($activity)) {
            return response()->json(['message' => $error], 422);
        }

        $activity->update([
            'is_live' => true,
            'live_status' => 'active',
            'live_started_at' => now(),
            'live_paused_at' => null,
            'close_room_at' => null,
            'live_current_q' => -1,
            'live_question_deadline_at' => null,
            'live_question_revealed_at' => null,
        ]);

        return response()->json([
            'message' => 'Quiz is now live',
            'activity' => $activity->fresh(),
        ]);
    }

    public function pauseLive($id)
    {
        $activity = $this->authorizeActivity($id);

        if (! $activity->is_live || $activity->live_status !== 'active') {
            return response()->json(['message' => 'Quiz is not live'], 422);
        }

        $activity->update([
            'live_status' => 'paused',
            'live_paused_at' => now(),
        ]);

        return response()->json([
            'message' => 'Quiz paused',
            'activity' => $activity->fresh(),
        ]);
    }

    public function resumeLive($id)
    {
        $activity = $this->authorizeActivity($id);

        if (! $activity->is_live || $activity->live_status !== 'paused') {
            return response()->json(['message' => 'Quiz is not paused'], 422);
        }

        $pausedSeconds = $activity->live_paused_at
            ? max(0, (int) $activity->live_paused_at->diffInSeconds(now()))
            : 0;

        $updates = [
            'live_status' => 'active',
            'live_paused_at' => null,
        ];

        // The current question's countdown continues where it paused instead of
        // silently expiring during the pause.
        if ($pausedSeconds > 0
            && $activity->live_question_deadline_at
            && ! $activity->live_question_revealed_at) {
            $updates['live_question_deadline_at'] =
                $activity->live_question_deadline_at->copy()->addSeconds($pausedSeconds);
        }

        $activity->update($updates);

        // Whole-quiz timers run off started_at, so shift every running
        // submission forward by the pause length — nobody loses time while
        // the room was paused.
        if ($pausedSeconds > 0 && $activity->timer_mode === 'entire_quiz') {
            ActivitySubmission::where('activity_id', $activity->id)
                ->where('status', 'draft')
                ->whereNotNull('started_at')
                ->get()
                ->each(fn (ActivitySubmission $s) => $s->update([
                    'started_at' => $s->started_at->copy()->addSeconds($pausedSeconds),
                ]));
        }

        return response()->json([
            'message' => 'Quiz resumed',
            'activity' => $activity->fresh(),
        ]);
    }

    public function endLive($id)
    {
        $activity = $this->authorizeActivity($id);

        $result = DB::transaction(function () use ($activity) {
            if (! $activity->is_live) {
                return ['finalized' => 0, 'missed' => 0];
            }

            $now = now();
            $submissions = ActivitySubmission::where('activity_id', $activity->id)
                ->where('status', 'draft')
                ->get();

            $finalized = 0;
            $missed = 0;

            foreach ($submissions as $submission) {
                if ($submission->started_at) {
                    ActivityGrading::finalizeSubmission($submission, $activity, $now->toDateTimeString());
                    $finalized++;
                } else {
                    $submission->update([
                        'status' => 'missed',
                        'submitted_at' => $now,
                        'room_closed_at' => $now,
                    ]);
                    $missed++;
                }
            }

            $activity->update([
                'is_live' => false,
                'live_status' => 'completed',
                'close_room_at' => $now,
                'live_question_deadline_at' => null,
                'live_question_revealed_at' => null,
            ]);

            return ['finalized' => $finalized, 'missed' => $missed];
        });

        return response()->json([
            'message' => 'Quiz ended',
            'finalized' => $result['finalized'],
            'missed' => $result['missed'],
        ]);
    }

    // ── Live room board (student-paced) ──

    private function liveRoster(ClassActivity $activity, bool $withProgress = false): array
    {
        $submissions = ActivitySubmission::with('answers')
            ->where('activity_id', $activity->id)
            ->get()
            ->keyBy('student_id');

        $questionIds = $activity->questions->pluck('id')->all();
        $now = now();

        $enrolled = Enrollment::where('class_id', $activity->class_id)
            ->with('student.studentProfile')
            ->get()
            ->map(function ($e) use ($activity, $submissions, $questionIds, $now, $withProgress) {
                $s = $submissions->get($e->student_id);

                if (! $s) {
                    $row = [
                        'student' => $e->student,
                        'submission_id' => null,
                        'status' => 'absent',
                        'current_question_idx' => 0,
                        'started_at' => null,
                        'last_seen_at' => null,
                        'submitted_at' => null,
                        'idle_seconds' => null,
                        'answers_count' => 0,
                        'score' => null,
                        'running_score' => 0.0,
                        'max_score' => null,
                    ];
                } else {
                    $finalized = in_array($s->status, ['submitted', 'graded', 'missed']);
                    $taking = ! $finalized && $s->started_at;
                    $lastSeen = $s->last_seen_at;

                    if ($finalized) {
                        $status = 'submitted';
                    } elseif ($taking) {
                        $status = $lastSeen && $lastSeen->diffInSeconds($now) > 15 ? 'disconnected' : 'taking';
                    } else {
                        $status = 'joined';
                    }

                    $row = [
                        'student' => $e->student,
                        'submission_id' => $s->id,
                        'status' => $status,
                        'current_question_idx' => (int) $s->current_question_idx,
                        'started_at' => $s->started_at,
                        'last_seen_at' => $s->last_seen_at,
                        'submitted_at' => $s->submitted_at,
                        'idle_seconds' => $taking && $lastSeen ? $lastSeen->diffInSeconds($now) : null,
                        'answers_count' => $s->answers->count(),
                        'score' => $s->score !== null ? (float) $s->score : null,
                        'running_score' => $s->answers->sum(fn ($a) => $a->is_correct !== null ? (float) $a->score : 0.0),
                        'max_score' => $s->max_score !== null ? (float) $s->max_score : null,
                    ];
                }

                if ($withProgress) {
                    $order = $s?->question_order ?? $questionIds;
                    $answeredIds = $s ? $s->answers->pluck('question_id')->all() : [];
                    $row['question_order'] = $order;
                    $row['questions'] = collect($order)
                        ->map(function ($qid) use ($activity, $answeredIds, $s) {
                            $q = $activity->questions->firstWhere('id', $qid);

                            return $q ? [
                                'id' => $q->id,
                                'order_index' => $q->order_index,
                                'type' => $q->type,
                                'points' => $q->points,
                                'answered' => in_array($q->id, $answeredIds),
                                'is_current' => $s && (int) $s->current_question_idx === array_search($q->id, array_values($s->question_order ?? []), true) && ! in_array($s->status, ['submitted', 'graded', 'missed']),
                            ] : null;
                        })
                        ->filter()
                        ->values()
                        ->all();
                }

                return $row;
            });

        $rows = $enrolled->values()->all();
        $counts = ['enrolled' => count($rows), 'absent' => 0, 'joined' => 0, 'taking' => 0, 'disconnected' => 0, 'submitted' => 0];

        foreach ($rows as $row) {
            $counts[$row['status']]++;
        }

        $activity->unsetRelation('questions');

        return ['activity' => $activity, 'counts' => $counts, 'students' => $rows];
    }

    public function liveBoard($id)
    {
        $activity = $this->authorizeActivity($id);
        $this->syncExpiredQuestion($activity);

        $board = $this->liveRoster($activity);

        $phase = 'waiting';
        if (! $activity->is_live || $activity->live_status === 'completed') {
            $phase = 'complete';
        } elseif ($activity->live_status === 'paused') {
            $phase = 'paused';
        } elseif ($activity->live_question_revealed_at) {
            $phase = 'revealed';
        } elseif ((int) $activity->live_current_q >= 0 && $activity->questions->count() > (int) $activity->live_current_q) {
            $phase = 'question';
        }

        $board['pacing'] = [
            'mode' => $activity->pacing_mode,
            'current_q' => (int) $activity->live_current_q,
            'revealed_at' => $activity->live_question_revealed_at,
            'deadline_at' => $activity->live_question_deadline_at,
            'phase' => $phase,
        ];

        $board['questions'] = $activity->questions->map(fn ($q) => $q->toArray())->all();

        $answers = ActivityAnswer::whereIn('question_id', $activity->questions->pluck('id'))
            ->get(['question_id', 'submitted_answer'])
            ->groupBy('question_id');

        $board['distribution'] = $activity->questions->map(function ($q) use ($answers) {
            $rows = $answers->get($q->id, collect());

            $perOption = $rows->countBy(fn ($a) => (string) $a->submitted_answer)->all();

            // MC answers are stored as option indexes — relabel chips with option text
            // so the board reads "56: 1" instead of "1: 1".
            if ($q->type === 'multiple_choice' && is_array($q->options)) {
                $perOption = collect($perOption)->mapWithKeys(function ($count, $key) use ($q) {
                    $label = is_numeric($key) && isset($q->options[(int) $key])
                        ? (string) $q->options[(int) $key]
                        : $key;

                    return [$label => $count];
                })->all();
            }

            return [
                'question_id' => $q->id,
                'answered' => $rows->count(),
                'per_option' => $perOption,
            ];
        })->all();

        return response()->json($board);
    }

    // ── Live room teacher-paced controls ──

    private function syncExpiredQuestion(ClassActivity $activity): void
    {
        if (! $activity->is_live || $activity->live_status !== 'active') {
            return;
        }

        if ($activity->live_question_deadline_at
            && ! $activity->live_question_revealed_at
            && $activity->live_question_deadline_at->isPast()) {
            $activity->update([
                'live_question_revealed_at' => now(),
                'live_question_deadline_at' => null,
            ]);
        }
    }

    private function perQuestionSeconds(ClassActivity $activity, ?int $questionId, ?int $override): ?int
    {
        if ($override !== null) {
            return $override;
        }

        if ($activity->timer_mode !== 'per_question') {
            return null;
        }

        $question = $activity->questions->firstWhere('id', $questionId);
        if (! $question) {
            return null;
        }

        $durations = $activity->per_question_durations ?? [];

        return isset($durations[$question->type]) ? (int) $durations[$question->type] : null;
    }

    public function setLiveQuestion(Request $request, $id)
    {
        $activity = $this->authorizeActivity($id);

        if ($activity->activity_type !== 'quiz') {
            return response()->json(['message' => 'Only quizzes can go live'], 422);
        }

        if (! $activity->is_live || $activity->live_status !== 'active') {
            return response()->json(['message' => 'Quiz is not live'], 422);
        }

        $validated = $request->validate([
            'idx' => 'required|integer|min:0',
            'duration' => 'sometimes|nullable|integer|min:5|max:900',
        ]);

        $idx = (int) $validated['idx'];
        $questionCount = $activity->questions->count();

        if ($idx >= $questionCount) {
            return response()->json(['message' => 'Question index out of range'], 422);
        }

        $question = $activity->questions->get($idx);
        $seconds = $this->perQuestionSeconds($activity, $question?->id, isset($validated['duration']) ? (int) $validated['duration'] : null);

        $activity->update([
            'live_current_q' => $idx,
            'live_question_revealed_at' => null,
            'live_question_deadline_at' => $seconds !== null ? now()->addSeconds($seconds) : null,
        ]);

        return response()->json([
            'message' => $question ? 'Question '.($idx + 1).' is now live' : 'Question is now live',
            'activity' => $activity->fresh(),
        ]);
    }

    public function revealLiveQuestion($id)
    {
        $activity = $this->authorizeActivity($id);

        if (! $activity->is_live || $activity->live_status !== 'active') {
            return response()->json(['message' => 'Quiz is not live'], 422);
        }

        if ($activity->live_question_revealed_at) {
            return response()->json(['message' => 'Question already revealed'], 422);
        }

        $current = $activity->questions->get($activity->live_current_q);

        if (! $current) {
            return response()->json(['message' => 'No question is open'], 422);
        }

        DB::transaction(function () use ($activity, $current) {
            $activity->update([
                'live_question_revealed_at' => now(),
                'live_question_deadline_at' => null,
            ]);

            $answers = ActivityAnswer::where('question_id', $current->id)
                ->whereIn('submission_id', ActivitySubmission::where('activity_id', $activity->id)->select('id'))
                ->get();

            foreach ($answers as $answer) {
                $raw = json_decode($answer->submitted_answer, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $raw = $answer->submitted_answer;
                }

                $result = ActivityGrading::grade($current, $raw);
                $answer->update([
                    'is_correct' => $result['is_correct'],
                    'score' => $result['score'],
                ]);
            }
        });

        return response()->json(['message' => 'Answers revealed']);
    }

    public function liveProgress($id)
    {
        $activity = $this->authorizeActivity($id);

        return response()->json($this->liveRoster($activity, true));
    }

    /**
     * Live code monitoring: the current draft each student has typed for a
     * coding question (defaults to the live current question in a teacher-
     * paced room). Lets the teacher spot who's stuck mid-class.
     */
    public function liveDrafts(Request $request, $id)
    {
        $activity = $this->authorizeActivity($id);

        if ($activity->activity_type !== 'quiz') {
            return response()->json(['message' => 'Live code is only available for quiz activities'], 422);
        }

        $activity->load(['questions' => fn ($q) => $q->orderBy('order_index')->with('testCases')]);

        $question = null;
        if ($request->filled('question_id')) {
            $question = $activity->questions->firstWhere('id', (int) $request->input('question_id'));
        } elseif ($activity->live_current_q !== null) {
            $question = $activity->questions->get((int) $activity->live_current_q);
        } elseif ($activity->questions->isNotEmpty()) {
            $question = $activity->questions->first();
        }

        if (! $question) {
            return response()->json(['message' => 'No question found'], 404);
        }

        if ($question->type !== 'coding') {
            return response()->json(['message' => 'Live code view is only for coding questions'], 422);
        }

        $submissions = ActivitySubmission::where('activity_id', $activity->id)
            ->whereIn('status', ['draft', 'submitted', 'graded'])
            ->with(['student.studentProfile', 'answers'])
            ->get();

        $name = function ($submission) {
            $p = $submission->student->studentProfile;
            if ($p?->first_name || $p?->last_name) {
                return trim(($p->first_name ?? '').' '.($p->last_name ?? ''));
            }

            return $submission->student->email ?? 'Student';
        };

        $drafts = $submissions->map(function ($submission) use ($question, $name) {
            $answer = $submission->answers->firstWhere('question_id', $question->id);

            return [
                'student_id' => $submission->student_id,
                'student_name' => $name($submission),
                'status' => $submission->status,
                'code' => $answer ? (string) ActivityGrading::decodeAnswer($answer->submitted_answer) : null,
                'updated_at' => $answer?->updated_at?->toIso8601String(),
            ];
        })->values();

        return response()->json([
            'question_id' => $question->id,
            'question_text' => $question->question_text,
            'language' => $question->language ?: 'java',
            'drafts' => $drafts,
        ]);
    }

    /**
     * Pairwise similarity of students' coding answers (token Jaccard). Flags
     * suspicious pairs for the teacher — a signal to investigate, not proof.
     */
    public function similarity(Request $request, $id)
    {
        $activity = $this->authorizeActivity($id);
        $threshold = min(1.0, max(0.1, (float) $request->query('threshold', '0.6')));

        $activity->load('questions');
        $codingQuestions = $activity->questions->where('type', 'coding')->values();

        if ($codingQuestions->isEmpty()) {
            return response()->json([
                'pairs' => [],
                'questions_checked' => 0,
                'message' => 'No coding questions in this activity',
            ]);
        }

        $submissions = ActivitySubmission::where('activity_id', $activity->id)
            ->whereIn('status', ['submitted', 'graded'])
            ->with(['student.studentProfile', 'answers'])
            ->get();

        $name = function ($submission) {
            $p = $submission->student->studentProfile;
            if ($p?->first_name || $p?->last_name) {
                return trim(($p->first_name ?? '').' '.($p->last_name ?? ''));
            }

            return $submission->student->email ?? 'Student';
        };

        $pairs = [];
        foreach ($codingQuestions as $question) {
            $answers = [];
            foreach ($submissions as $submission) {
                $answer = $submission->answers->firstWhere('question_id', $question->id);
                if (! $answer) {
                    continue;
                }
                $code = (string) ActivityGrading::decodeAnswer($answer->submitted_answer);
                if (trim($code) === '') {
                    continue;
                }
                $answers[] = ['submission' => $submission, 'code' => $code];
            }

            for ($i = 0; $i < count($answers); $i++) {
                for ($j = $i + 1; $j < count($answers); $j++) {
                    $score = CodeSimilarity::similarity($answers[$i]['code'], $answers[$j]['code']);
                    if ($score >= $threshold) {
                        $pairs[] = [
                            'question_id' => $question->id,
                            'question_text' => $question->question_text,
                            'student_a' => [
                                'id' => $answers[$i]['submission']->student_id,
                                'name' => $name($answers[$i]['submission']),
                            ],
                            'student_b' => [
                                'id' => $answers[$j]['submission']->student_id,
                                'name' => $name($answers[$j]['submission']),
                            ],
                            'similarity' => $score,
                        ];
                    }
                }
            }
        }

        usort($pairs, fn ($a, $b) => $b['similarity'] <=> $a['similarity']);

        return response()->json([
            'pairs' => $pairs,
            'questions_checked' => $codingQuestions->count(),
            'submissions_checked' => $submissions->count(),
            'threshold' => $threshold,
        ]);
    }

    // ── Results analysis ──

    public function resultsAnalysis($id)
    {
        $activity = $this->authorizeActivity($id);
        $activity->load('questions');

        $questions = $activity->questions->sortBy('order_index')->values();
        $questionIds = $questions->pluck('id')->all();

        $submissions = ActivitySubmission::where('activity_id', $id)
            ->with(['student.studentProfile', 'answers'])
            ->get();

        $scored = $submissions->filter(fn ($s) => $s->score !== null && $s->max_score > 0 && $s->status !== 'draft');
        $scoredSubIds = $scored->pluck('id')->all();
        $enrolledCount = Enrollment::where('class_id', $activity->class_id)->count();

        $name = function ($submission) {
            $p = $submission->student->studentProfile;
            if ($p?->first_name || $p?->last_name) {
                return trim(($p->first_name ?? '').' '.($p->last_name ?? ''));
            }

            return $submission->student->name ?? explode('@', $submission->student->email)[0];
        };

        $pctOf = function ($submission) {
            return (int) round(($submission->score / $submission->max_score) * 100);
        };

        $durationOf = function ($submission) {
            if (! $submission->submitted_at || ! $submission->started_at) {
                return null;
            }

            return max(0, abs($submission->submitted_at->diffInSeconds($submission->started_at)));
        };

        // ── Overall stats ──
        $scores = $scored->map($pctOf)->sort()->values();
        $durations = $scored->map($durationOf)->filter(fn ($d) => $d !== null)->values();
        $answeredCount = $scored->sum(fn ($s) => count($s->answers));

        $stats = [
            'enrolled' => $enrolledCount,
            'submitted' => count($scored),
            'participation_rate' => $enrolledCount ? (int) round(count($scored) / $enrolledCount * 100) : 0,
            'avg_score_pct' => count($scores) ? (int) round($scores->avg()) : null,
            'median_score_pct' => count($scores) ? (int) round($scores->median()) : null,
            'pass_rate' => count($scores) ? (int) round($scores->filter(fn ($p) => $p >= 60)->count() / count($scores) * 100) : null,
            'highest_score_pct' => count($scores) ? $scores->last() : null,
            'lowest_score_pct' => count($scores) ? $scores->first() : null,
            'avg_duration_seconds' => count($durations) ? (int) round($durations->avg()) : null,
            'avg_answered_pct' => count($scored) && count($questions) ? (int) round($answeredCount / (count($scored) * count($questions)) * 100) : null,
            'draft_count' => $submissions->filter(fn ($s) => $s->status === 'draft')->count(),
        ];

        // ── Score histogram (bins of 20%) ──
        $binDefs = [
            ['label' => '0-20%', 'min' => 0, 'max' => 20],
            ['label' => '21-40%', 'min' => 21, 'max' => 40],
            ['label' => '41-60%', 'min' => 41, 'max' => 60],
            ['label' => '61-80%', 'min' => 61, 'max' => 80],
            ['label' => '81-100%', 'min' => 81, 'max' => 100],
        ];
        $histogram = collect($binDefs)->map(function ($bin) use ($scores) {
            return [
                'label' => $bin['label'],
                'count' => $scores->filter(fn ($p) => $p >= $bin['min'] && $p <= $bin['max'])->count(),
            ];
        })->values();

        // ── Per-question performance ──
        $perQuestion = [];
        foreach ($questions as $q) {
            $qAnswers = $submissions->flatMap(fn ($s) => $s->answers->where('question_id', $q->id));
            $subsWithAnswer = $qAnswers->pluck('submission_id')->unique()->intersect($scoredSubIds)->count();
            $correct = $qAnswers->filter(fn ($a) => $a->is_correct === true)->count();
            $wrong = $qAnswers->filter(fn ($a) => $a->is_correct === false)->count();
            $pending = $qAnswers->filter(fn ($a) => $a->is_correct === null)->count();
            $blank = count($scoredSubIds) - $subsWithAnswer;
            $attempted = $correct + $wrong;

            $distribution = [];
            if (in_array($q->type, ['multiple_choice', 'true_false']) && is_array($q->options)) {
                foreach ($q->options as $i => $option) {
                    // MC answers are stored as option indexes; true_false answers as
                    // the option text itself — count both representations.
                    $optionText = is_string($option) ? $option : 'Option '.($i + 1);
                    $distribution[] = [
                        'label' => is_string($option) ? mb_substr($option, 0, 40) : $optionText,
                        'count' => $qAnswers->filter(fn ($a) => $a->submitted_answer === (string) $i
                            || $a->submitted_answer === $optionText)->count(),
                    ];
                }
            }

            $perQuestion[] = [
                'id' => $q->id,
                'order' => $q->order_index,
                'type' => $q->type,
                'text' => mb_substr($q->question_text, 0, 110),
                'points' => (float) $q->points,
                'correct' => $correct,
                'wrong' => $wrong,
                'pending' => $pending,
                'blank' => max(0, $blank),
                'attempted' => $attempted,
                'accuracy_pct' => $attempted ? (int) round($correct / $attempted * 100) : null,
                'distribution' => $distribution,
            ];
        }

        // ── Performance by question type ──
        $perType = $questions->groupBy('type')->map(function ($qs) use ($perQuestion) {
            $rows = collect($perQuestion)->whereIn('id', $qs->pluck('id')->all());

            return [
                'type' => $qs->first()->type,
                'count' => $qs->count(),
                'attempted' => $rows->sum('attempted'),
                'correct' => $rows->sum('correct'),
                'accuracy_pct' => $rows->sum('attempted') ? (int) round($rows->sum('correct') / $rows->sum('attempted') * 100) : null,
            ];
        })->values();

        // ── Score vs time scatter ──
        $scatter = $scored->map(fn ($s) => [
            'student' => $name($s),
            'score_pct' => $pctOf($s),
            'duration_seconds' => $durationOf($s),
        ])->values();

        // ── Student ranking ──
        $ranking = $scored->map(fn ($s) => [
            'student' => $name($s),
            'score' => (float) $s->score,
            'max_score' => (float) $s->max_score,
            'score_pct' => $pctOf($s),
            'duration_seconds' => $durationOf($s),
            'submitted_at' => $s->submitted_at?->toIso8601String(),
            'status' => $s->status,
            'answered' => $s->answers->count(),
            'total_questions' => count($questions),
        ])->sortByDesc('score_pct')->values();

        // ── Student × question matrix ──
        $matrix = $scored->map(function ($s) use ($questions, $name, $pctOf) {
            $cells = $questions->map(function ($q) use ($s) {
                $answer = $s->answers->firstWhere('question_id', $q->id);

                if (! $answer) {
                    return ['question_id' => $q->id, 'state' => 'blank'];
                }
                if ($answer->is_correct === true) {
                    return ['question_id' => $q->id, 'state' => 'correct'];
                }
                if ($answer->is_correct === false) {
                    return ['question_id' => $q->id, 'state' => 'wrong'];
                }

                return ['question_id' => $q->id, 'state' => 'pending'];
            })->values();

            return [
                'student' => $name($s),
                'score_pct' => $pctOf($s),
                'cells' => $cells,
            ];
        })->sortByDesc('score_pct')->values();

        // ── Insights ──
        $attemptedQuestions = collect($perQuestion)->filter(fn ($q) => $q['attempted'] > 0);
        $hardest = $attemptedQuestions->sortBy('accuracy_pct')->first();
        $easiest = $attemptedQuestions->sortByDesc('accuracy_pct')->first();

        $insights = [
            'hardest' => $hardest ? ['text' => $hardest['text'], 'accuracy_pct' => $hardest['accuracy_pct'], 'order' => $hardest['order']] : null,
            'easiest' => $easiest ? ['text' => $easiest['text'], 'accuracy_pct' => $easiest['accuracy_pct'], 'order' => $easiest['order']] : null,
            'weak_questions' => $attemptedQuestions->filter(fn ($q) => $q['accuracy_pct'] < 40)->values()->map(fn ($q) => [
                'text' => $q['text'], 'accuracy_pct' => $q['accuracy_pct'], 'order' => $q['order'],
            ])->all(),
            'unanswered_questions' => collect($perQuestion)->filter(fn ($q) => $q['attempted'] === 0 && $q['blank'] > 0)->values()->map(fn ($q) => [
                'text' => $q['text'], 'order' => $q['order'], 'blank' => $q['blank'],
            ])->all(),
            'needs_help' => $ranking->filter(fn ($r) => $r['score_pct'] < 60)->map(fn ($r) => [
                'student' => $r['student'], 'score_pct' => $r['score_pct'],
            ])->all(),
            'not_submitted' => $scored->isEmpty()
                ? Enrollment::where('class_id', $activity->class_id)
                    ->with('student.studentProfile')
                    ->get()
                    ->map(function ($e) use ($name) {
                        return $name($e);
                    })->values()->all()
                : Enrollment::where('class_id', $activity->class_id)
                    ->whereNotIn('student_id', $scored->pluck('student_id'))
                    ->with('student.studentProfile')
                    ->get()
                    ->map(fn ($e) => $name($e))->values()->all(),
        ];

        return response()->json([
            'activity' => [
                'id' => $activity->id,
                'title' => $activity->title,
                'activity_type' => $activity->activity_type,
                'grading_method' => $activity->grading_method,
                'max_points' => $activity->max_points ? (float) $activity->max_points : null,
                'is_published' => $activity->is_published,
                'question_count' => count($questions),
            ],
            'stats' => $stats,
            'histogram' => $histogram,
            'questions' => $perQuestion,
            'types' => $perType,
            'scatter' => $scatter,
            'ranking' => $ranking,
            'matrix' => $matrix,
            'insights' => $insights,
        ]);
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
            'language' => 'nullable|string|in:'.implode(',', CodeRunner::LANGUAGES),
            'points' => 'required|numeric|min:1|max:99999',
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
            'language' => $validated['language'] ?? 'java',
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
            'language' => 'nullable|string|in:'.implode(',', CodeRunner::LANGUAGES),
            'points' => 'sometimes|numeric|min:1|max:99999',
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
            if (! empty($validated['answers'])) {
                $total = 0;
                foreach ($validated['answers'] as $a) {
                    // Questions the student skipped have no answer row — never
                    // let a client-supplied score for them inflate the total.
                    $updated = ActivityAnswer::where('submission_id', $submission->id)
                        ->where('question_id', $a['question_id'])
                        ->update([
                            'score' => $a['score'],
                            'is_correct' => $a['score'] > 0,
                        ]);
                    if ($updated) {
                        $total += $a['score'];
                    }
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

        $students = User::whereHas('enrollments', fn ($q) => $q->where('class_id', $classId))
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
