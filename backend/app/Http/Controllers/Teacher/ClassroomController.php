<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\ClassActivity;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Module;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ClassroomController extends Controller
{
    public function index(Request $request)
    {
        // Gets classes belonging to the logged-in teacher
        $classes = Classroom::where('teacher_id', $request->user()->id)
                    ->withCount('students')
                    ->get();
        return response()->json($classes);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);

        $classroom = Classroom::create([
            'teacher_id' => $request->user()->id,
            'name' => $request->name,
            'description' => $request->description,
            'color' => $request->color,
            'class_code' => strtoupper(Str::random(6)) // Generates a random 6-char code
        ]);

        // Strict 1 class = 1 course (see docs/data-layer-plan.md): auto-create
        // the class's content course so a new class is immediately buildable.
        $classroom->courses()->create([
            'teacher_id' => $request->user()->id,
            'title' => $classroom->name,
            'is_published' => false,
            'order_index' => 0,
        ]);

        return response()->json($classroom->load('courses'), 201);
    }
    
    public function overview(Request $request)
    {
        // Single payload for the teacher home dashboard: every class with the
        // aggregate counts its card shows, computed in a fixed number of queries.
        $teacherId = $request->user()->id;

        $classes = Classroom::where('teacher_id', $teacherId)
            ->orderBy('created_at')
            ->get(['id', 'name', 'class_code', 'description', 'color', 'created_at']);

        $classIds = $classes->pluck('id');

        $studentsByClass = Enrollment::whereIn('class_id', $classIds)
            ->groupBy('class_id')
            ->selectRaw('class_id, count(*) as count')
            ->pluck('count', 'class_id');

        $coursesByClass = Course::whereIn('class_id', $classIds)
            ->groupBy('class_id')
            ->selectRaw('class_id, count(*) as count')
            ->pluck('count', 'class_id');

        $modulesByClass = Module::whereIn('course_id', Course::whereIn('class_id', $classIds)->select('id'))
            ->join('courses', 'courses.id', '=', 'modules.course_id')
            ->groupBy('courses.class_id')
            ->selectRaw('courses.class_id, count(*) as count')
            ->pluck('count', 'courses.class_id');

        // Classwork quizzes only (standalone class activities), not module quizzes
        $quizzesByClass = ClassActivity::whereIn('class_id', $classIds)
            ->where('activity_type', 'quiz')
            ->groupBy('class_id')
            ->selectRaw('class_id, count(*) as count')
            ->pluck('count', 'class_id');

        $payload = $classes->map(fn ($class) => [
            'id' => $class->id,
            'name' => $class->name,
            'class_code' => $class->class_code,
            'description' => $class->description,
            'color' => $class->color,
            'created_at' => $class->created_at,
            'students_count' => (int) ($studentsByClass[$class->id] ?? 0),
            'courses_count' => (int) ($coursesByClass[$class->id] ?? 0),
            'modules_count' => (int) ($modulesByClass[$class->id] ?? 0),
            'classwork_quizzes_count' => (int) ($quizzesByClass[$class->id] ?? 0),
        ]);

        return response()->json([
            'classes' => $payload,
            'totals' => [
                'classes_count' => $classes->count(),
                'students_count' => (int) $studentsByClass->sum(),
            ],
        ]);
    }

    public function updateColor(Request $request, $id)
    {
        $data = $request->validate([
            'color' => ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);

        $classroom = Classroom::where('id', $id)
            ->where('teacher_id', $request->user()->id)
            ->first();

        if (!$classroom) {
            return response()->json(['message' => 'Class not found or unauthorized'], 403);
        }

        $classroom->update(['color' => $data['color']]);

        return response()->json(['id' => $classroom->id, 'color' => $classroom->color]);
    }

    public function destroy(Request $request, $id)
    {
        $classroom = Classroom::where('id', $id)
            ->where('teacher_id', $request->user()->id)
            ->first();

        if (!$classroom) {
            return response()->json(['message' => 'Class not found or unauthorized'], 403);
        }

        // Courses, enrollments, activities, etc. cascade via foreign keys.
        $classroom->delete();

        return response()->json(['message' => 'Class deleted']);
    }

    public function show($id)
    {
        // This query says: "Find a class with this ID, BUT only if the teacher_id matches the logged-in user"
        $classroom = Classroom::where('id', $id)
            ->where('teacher_id', auth()->id())
            ->with([
                'courses' => fn($q) => $q->orderBy('order_index', 'asc'),
                // Strict 1 class = 1 course: the single course's full content
                // ships in this one payload so the page renders in ONE query
                // round trip (no serial content waterfall).
                'courses.modules' => fn($q) => $q->orderBy('order_index', 'asc'),
                'courses.modules.lessons' => fn($q) => $q->orderBy('order_index', 'asc'),
                // questions_count powers the "N questions" meta on module rows
                'courses.modules.quizzes' => fn($q) => $q->withCount('questions')->orderBy('order_index', 'asc'),
                'students.studentProfile'
            ])
            ->withCount(['students', 'courses', 'activities'])
            ->first();

        if (!$classroom) {
            return response()->json(['message' => 'Class not found or unauthorized'], 403);
        }

        // Teacher signal: submitted classwork waiting to be graded
        $classroom->to_grade_count = \App\Models\ActivitySubmission::whereIn(
            'activity_id',
            \App\Models\ClassActivity::where('class_id', $classroom->id)->pluck('id')
        )->where('status', 'submitted')->count();

        return response()->json($classroom);
    }

    /**
     * What this class can offer as a COPY SOURCE: a compact summary of its
     * content tree (modules/lessons/quizzes) and its classwork activities.
     * Powers the "Copy from another class" picker on the target class page.
     */
    public function copyPreview(Request $request, $id)
    {
        $classroom = Classroom::where('id', $id)
            ->where('teacher_id', $request->user()->id)
            ->first();
        if (!$classroom) {
            return response()->json(['message' => 'Class not found or unauthorized'], 403);
        }

        $course = Course::where('class_id', $classroom->id)
            ->orderBy('order_index', 'asc')
            ->with(['modules' => fn ($q) => $q->orderBy('order_index', 'asc')->withCount(['lessons', 'quizzes'])])
            ->first();

        $modules = [];
        $totals = ['lessons' => 0, 'quizzes' => 0, 'questions' => 0];
        if ($course) {
            foreach ($course->modules as $module) {
                $questionCount = \App\Models\Question::whereIn(
                    'quiz_id',
                    \App\Models\Quiz::where('module_id', $module->id)->pluck('id')
                )->count();
                $modules[] = [
                    'id' => $module->id,
                    'title' => $module->title,
                    'lessons_count' => (int) $module->lessons_count,
                    'quizzes_count' => (int) $module->quizzes_count,
                    'questions_count' => $questionCount,
                ];
                $totals['lessons'] += (int) $module->lessons_count;
                $totals['quizzes'] += (int) $module->quizzes_count;
                $totals['questions'] += $questionCount;
            }
        }

        $activities = ClassActivity::where('class_id', $classroom->id)
            ->orderBy('order_index', 'asc')
            ->withCount('questions')
            ->get(['id', 'title', 'activity_type', 'max_points', 'is_published'])
            ->map(fn ($a) => [
                'id' => $a->id,
                'title' => $a->title,
                'activity_type' => $a->activity_type,
                'questions_count' => (int) $a->questions_count,
                'max_points' => $a->max_points,
                'is_published' => (bool) $a->is_published,
            ])
            ->values();

        return response()->json([
            'class' => ['id' => $classroom->id, 'name' => $classroom->name],
            'modules' => $modules,
            'totals' => $totals,
            'activities' => $activities,
        ]);
    }

    /**
     * Copy another class's content (course → modules → lessons → quizzes →
     * questions → test cases) and/or classwork activities into THIS class.
     * Everything arrives unpublished as drafts the teacher reviews before
     * publishing — mirrors repost/ai-commit conventions.
     */
    public function copyFrom(Request $request, $id)
    {
        $validated = $request->validate([
            'source_class_id' => 'required|integer',
            'content_mode' => 'required|in:none,append,replace',
            'activity_ids' => 'nullable|array|max:100',
            'activity_ids.*' => 'integer',
        ]);

        $target = Classroom::where('id', $id)
            ->where('teacher_id', $request->user()->id)
            ->first();
        if (!$target) {
            return response()->json(['message' => 'Class not found or unauthorized'], 403);
        }

        $source = Classroom::where('id', $validated['source_class_id'])
            ->where('teacher_id', $request->user()->id)
            ->first();
        if (!$source) {
            return response()->json(['message' => 'Source class not found or unauthorized'], 403);
        }
        if ((int) $source->id === (int) $target->id) {
            return response()->json(['message' => 'Pick a different class to copy from'], 422);
        }

        $activityIds = collect($validated['activity_ids'] ?? []);
        if ($validated['content_mode'] === 'none' && $activityIds->isEmpty()) {
            return response()->json(['message' => 'Select content or activities to copy'], 422);
        }

        // Source content must exist if content copy was requested
        $sourceCourse = null;
        if ($validated['content_mode'] !== 'none') {
            $sourceCourse = Course::where('class_id', $source->id)
                ->orderBy('order_index', 'asc')
                ->with(['modules' => fn ($q) => $q->orderBy('order_index', 'asc')])
                ->first();
            if (!$sourceCourse || $sourceCourse->modules->isEmpty()) {
                return response()->json(['message' => "“{$source->name}” has no content to copy yet"], 422);
            }
        }

        // Activities must belong to the source class — silently filter so a
        // stale selection never copies another teacher's material
        $activitiesToCopy = ClassActivity::whereIn('id', $activityIds)
            ->where('class_id', $source->id)
            ->orderBy('order_index', 'asc')
            ->get();

        if ($validated['content_mode'] !== 'none' && $activitiesToCopy->isEmpty() && $activityIds->isNotEmpty()) {
            return response()->json(['message' => 'The selected activities no longer exist in that class'], 422);
        }

        $result = DB::transaction(function () use ($target, $source, $sourceCourse, $validated, $activitiesToCopy) {
            $counts = ['modules' => 0, 'lessons' => 0, 'quizzes' => 0, 'questions' => 0, 'activities' => 0];

            // ---- Class content ------------------------------------------------
            if ($validated['content_mode'] !== 'none') {
                // Strict 1 class = 1 course (docs/data-layer-plan.md): the
                // target course exists for every class created since the
                // auto-course change; legacy classes get one on demand.
                $targetCourse = Course::where('class_id', $target->id)
                    ->orderBy('order_index', 'asc')
                    ->first();
                if (!$targetCourse) {
                    $targetCourse = $target->courses()->create([
                        'teacher_id' => $target->teacher_id,
                        'title' => $target->name,
                        'is_published' => false,
                        'order_index' => 0,
                    ]);
                }

                // 'replace' wipes the target's existing module tree first
                // (same semantics as the AI commit's replace mode)
                if ($validated['content_mode'] === 'replace') {
                    $moduleIds = $targetCourse->modules()->pluck('id');
                    $quizIds = \App\Models\Quiz::whereIn('module_id', $moduleIds)->pluck('id');
                    \App\Models\QuestionTestCase::whereIn('testable_id', $quizIds)
                        ->where('testable_type', \App\Models\Question::class)->delete();
                    \App\Models\Question::whereIn('quiz_id', $quizIds)->delete();
                    \App\Models\Lesson::whereIn('module_id', $moduleIds)->delete();
                    \App\Models\Quiz::whereIn('module_id', $moduleIds)->delete();
                    \App\Models\Module::whereIn('id', $moduleIds)->delete();
                }

                $baseOrder = $validated['content_mode'] === 'replace'
                    ? 0
                    : ((int) $targetCourse->modules()->max('order_index') ?? 0) + 1;

                foreach ($sourceCourse->modules as $sourceModule) {
                    $moduleCopy = $sourceModule->replicate();
                    $moduleCopy->course_id = $targetCourse->id;
                    $moduleCopy->order_index = $baseOrder++;
                    $moduleCopy->is_published = false;
                    $moduleCopy->save();
                    $counts['modules']++;

                    foreach ($sourceModule->lessons()->orderBy('order_index')->get() as $lesson) {
                        $lessonCopy = $lesson->replicate();
                        $lessonCopy->module_id = $moduleCopy->id;
                        $lessonCopy->is_published = false;
                        // Blocks are keyed by uuid — regenerate so two lessons
                        // never share block ids
                        $blocks = collect($lessonCopy->content ?? [])
                            ->map(fn ($block) => $block + ['id' => (string) Str::uuid()])
                            ->values()
                            ->all();
                        $lessonCopy->content = $blocks;
                        // The AI tutor's index tracks this hash per lesson id —
                        // a clone reindexes on its next publish
                        $lessonCopy->indexed_hash = null;
                        $lessonCopy->save();
                        $counts['lessons']++;
                    }

                    foreach ($sourceModule->quizzes()->orderBy('order_index')->get() as $quiz) {
                        $quizCopy = $quiz->replicate();
                        $quizCopy->module_id = $moduleCopy->id;
                        $quizCopy->is_published = false;
                        $quizCopy->save();
                        $counts['quizzes']++;

                        foreach ($quiz->questions()->orderBy('order_index')->with('testCases')->get() as $question) {
                            $questionCopy = $question->replicate();
                            $questionCopy->quiz_id = $quizCopy->id;
                            $questionCopy->save();
                            $counts['questions']++;

                            foreach ($question->testCases as $testCase) {
                                $caseCopy = $testCase->replicate();
                                $caseCopy->testable_type = \App\Models\Question::class;
                                $caseCopy->testable_id = $questionCopy->id;
                                $caseCopy->save();
                            }
                        }
                    }
                }
            }

            // ---- Classwork activities -----------------------------------------
            $nextOrder = (int) (ClassActivity::where('class_id', $target->id)->max('order_index') ?? 0);
            foreach ($activitiesToCopy as $activity) {
                $copy = $activity->replicate();
                $copy->class_id = $target->id;
                $copy->teacher_id = $target->teacher_id;
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
                $copy->order_index = ++$nextOrder;
                // Instruction files live on Cloudinary under the original — a
                // clone would dangle once the original is deleted
                $copy->instruction_files = [];
                $copy->save();
                $counts['activities']++;

                foreach ($activity->questions()->with('testCases')->get() as $question) {
                    $questionCopy = $question->replicate();
                    $questionCopy->activity_id = $copy->id;
                    $questionCopy->save();

                    foreach ($question->testCases as $testCase) {
                        $caseCopy = $testCase->replicate();
                        $caseCopy->testable_type = \App\Models\ActivityQuestion::class;
                        $caseCopy->testable_id = $questionCopy->id;
                        $caseCopy->save();
                    }
                }
            }

            return $counts;
        });

        $parts = [];
        if ($result['modules'] > 0) {
            $parts[] = "{$result['modules']} module" . ($result['modules'] === 1 ? '' : 's')
                . " ({$result['lessons']} lessons, {$result['quizzes']} quizzes)";
        }
        if ($result['activities'] > 0) {
            $parts[] = "{$result['activities']} classwork" . ($result['activities'] === 1 ? '' : 's');
        }

        return response()->json([
            'message' => 'Copied from “' . $source->name . '” as drafts: ' . implode(' and ', $parts),
            'counts' => $result,
        ], 201);
    }
}