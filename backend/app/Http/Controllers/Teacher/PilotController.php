<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\ActivitySubmission;
use App\Models\ClassActivity;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Module;
use App\Models\PilotAudit;
use App\Models\PilotMessage;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\StudentProfile;
use App\Services\AiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * EUNA Pilot — the teacher dashboard copilot.
 *
 * prepare() signs the exact payload the browser will POST straight to the
 * Python service's stream endpoint (same HMAC pattern as the student tutor);
 * commit() persists the AI turn + audit rows; lookup() is the allowlisted,
 * teacher-scoped read API the agent's request_data tool hits.
 */
class PilotController extends Controller
{
    private const LOOKUPS = ['search_students', 'get_student_grades', 'list_classes', 'class_summary', 'class_performance'];

    public function prepare(Request $request): JsonResponse
    {
        $request->validate([
            'run_id' => 'required|string|max:64',
            'kind' => 'required|in:start,tool-result,lookup-result',
            'route' => 'nullable|string|max:255',
            'message' => 'required_if:kind,start|nullable|string|max:4000',
            'data' => 'nullable|array',
        ]);

        $teacher = $request->user();
        if (!$teacher || $teacher->role !== 'teacher') {
            return response()->json(['error' => 'Teacher account required'], 403);
        }

        $kind = (string) $request->input('kind');
        $data = (array) $request->input('data', []);
        $runId = (string) $request->input('run_id');

        $classes = Classroom::where('teacher_id', $teacher->id)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name])
            ->all();

        // A dead run leaves its user turn persisted with no AI answer — a
        // dangling request the model would happily "complete" later out of
        // thin air. Trim trailing orphans so history always ends on a paired
        // exchange.
        $history = PilotMessage::where('teacher_id', $teacher->id)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get()
            ->reverse()
            ->values();

        while ($history->isNotEmpty() && $history->last()->sender === 'teacher') {
            $history->pop();
        }

        $history = $history->slice(-16)->values()
            ->map(fn ($m) => ['sender' => $m->sender, 'message' => $m->message])
            ->all();

        $payload = [
            'run_id' => $runId,
            'teacher_id' => $teacher->id,
            'teacher_name' => $teacher->teacherProfile->first_name ?? null,
            'kind' => $kind,
            'route' => (string) $request->input('route'),
            'task' => (string) ($request->input('message') ?: ($data['task'] ?? '')),
            'classes' => $classes,
            'snapshot' => (string) ($data['snapshot'] ?? ''),
            'history' => $history,
            'consent' => (bool) ($data['consent'] ?? false),
            'data' => $data,
        ];

        // Only the teacher's own request enters the thread; intra-run tool
        // traffic lives in the Python turn payloads, not history
        if ($kind === 'start' && trim((string) $payload['task']) !== '') {
            PilotMessage::create([
                'teacher_id' => $teacher->id,
                'run_id' => $runId,
                'route' => $payload['route'],
                'sender' => 'teacher',
                'message' => $payload['task'],
            ]);
        }

        $turnToken = Str::random(40);
        Cache::put("pilot_turn_{$turnToken}", [
            'teacher_id' => $teacher->id,
            'run_id' => $runId,
            'route' => $payload['route'],
        ], 600);

        $payloadJson = json_encode($payload);
        $sign = AiService::signPayload($payloadJson);

        return response()->json([
            'turn_token' => $turnToken,
            'payload_json' => $payloadJson,
            'auth_sig' => $sign['auth_sig'],
            'auth_ts' => $sign['auth_ts'],
        ]);
    }

    public function commit(Request $request): JsonResponse
    {
        $request->validate([
            'turn_token' => 'required|string|size:40',
            'answer' => 'nullable|string',
            'route' => 'nullable|string|max:255',
            'executed_commands' => 'nullable|array|max:60',
            'executed_commands.*.action' => 'required_with:executed_commands|string|max:32',
            'executed_commands.*.message' => 'nullable|string|max:500',
        ]);

        $teacher = $request->user();
        if (!$teacher || $teacher->role !== 'teacher') {
            return response()->json(['error' => 'Teacher account required'], 403);
        }

        $ctx = Cache::pull('pilot_turn_' . $request->input('turn_token'));
        if (!$ctx || ($ctx['teacher_id'] ?? null) !== $teacher->id) {
            return response()->json(['error' => 'Unknown or expired turn token'], 404);
        }

        $answer = trim((string) $request->input('answer'));
        if ($answer !== '') {
            PilotMessage::create([
                'teacher_id' => $teacher->id,
                'run_id' => $ctx['run_id'],
                'route' => $request->input('route') ?: ($ctx['route'] ?? null),
                'sender' => 'ai',
                'message' => $answer,
            ]);
        }

        $route = $request->input('route') ?: ($ctx['route'] ?? null);
        foreach ((array) $request->input('executed_commands', []) as $cmd) {
            if (!is_array($cmd) || empty($cmd['action'])) {
                continue;
            }
            // Whitelist the stored command — never stash client-supplied
            // blobs wholesale in the audit JSON column
            $command = null;
            if (is_array($cmd['command'] ?? null)) {
                $command = collect($cmd['command'])->only(['action', 'ref', 'path', 'value', 'direction', 'risk'])->all();
            }
            PilotAudit::create([
                'teacher_id' => $teacher->id,
                'run_id' => $ctx['run_id'],
                'route' => $route,
                'explain' => isset($cmd['explain']) ? mb_substr((string) $cmd['explain'], 0, 255) : null,
                'action' => mb_substr((string) $cmd['action'], 0, 32),
                'ref' => isset($cmd['ref']) ? (int) $cmd['ref'] : null,
                'ok' => array_key_exists('ok', $cmd) ? (bool) $cmd['ok'] : null,
                'blocked' => array_key_exists('blocked', $cmd) ? (bool) $cmd['blocked'] : null,
                'message' => isset($cmd['message']) ? mb_substr((string) $cmd['message'], 0, 500) : null,
                'command' => $command,
            ]);
        }

        return response()->json(['saved' => true]);
    }

    /**
     * Allowlisted, teacher-scoped reads for the agent's request_data tool.
     * Everything here re-checks ownership server-side — the model never
     * picks what it can see.
     */
    public function lookup(Request $request): JsonResponse
    {
        $request->validate([
            'query' => 'required|string|in:' . implode(',', self::LOOKUPS),
            'params' => 'nullable|array',
        ]);

        $teacher = $request->user();
        if (!$teacher || $teacher->role !== 'teacher') {
            return response()->json(['error' => 'Teacher account required'], 403);
        }

        $query = (string) $request->input('query');
        $params = (array) $request->input('params', []);

        try {
            $result = match ($query) {
                'list_classes' => $this->listClasses($teacher->id),
                'class_summary' => $this->classSummary($teacher->id, $params),
                'class_performance' => $this->classPerformance($teacher->id, $params),
                'search_students' => $this->searchStudents($teacher->id, $params),
                'get_student_grades' => $this->studentGrades($teacher->id, $params),
                default => ['error' => 'unknown query'],
            };
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json(['query' => $query, 'result' => $result]);
    }

    private function ownedClass(int $teacherId, array $params): Classroom
    {
        $classId = (int) ($params['class_id'] ?? 0);
        if ($classId > 0) {
            $class = Classroom::where('teacher_id', $teacherId)->find($classId);
            if (!$class) {
                throw new \InvalidArgumentException($this->classesHint(
                    $teacherId,
                    "no class with id {$classId} belongs to this teacher — re-check the id from the classes list"
                ));
            }
            return $class;
        }

        // Name-based resolution — a stale or guessed numeric id produced the
        // "class ID didn't match" flail; the model usually HAS the name.
        $name = trim((string) ($params['class_name'] ?? ''));
        if ($name !== '') {
            $classes = Classroom::where('teacher_id', $teacherId)->orderBy('name')->get(['id', 'name']);
            $exact = $classes->filter(fn ($c) => strcasecmp($c->name, $name) === 0)->values();
            if ($exact->count() === 1) {
                return $exact->first();
            }
            if ($exact->count() > 1) {
                throw new \InvalidArgumentException(
                    "several classes are named \"{$name}\" — ask the teacher which one (their ids: " . $exact->pluck('id')->implode(', ') . ")"
                );
            }
            $like = $classes->filter(fn ($c) => str_contains(mb_strtolower($c->name), mb_strtolower($name)))->values();
            if ($like->count() === 1) {
                return $like->first();
            }
            if ($like->count() > 1) {
                throw new \InvalidArgumentException(
                    "several classes match \"{$name}\" — ask the teacher which one: " . $like->pluck('name')->implode(', ')
                );
            }
            throw new \InvalidArgumentException($this->classesHint($teacherId, "no class resembling \"{$name}\""));
        }

        throw new \InvalidArgumentException($this->classesHint($teacherId, 'no class was given — ask which class'));
    }

    /** Error messages teach the model what IS true (the real class names) so
     *  it can recover in one turn instead of flailing about ids. */
    private function classesHint(int $teacherId, string $prefix): string
    {
        $names = Classroom::where('teacher_id', $teacherId)->orderBy('name')->pluck('name')->implode(', ');
        return $prefix . ". This teacher's classes: " . ($names !== '' ? $names : '(none yet)');
    }

    private function listClasses(int $teacherId): array
    {
        // Counts ride along so "summarize my classes" is answerable in ONE
        // lookup instead of one class_summary round-trip per class
        $ungradedByClass = ActivitySubmission::query()
            ->join('class_activities', 'class_activities.id', '=', 'activity_submissions.activity_id')
            ->where('class_activities.teacher_id', $teacherId)
            ->where('activity_submissions.status', 'submitted')
            ->whereNull('class_activities.deleted_at')
            ->groupBy('class_activities.class_id')
            ->selectRaw('class_activities.class_id, COUNT(*) as c')
            ->pluck('c', 'class_activities.class_id');

        return Classroom::where('teacher_id', $teacherId)
            ->orderBy('name')
            ->withCount(['students', 'activities'])
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'class_code' => $c->class_code,
                'description' => $c->description,
                'students_count' => $c->students_count,
                'activities_count' => $c->activities_count,
                'ungraded_submissions' => (int) ($ungradedByClass[$c->id] ?? 0),
            ])
            ->all();
    }

    private function classSummary(int $teacherId, array $params): array
    {
        $class = $this->ownedClass($teacherId, $params);
        $activityIds = ClassActivity::where('class_id', $class->id)->pluck('id');

        return [
            'class' => ['id' => $class->id, 'name' => $class->name],
            'students' => Enrollment::where('class_id', $class->id)->count(),
            'activities' => $activityIds->count(),
            'ungraded_submissions' => ActivitySubmission::whereIn('activity_id', $activityIds)
                ->where('status', 'submitted')
                ->count(),
        ];
    }

    /** Ranked student performance per class — the answer to "who's my best
     *  performing student". Averages each student's percentage across every
     *  graded item (activity submissions + quiz attempts). Scoped to one
     *  class when params name it, else every class in one call. The Progress
     *  page's charts are canvas — snapshots can't read them, so THIS is the
     *  only way the agent can answer ranking questions. */
    private function classPerformance(int $teacherId, array $params): array
    {
        if (!empty($params['class_id']) || !empty($params['class_name'])) {
            $classes = collect([$this->ownedClass($teacherId, $params)]);
        } else {
            $classes = Classroom::where('teacher_id', $teacherId)->orderBy('name')->get(['id', 'name']);
        }

        $results = $classes->map(function ($class) {
            $studentIds = Enrollment::where('class_id', $class->id)->pluck('student_id');
            if ($studentIds->isEmpty()) {
                return ['class' => $class->name, 'enrolled' => 0, 'note' => 'no students enrolled yet', 'ranked' => []];
            }

            // Every graded item becomes one (student, pct) row
            $scores = collect();

            $maxByActivity = ClassActivity::where('class_id', $class->id)->pluck('max_points', 'id');
            if ($maxByActivity->isNotEmpty()) {
                ActivitySubmission::whereIn('activity_id', $maxByActivity->keys())
                    ->whereIn('student_id', $studentIds)
                    ->whereNotNull('score')
                    ->get(['student_id', 'score', 'activity_id'])
                    ->each(function ($s) use ($scores, $maxByActivity) {
                        $max = (float) $maxByActivity[$s->activity_id];
                        if ($max > 0) {
                            $scores->push(['student_id' => $s->student_id, 'pct' => $s->score / $max]);
                        }
                    });
            }

            $quizIds = Quiz::whereIn(
                'module_id',
                Module::whereIn('course_id', Course::where('class_id', $class->id)->pluck('id'))->pluck('id')
            )->pluck('id');
            if ($quizIds->isNotEmpty()) {
                // Each attempt stamps the max it was scored out of — no
                // separate quiz-level column exists
                QuizAttempt::whereIn('quiz_id', $quizIds)
                    ->whereIn('student_id', $studentIds)
                    ->where('status', 'completed')
                    ->get(['student_id', 'total_score', 'max_score'])
                    ->each(function ($q) use ($scores) {
                        $max = (float) $q->max_score;
                        if ($max > 0) {
                            $scores->push(['student_id' => $q->student_id, 'pct' => $q->total_score / $max]);
                        }
                    });
            }

            if ($scores->isEmpty()) {
                return ['class' => $class->name, 'enrolled' => $studentIds->count(), 'note' => 'no graded work yet — nothing to rank', 'ranked' => []];
            }

            $byStudent = $scores->groupBy('student_id')->map(fn ($rows) => [
                'avg_pct' => round($rows->avg('pct') * 100, 1),
                'graded_items' => $rows->count(),
            ]);

            $profiles = StudentProfile::whereIn('user_id', $byStudent->keys())
                ->get()
                ->map(fn ($p) => ['student_id' => $p->user_id, 'name' => trim($p->first_name . ' ' . $p->last_name)])
                ->keyBy('student_id');

            return [
                'class' => $class->name,
                'enrolled' => $studentIds->count(),
                'ranked' => $byStudent
                    ->map(fn ($agg, $sid) => [
                        'name' => $profiles[$sid]['name'] ?? 'a student',
                        'avg_pct' => $agg['avg_pct'],
                        'graded_items' => $agg['graded_items'],
                    ])
                    ->sortByDesc('avg_pct')
                    ->values()
                    ->all(),
            ];
        })->values()->all();

        return ['classes' => $results];
    }

    private function searchStudents(int $teacherId, array $params): array
    {
        $class = $this->ownedClass($teacherId, $params);
        $name = trim((string) ($params['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('no student name was given — ask who to search for');
        }

        return $this->rosterMatches($class->id, $name);
    }

    /** Case-insensitive name search inside one class's roster — shared by
     *  search_students and get_student_grades' name resolution. */
    private function rosterMatches(int $classId, string $name): array
    {
        $studentIds = Enrollment::where('class_id', $classId)->pluck('student_id');

        return StudentProfile::whereIn('user_id', $studentIds)
            ->whereRaw("CONCAT(COALESCE(first_name,''),' ',COALESCE(last_name,'')) LIKE ?", ['%' . $name . '%'])
            ->limit(10)
            ->get()
            ->map(fn ($p) => [
                'student_id' => $p->user_id,
                'name' => trim($p->first_name . ' ' . $p->last_name),
                'lrn' => $p->lrn_number,
            ])
            ->values()
            ->all();
    }

    /** A few real roster names for error hints — enough for the model to
     *  recover ("did you mean one of these?") without dumping the class. */
    private function rosterSample(int $classId): string
    {
        $names = collect($this->rosterMatches($classId, ''))
            ->pluck('name')
            ->filter()
            ->take(4)
            ->implode(', ');
        return $names !== '' ? $names : '(roster names unavailable)';
    }

    private function studentGrades(int $teacherId, array $params): array
    {
        $class = $this->ownedClass($teacherId, $params);

        // Resolve the student: an id when the model has one, else a name
        // search inside this class's roster — "which student" should never
        // require the model to already hold a numeric key. Several matches
        // come back as a choice list (not an error) so the model can ask.
        $studentId = (int) ($params['student_id'] ?? 0);
        $studentName = trim((string) ($params['student_name'] ?? $params['name'] ?? ''));
        if ($studentId <= 0 && $studentName !== '') {
            $matches = $this->rosterMatches($class->id, $studentName);
            if (count($matches) > 1) {
                return [
                    'note' => "Several students in {$class->name} match \"{$studentName}\" — ask the teacher which one before pulling grades.",
                    'class' => $class->name,
                    'matches' => array_map(fn ($m) => ['name' => $m['name']], $matches),
                ];
            }
            if (count($matches) === 1) {
                $studentId = (int) $matches[0]['student_id'];
            }
        }

        $enrolled = $studentId > 0 && Enrollment::where('class_id', $class->id)
            ->where('student_id', $studentId)
            ->exists();
        if (!$enrolled) {
            $rosterCount = Enrollment::where('class_id', $class->id)->count();
            $sample = $rosterCount > 0
                ? ' The roster includes: ' . $this->rosterSample($class->id) . '.'
                : ' That roster is empty — no students have joined this class yet.';
            throw new \InvalidArgumentException("that student isn't in {$class->name}.{$sample}");
        }

        $profile = StudentProfile::where('user_id', $studentId)->first();
        $name = $profile ? trim($profile->first_name . ' ' . $profile->last_name) : 'Unknown student';

        $activities = ClassActivity::where('class_id', $class->id)
            ->orderBy('order_index')
            ->get(['id', 'title', 'activity_type', 'max_points']);

        $submissions = ActivitySubmission::where('student_id', $studentId)
            ->whereIn('activity_id', $activities->pluck('id'))
            ->get()
            ->keyBy('activity_id');

        $activityRows = $activities->map(function ($a) use ($submissions) {
            $s = $submissions->get($a->id);
            return [
                'activity' => $a->title,
                'type' => $a->activity_type,
                'score' => $s?->score,
                'max' => $a->max_points,
                'status' => $s?->status ?? 'not_submitted',
            ];
        })->values()->all();

        // Quiz attempts: quizzes live in modules → courses → this class.
        // Chronological order + a timestamp so "the latest" is resolvable
        // from data instead of guessed.
        $quizIds = Quiz::whereIn(
            'module_id',
            Module::whereIn('course_id', Course::where('class_id', $class->id)->pluck('id'))->pluck('id')
        )->pluck('id');

        $quizTitles = Quiz::whereIn('id', $quizIds)->pluck('title', 'id');
        $quizRows = QuizAttempt::where('student_id', $studentId)
            ->whereIn('quiz_id', $quizIds)
            ->orderBy('created_at')
            ->get()
            ->map(fn ($q) => [
                'quiz' => $quizTitles[$q->quiz_id] ?? 'an untitled quiz',
                'score' => $q->total_score,
                'max' => $q->max_score,
                'status' => $q->status,
                'attempted_at' => $q->created_at?->toISOString(),
            ])
            ->values()
            ->all();

        // "the latest" resolves server-side — one unambiguous most-recent
        // attempt instead of the model guessing from timestamps
        $latest = !empty($params['latest']) || mb_strtolower(trim((string) ($params['quiz'] ?? ''))) === 'latest';
        if ($latest) {
            if ($quizRows === []) {
                return [
                    'student' => ['name' => $name, 'class' => $class->name],
                    'note' => "No quiz attempts yet for this student in {$class->name}.",
                    'quizzes' => [],
                ];
            }
            $quizRows = [$quizRows[count($quizRows) - 1]];
        } else {
            // A named quiz filters the rows; a miss teaches the model the
            // real titles so it can correct itself in one turn
            $quizName = trim((string) ($params['quiz'] ?? ''));
            if ($quizName !== '') {
                $filtered = array_values(array_filter(
                    $quizRows,
                    fn ($r) => str_contains(mb_strtolower($r['quiz']), mb_strtolower($quizName))
                ));
                if ($filtered === []) {
                    $titles = collect($quizRows)->pluck('quiz')->implode(', ');
                    throw new \InvalidArgumentException(
                        "no quiz resembling \"{$quizName}\" has an attempt in {$class->name}" .
                        ($titles !== '' ? " — attempted quizzes: {$titles}" : ' — this student has no quiz attempts yet')
                    );
                }
                $quizRows = $filtered;
            }
        }

        return [
            'student' => ['student_id' => $studentId, 'name' => $name, 'class' => $class->name],
            'activities' => $activityRows,
            'quizzes' => $quizRows,
        ];
    }
}
