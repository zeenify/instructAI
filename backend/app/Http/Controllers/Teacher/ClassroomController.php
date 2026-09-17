<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\ClassActivity;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Module;
use Illuminate\Http\Request;
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
                'students.studentProfile'
            ])
            ->withCount(['students', 'courses', 'activities'])
            ->first();

        if (!$classroom) {
            return response()->json(['message' => 'Class not found or unauthorized'], 403);
        }

        return response()->json($classroom);
    }

}