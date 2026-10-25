<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\ActivityQuestion;
use App\Models\ClassActivity;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\Question;
use App\Models\QuestionTestCase;
use App\Support\CodeRunner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * AI question generation for classwork activities: the teacher picks context
 * (their own class's lessons/curriculum and/or uploaded files), the Python
 * service writes grounded questions in batches, and the teacher commits the
 * reviewed set into the activity — append or replace.
 *
 * The question mix is decided here, not by the teacher: with no explicit
 * per-type counts the default is multiple choice only — clean and
 * auto-gradable; other types are a deliberate Advanced choice (exact
 * per-type counts), and coding additionally requires the execution engine
 * to be able to run the course's language.
 *
 * Streaming follows the studio's contract: browser → Laravel (Sanctum) →
 * Python (X-Internal-Auth), SSE pumped byte-for-byte.
 */
class ActivityAiController extends Controller
{
    private const ALLOWED_TYPES = [
        'multiple_choice', 'true_false', 'identification',
        'enumeration', 'short_answer', 'essay', 'coding',
    ];

    /**
     * Ceiling for a single generation run. The Python service writes in
     * batches of five and streams each batch, so a 100-question run is long
     * but observable and stoppable — it is a wait-time ceiling, not a
     * capability one. Keep this in sync with the modal and qa_service.
     */
    private const MAX_QUESTIONS = 100;

    /** Human labels for the "Plan: …" status line. */
    private const PLAN_LABELS = [
        'multiple_choice' => 'multiple choice',
        'true_false' => 'true/false',
        'identification' => 'identification',
        'enumeration' => 'enumeration',
        'short_answer' => 'short answer',
        'essay' => 'essay',
        'coding' => 'coding',
    ];

    /**
     * The activity's class content tree for the context picker: modules →
     * lessons with per-lesson extracted text sizes, plus the class
     * curriculum file when it has one.
     */
    public function context(Request $request, $activityId)
    {
        $activity = $this->authorizeActivity($activityId);

        $course = Course::where('class_id', $activity->class_id)
            ->orderBy('order_index', 'asc')
            ->with(['modules' => fn ($q) => $q->orderBy('order_index', 'asc')->with(['lessons' => fn ($lq) => $lq->orderBy('order_index', 'asc')])])
            ->first();

        $modules = [];
        if ($course) {
            foreach ($course->modules as $module) {
                $lessons = $module->lessons
                    ->map(fn ($lesson) => [
                        'id' => $lesson->id,
                        'title' => $lesson->title,
                        'is_published' => (bool) $lesson->is_published,
                        'text_chars' => mb_strlen($this->lessonText($lesson)),
                    ])
                    ->values();
                // Modules with zero lessons are still shown: selecting one is
                // a no-op but hiding them makes the tree feel broken.
                $modules[] = [
                    'id' => $module->id,
                    'title' => $module->title,
                    'lessons' => $lessons,
                ];
            }
        }

        $coding = null;
        if ($course) {
            $engineLangs = self::engineLanguages();
            $coding = [
                'language' => $course->language,
                'is_coding_course' => (bool) $course->is_coding,
                // The AI can only offer coding questions when the execution
                // engine can actually run the course's language
                'engine_ok' => $course->language ? (bool) ($engineLangs[$course->language] ?? false) : false,
            ];
        }

        return response()->json([
            'activity' => ['id' => $activity->id, 'title' => $activity->title],
            'course' => $course ? [
                'id' => $course->id,
                'title' => $course->title,
                'curriculum_chars' => $course->curriculum_text ? mb_strlen($course->curriculum_text) : 0,
            ] : null,
            'coding' => $coding,
            'modules' => $modules,
        ]);
    }

    /**
     * Which languages the execution engine can actually run, id => bool.
     * A failed probe yields an empty map — coding silently unavailable.
     */
    private static function engineLanguages(): array
    {
        try {
            $map = [];
            foreach (CodeRunner::languages()['languages'] ?? [] as $l) {
                $map[$l['id']] = (bool) ($l['available'] ?? false);
            }
            return $map;
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * The SSE generation stream. Context (lesson texts, curriculum) is
     * extracted here and shipped as JSON; uploaded files are forwarded raw
     * so PPTX extraction happens in Python.
     */
    public function generate(Request $request, $activityId)
    {
        set_time_limit(900);

        $activity = $this->authorizeActivity($activityId);

        $request->validate([
            'context' => 'required|string', // JSON: {lesson_ids: number[], use_curriculum: bool}
            'settings' => 'required|string', // JSON: {types, count, difficulty, focus}
            'files' => 'nullable|array|max:4',
            'files.*' => 'file|mimes:pdf,doc,docx,ppt,pptx,txt|max:10240', // 10 MB each
        ]);

        // Shared with prepareGenerate: validates the decoded context and
        // settings, resolves lesson/curriculum text, and computes the mix.
        // Returns a JsonResponse on any validation dead end.
        $plan = $this->resolveGenerationPlan($request, $activity);
        if ($plan instanceof \Illuminate\Http\JsonResponse) {
            return $plan;
        }

        $payload = [
            ['name' => 'context', 'contents' => json_encode($plan['sources'])],
            ['name' => 'settings', 'contents' => json_encode($plan['settings'])],
        ];

        foreach ($request->file('files', []) as $file) {
            $payload[] = [
                // PHP multi-upload semantics need the bracketed name; the
                // Python endpoint binds this exact name via a File alias
                'name' => 'files[]',
                'contents' => fopen($file->getRealPath(), 'r'),
                'filename' => $file->getClientOriginalName(),
            ];
        }

        return new \Symfony\Component\HttpFoundation\StreamedResponse(function () use ($payload, $activity, $plan) {
            $aiUrl = env('AI_SERVICE_URL') . '/ai/generate-qa-questions-stream';
            $client = new \GuzzleHttp\Client();

            echo "data: " . json_encode(['type' => 'status', 'message' => 'Connecting to AI service...']) . "\n\n";
            echo "data: " . json_encode(['type' => 'status', 'message' => 'Plan: ' . $plan['label']]) . "\n\n";
            if (ob_get_level() > 0) {
                ob_flush();
            }
            flush();

            try {
                $response = $client->post($aiUrl, [
                    'headers' => \App\Services\AiService::authHeader(),
                    'multipart' => $payload,
                    'stream' => true,
                    'timeout' => 600,
                    'read_timeout' => 45, // heartbeats arrive every 12s
                    'connect_timeout' => 30,
                ]);

                $body = $response->getBody();
                $buffer = '';
                while (!$body->eof()) {
                    $chunk = $body->read(512);
                    $buffer .= $chunk;
                    while (($messageEnd = strpos($buffer, "\n\n")) !== false) {
                        $message = substr($buffer, 0, $messageEnd + 2);
                        $buffer = substr($buffer, $messageEnd + 2);
                        // Pass everything through: status/questions/heartbeats/
                        // errors — nothing here writes the DB, the teacher
                        // reviews before commit
                        echo $message;
                        if (ob_get_level() > 0) {
                            ob_flush();
                        }
                        flush();
                    }
                }
            } catch (\Throwable $e) {
                echo "data: " . json_encode(['type' => 'error', 'message' => 'The AI service dropped mid-run — try again in a moment.']) . "\n\n";
                \Log::error("Activity {$activity->id} AI question stream failed: " . $e->getMessage());
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * Validate the teacher's context/settings picks and resolve them into
     * the exact sources + settings the Python generator consumes. Shared by
     * generate() (legacy relay) and prepareGenerate() (direct signed
     * stream). Returns a 422 JsonResponse on any dead end, otherwise
     * ['sources', 'settings', 'label'].
     */
    private function resolveGenerationPlan(Request $request, ClassActivity $activity)
    {
        // Multipart form fields arrive as strings — decode then validate
        $settings = json_decode($request->input('settings', '{}'), true);
        $difficulty = (string) ($settings['difficulty'] ?? '');
        $focus = substr((string) ($settings['focus'] ?? ''), 0, 500);

        if (!in_array($difficulty, ['easy', 'medium', 'hard'], true)) {
            return response()->json(['message' => 'Invalid difficulty.'], 422);
        }

        // Resolve selected lessons → text sources, scoped to THIS teacher's
        // class (the tree ids are client-supplied)
        $contextSources = [];
        $context = json_decode($request->input('context', '{}'), true);
        $lessonIds = collect($context['lesson_ids'] ?? [])
            ->filter(fn ($v) => is_numeric($v))->map(fn ($v) => (int) $v)->unique()->values();
        $useCurriculum = (bool) ($context['use_curriculum'] ?? false);

        if ($lessonIds->isNotEmpty()) {
            $lessons = Lesson::whereIn('id', $lessonIds)
                ->whereHas('module.course', fn ($q) => $q->where('class_id', $activity->class_id)->where('teacher_id', $request->user()->id))
                ->with('module:id,title')
                ->get();

            foreach ($lessons as $lesson) {
                $text = $this->lessonText($lesson);
                if (mb_strlen(trim($text)) < 40) {
                    continue; // image/video-only lesson — nothing to ground on
                }
                $contextSources[] = [
                    'source' => 'lesson',
                    'title' => ($lesson->module?->title ? $lesson->module?->title . ' — ' : '') . $lesson->title,
                    'text' => $text,
                ];
            }
        }

        $course = Course::where('class_id', $activity->class_id)->orderBy('order_index')->first();
        if ($useCurriculum && $course && $course->curriculum_text) {
            $contextSources[] = [
                'source' => 'curriculum',
                'title' => $course->title . ' curriculum',
                'text' => $course->curriculum_text,
            ];
        }

        $hasFiles = $request->hasFile('files') || (bool) ($context['has_files'] ?? false);
        if (empty($contextSources) && !$hasFiles) {
            return response()->json([
                'message' => 'Pick at least one lesson with text, or upload a file — the AI needs material to write from.',
            ], 422);
        }

        // ---- The question mix -------------------------------------------------
        // Explicit per-type counts (Advanced) always win. Otherwise multiple
        // choice only — clean, auto-gradable, never a surprise.
        $counts = collect($settings['counts'] ?? [])
            ->filter(fn ($n, $t) => in_array($t, self::ALLOWED_TYPES, true) && is_numeric($n) && (int) $n > 0)
            ->map(fn ($n) => (int) $n);

        if ($counts->isNotEmpty()) {
            if ($counts->sum() > self::MAX_QUESTIONS) {
                return response()->json(['message' => 'Question counts add up to more than '.self::MAX_QUESTIONS.'.'], 422);
            }
            if (($counts['coding'] ?? 0) > 0 && (!$course || !$course->language)) {
                return response()->json([
                    'message' => 'Coding questions need a course language — set it in the Curriculum modal first.',
                ], 422);
            }
        } else {
            $counts = collect(['multiple_choice' => max(1, min(self::MAX_QUESTIONS, (int) ($settings['count'] ?? 10)))]);
        }

        $count = $counts->sum();
        if ($count < 1) {
            return response()->json(['message' => 'Set how many questions you need first.'], 422);
        }

        return [
            'sources' => $contextSources,
            'settings' => [
                'types' => $counts->keys()->values()->all(),
                'counts' => $counts->all(),
                'count' => $count,
                'difficulty' => $difficulty,
                'focus' => $focus,
                // Coding questions are written in the course's language — the
                // same convention the studio's lesson-challenge generator uses
                'language' => $course?->language,
                // Opt-in: the AI also proposes IO test cases for coding
                // questions (Python engine-verifies them against the
                // reference solution before they reach the review)
                'generate_test_cases' => (bool) ($settings['generate_test_cases'] ?? false),
            ],
            'label' => $counts
                ->map(fn ($n, $t) => $n . ' ' . (self::PLAN_LABELS[$t] ?? $t))
                ->implode(', '),
        ];
    }

    /**
     * Mint a short-lived signed envelope so the modal can stream question
     * generation DIRECTLY from the Python AI service (browser → Python),
     * bypassing this app's SSE relay. The relayed path crosses Render's
     * edge twice and silently drops minutes-long streams mid-run — the
     * same wall the studio's content stream already moved off (see
     * CourseController::aiPrepareStream). Uploaded files ride along on the
     * direct request itself; lesson/curriculum text is resolved here and
     * travels inside the signed payload.
     */
    public function prepareGenerate(Request $request, $activityId)
    {
        $activity = $this->authorizeActivity($activityId);

        $request->validate([
            'context' => 'required|array',
            'settings' => 'required|array',
        ]);
        // resolveGenerationPlan reads the JSON-string form fields — present
        // the decoded arrays the same way
        $request->merge([
            'context' => json_encode($request->input('context')),
            'settings' => json_encode($request->input('settings')),
        ]);

        $plan = $this->resolveGenerationPlan($request, $activity);
        if ($plan instanceof \Illuminate\Http\JsonResponse) {
            return $plan;
        }

        $payload = [
            'action' => 'qa-questions-stream',
            'activity_id' => (int) $activity->id,
            'teacher_id' => (int) $request->user()->id,
            'context' => $plan['sources'],
            'settings' => $plan['settings'],
        ];

        $payloadJson = json_encode($payload);
        $sign = \App\Services\AiService::signPayload($payloadJson);

        return response()->json([
            'payload_json' => $payloadJson,
            'auth_sig' => $sign['auth_sig'],
            'auth_ts' => $sign['auth_ts'],
            'ai_url' => rtrim((string) env('AI_SERVICE_URL'), '/'),
        ]);
    }

    /**
     * Persist the reviewed question set. Mirrors the studio's commit
     * contract: mode append (default) keeps existing questions, replace
     * wipes the activity's questions (and their test cases) first.
     * Normalization matches the manual builder: MC answers become option
     * indices, TF is pinned to True/False, enumeration carries its items
     * as options, essay gets no expected_output.
     */
    public function commit(Request $request, $activityId)
    {
        $activity = $this->authorizeActivity($activityId);

        $validated = $request->validate([
            'mode' => 'required|in:append,replace',
            'questions' => 'required|array|min:1|max:30',
            'questions.*.type' => 'required|in:' . implode(',', self::ALLOWED_TYPES),
            'questions.*.question_text' => 'required|string|max:2000',
            'questions.*.options' => 'nullable|array|max:10',
            'questions.*.expected_output' => 'nullable|string|max:2000',
            'questions.*.points' => 'required|integer|min:1|max:100',
            'questions.*.boilerplate' => 'nullable|string|max:5000',
            'questions.*.reference_code' => 'nullable|string|max:50000',
            'questions.*.language' => 'nullable|string|in:' . implode(',', CodeRunner::LANGUAGES),
            // Opt-in AI-proposed test cases (already engine-verified in the
            // Python stream against the question's reference solution)
            'questions.*.test_cases' => 'nullable|array|max:6',
            'questions.*.test_cases.*.input' => 'nullable|string|max:2000',
            'questions.*.test_cases.*.expected_output' => 'required|string|max:2000',
            'questions.*.test_cases.*.hidden' => 'nullable|boolean',
        ]);

        $mode = $validated['mode'];
        $incoming = $validated['questions'];
        $courseLanguage = Course::where('class_id', $activity->class_id)
            ->orderBy('order_index')->value('language');

        // Published or not — once students have submitted, replacing the
        // questions would cascade-delete their graded answers
        if ($mode === 'replace' && $activity->submissions()->exists()) {
            return response()->json(['message' => 'Students have already submitted — replacing questions is locked.'], 422);
        }

        $created = DB::transaction(function () use ($activity, $incoming, $mode, $courseLanguage) {
            if ($mode === 'replace') {
                $existingIds = $activity->questions()->pluck('id');
                QuestionTestCase::whereIn('testable_id', $existingIds)
                    ->where('testable_type', ActivityQuestion::class)->delete();
                $activity->questions()->delete();
            }

            // The AI writes the correct MC answer into the first slot far too
            // often — a quiz where "A" is always right is a giveaway. Seat
            // answers along a balanced shuffled plan (0,1,2,3 cycling, then
            // shuffled) so the distribution looks like a real teacher's.
            $mcCount = collect($incoming)
                ->filter(fn ($q) => ($q['type'] ?? '') === 'multiple_choice')
                ->count();
            $slotPool = [];
            for ($i = 0; $i < $mcCount; $i++) {
                $slotPool[] = $i % 4;
            }
            shuffle($slotPool);
            $mcSeen = 0;

            $baseOrder = (int) ($activity->questions()->max('order_index') ?? 0);
            $saved = [];
            $order = $baseOrder;

            foreach ($incoming as $q) {
                $mcSlot = ($q['type'] ?? '') === 'multiple_choice'
                    ? ($slotPool[$mcSeen++] ?? null)
                    : null;
                $normalized = $this->normalizeQuestion($q, $courseLanguage, $mcSlot);
                if ($normalized === null) {
                    continue; // unfixable shape (e.g. MC answer doesn't match an option)
                }
                // Opt-in AI-proposed test cases for coding questions — already
                // engine-verified in the Python stream, saved as-first-class
                // so these questions grade themselves like manual ones.
                $testCases = $normalized['test_cases'] ?? [];
                unset($normalized['test_cases']);

                $order++;
                $created = $activity->questions()->create($normalized + ['order_index' => $order]);
                foreach ($testCases as $i => $tc) {
                    \App\Models\QuestionTestCase::create([
                        'testable_type' => ActivityQuestion::class,
                        'testable_id' => $created->id,
                        'input' => (string) ($tc['input'] ?? ''),
                        'expected_output' => (string) $tc['expected_output'],
                        'hidden' => (bool) ($tc['hidden'] ?? false),
                        'order_index' => $i,
                    ]);
                }
                $saved[] = $created;
            }

            return $saved;
        });

        if (empty($created)) {
            return response()->json(['message' => 'None of those questions could be saved — check their answers and options.'], 422);
        }

        return response()->json([
            'message' => count($created) . ' question' . (count($created) === 1 ? '' : 's') . ' added to “' . $activity->title . '”.',
            'questions' => $created,
        ], 201);
    }

    /**
     * Map an AI/teacher-reviewed question onto the ActivityQuestion shape.
     * Returns null for shapes that can't be saved safely. $courseLanguage
     * backfills the language for coding questions the client didn't tag.
     * $mcSlot re-seats the correct MC answer at an assigned position — the
     * generator's first-slot habit dies here, not in a prompt.
     */
    private function normalizeQuestion(array $q, ?string $courseLanguage = null, ?int $mcSlot = null): ?array
    {
        $type = $q['type'];
        $text = trim($q['question_text']);
        $options = array_values(array_filter(array_map(
            fn ($o) => trim((string) $o),
            $q['options'] ?? []
        ), fn ($o) => $o !== ''));
        $answer = trim((string) ($q['expected_output'] ?? ''));
        $points = max(1, (int) $q['points']);

        return match ($type) {
            'multiple_choice' => (function () use ($text, $options, $answer, $points, $mcSlot) {
                // MC ships exactly 4 options — trim model overshoot to the
                // first 4, pulling the correct answer into the cut if it
                // landed beyond it. Under-filled sets are dropped: a 3-option
                // MC is not what the generator contract promises.
                if (count($options) > 4) {
                    $trimmed = array_slice($options, 0, 4);
                    foreach ($options as $i => $option) {
                        if (strcasecmp($option, $answer) === 0) {
                            if ($i > 3) {
                                $trimmed[3] = $options[$i];
                            }
                            break;
                        }
                    }
                    $options = $trimmed;
                }
                if (count($options) !== 4) {
                    return null;
                }
                $index = null;
                foreach ($options as $i => $option) {
                    if (strcasecmp($option, $answer) === 0) {
                        $index = $i;
                        break;
                    }
                }
                if ($index === null) {
                    return null; // the correct answer must be one of the options
                }
                if ($mcSlot !== null) {
                    $slot = min($mcSlot, count($options) - 1);
                    if ($index !== $slot) {
                        $answerOption = $options[$index];
                        array_splice($options, $index, 1);
                        array_splice($options, $slot, 0, [$answerOption]);
                        $index = $slot;
                    }
                }
                return [
                    'type' => 'multiple_choice',
                    'question_text' => $text,
                    'options' => $options,
                    'expected_output' => (string) $index,
                    'points' => $points,
                ];
            })(),
            'true_false' => in_array(ucfirst(strtolower($answer)), ['True', 'False'], true)
                ? [
                    'type' => 'true_false',
                    'question_text' => $text,
                    'options' => ['True', 'False'],
                    'expected_output' => ucfirst(strtolower($answer)),
                    'points' => $points,
                ]
                : null,
            'identification', 'short_answer' => $answer === '' ? null : [
                'type' => $type,
                'question_text' => $text,
                'options' => [],
                'expected_output' => $answer,
                'points' => $points,
            ],
            'enumeration' => count($options) >= 1 ? [
                'type' => 'enumeration',
                'question_text' => $text,
                'options' => $options,
                'expected_output' => '',
                'points' => $points,
            ] : null,
            'essay' => [
                'type' => 'essay',
                'question_text' => $text,
                'options' => [],
                'expected_output' => '',
                'points' => $points,
            ],
            'coding' => (function () use ($q, $text, $answer, $points, $courseLanguage) {
                $boilerplate = trim((string) ($q['boilerplate'] ?? ''));
                if ($boilerplate === '' || $answer === '') {
                    return null; // a coding task needs starter code AND an expected output
                }
                $language = in_array($q['language'] ?? '', CodeRunner::LANGUAGES, true)
                    ? $q['language']
                    : ($courseLanguage ?: 'python');
                return [
                    'type' => 'coding',
                    'question_text' => $text,
                    'options' => [],
                    'expected_output' => $answer,
                    'boilerplate' => $boilerplate,
                    'reference_code' => trim((string) ($q['reference_code'] ?? '')),
                    'language' => $language,
                    'points' => $points,
                    // Carried aside for the commit loop to save as
                    // QuestionTestCase rows (never straight onto the model)
                    'test_cases' => collect($q['test_cases'] ?? [])
                        ->filter(fn ($t) => is_array($t) && trim((string) ($t['expected_output'] ?? '')) !== '')
                        ->values()
                        ->map(fn ($t) => [
                            'input' => (string) ($t['input'] ?? ''),
                            'expected_output' => trim((string) $t['expected_output']),
                            'hidden' => (bool) ($t['hidden'] ?? false),
                        ])
                        ->all(),
                ];
            })(),
            default => null,
        };
    }

    /**
     * Plain-text extraction from a lesson's block array (h1/text carry
     * data.text; code blocks carry data.code or data.text).
     */
    private function lessonText(Lesson $lesson): string
    {
        $parts = [];
        foreach ($lesson->content ?? [] as $block) {
            $data = $block['data'] ?? [];
            $text = match ($block['type'] ?? '') {
                'h1', 'text' => $data['text'] ?? '',
                'code' => $data['code'] ?? $data['text'] ?? '',
                default => '',
            };
            if (is_string($text) && trim($text) !== '') {
                $parts[] = trim($text);
            }
        }
        return implode("\n\n", $parts);
    }

    private function authorizeActivity($id)
    {
        return ClassActivity::with('class')
            ->whereHas('class', function ($q) {
                $q->where('teacher_id', auth()->id());
            })
            ->findOrFail($id);
    }
}
