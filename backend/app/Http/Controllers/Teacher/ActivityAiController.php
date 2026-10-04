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
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * AI question generation for classwork activities: the teacher picks context
 * (their own class's lessons/curriculum and/or uploaded files), the Python
 * service writes grounded questions in batches, and the teacher commits the
 * reviewed set into the activity — append or replace.
 *
 * Streaming follows the studio's contract: browser → Laravel (Sanctum) →
 * Python (X-Internal-Auth), SSE pumped byte-for-byte.
 */
class ActivityAiController extends Controller
{
    private const ALLOWED_TYPES = [
        'multiple_choice', 'true_false', 'identification',
        'enumeration', 'short_answer', 'essay',
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

        return response()->json([
            'activity' => ['id' => $activity->id, 'title' => $activity->title],
            'course' => $course ? [
                'id' => $course->id,
                'title' => $course->title,
                'curriculum_chars' => $course->curriculum_text ? mb_strlen($course->curriculum_text) : 0,
            ] : null,
            'modules' => $modules,
        ]);
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
            'files.*' => 'file|max:10240', // 10 MB each
        ]);

        // Multipart form fields arrive as strings — decode then validate
        $settings = json_decode($request->input('settings', '{}'), true);
        $types = collect($settings['types'] ?? [])
            ->filter(fn ($t) => in_array($t, self::ALLOWED_TYPES, true))->unique()->values();
        $count = (int) ($settings['count'] ?? 0);
        $difficulty = (string) ($settings['difficulty'] ?? '');
        $focus = substr((string) ($settings['focus'] ?? ''), 0, 500);

        if ($types->isEmpty()) {
            return response()->json(['message' => 'Pick at least one question type.'], 422);
        }
        if ($count < 1 || $count > 20) {
            return response()->json(['message' => 'Question count must be between 1 and 20.'], 422);
        }
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
                    'title' => ($lesson->module?->title ? $lesson->module->title . ' — ' : '') . $lesson->title,
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

        $hasFiles = $request->hasFile('files');
        if (empty($contextSources) && !$hasFiles) {
            return response()->json([
                'message' => 'Pick at least one lesson with text, or upload a file — the AI needs material to write from.',
            ], 422);
        }

        $payload = [
            ['name' => 'context', 'contents' => json_encode($contextSources)],
            ['name' => 'settings', 'contents' => json_encode([
                'types' => $types->values()->all(),
                'count' => $count,
                'difficulty' => $difficulty,
                'focus' => $focus,
            ])],
        ];

        foreach ($request->file('files', []) as $file) {
            $payload[] = [
                'name' => 'files[]',
                'contents' => fopen($file->getRealPath(), 'r'),
                'filename' => $file->getClientOriginalName(),
            ];
        }

        return new \Symfony\Component\HttpFoundation\StreamedResponse(function () use ($payload, $activity) {
            $aiUrl = env('AI_SERVICE_URL') . '/ai/generate-qa-questions-stream';
            $client = new \GuzzleHttp\Client();

            echo "data: " . json_encode(['type' => 'status', 'message' => 'Connecting to AI service...']) . "\n\n";
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
        ]);

        $mode = $validated['mode'];
        $incoming = $validated['questions'];

        if ($mode === 'replace' && $activity->is_published && $activity->submissions()->exists()) {
            return response()->json(['message' => 'Students have already submitted — replacing questions is locked.'], 422);
        }

        $created = DB::transaction(function () use ($activity, $incoming, $mode) {
            if ($mode === 'replace') {
                $existingIds = $activity->questions()->pluck('id');
                QuestionTestCase::whereIn('testable_id', $existingIds)
                    ->where('testable_type', ActivityQuestion::class)->delete();
                $activity->questions()->delete();
            }

            $baseOrder = (int) ($activity->questions()->max('order_index') ?? 0);
            $saved = [];
            $order = $baseOrder;

            foreach ($incoming as $q) {
                $normalized = $this->normalizeQuestion($q);
                if ($normalized === null) {
                    continue; // unfixable shape (e.g. MC answer doesn't match an option)
                }
                $order++;
                $saved[] = $activity->questions()->create($normalized + ['order_index' => $order]);
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
     * Returns null for shapes that can't be saved safely.
     */
    private function normalizeQuestion(array $q): ?array
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
            'multiple_choice' => (function () use ($text, $options, $answer, $points) {
                if (count($options) < 2) {
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
