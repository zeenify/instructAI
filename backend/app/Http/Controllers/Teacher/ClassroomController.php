<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Classroom;
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
            'description' => 'nullable|string'
        ]);

        $classroom = Classroom::create([
            'teacher_id' => $request->user()->id,
            'name' => $request->name,
            'description' => $request->description,
            'class_code' => strtoupper(Str::random(6)) // Generates a random 6-char code
        ]);

        return response()->json($classroom, 201);
    }
    
    public function show($id)
    {
        // Fetch class with its courses and enrolled students
        $classroom = Classroom::with([
            'courses' => function($query) {
                $query->orderBy('order_index', 'asc');
            }, 
            'students.studentProfile'
        ])
        ->withCount(['students', 'courses'])
        ->findOrFail($id);

        // Security check: ensure this teacher owns the class
        if ($classroom->teacher_id !== auth()->id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json($classroom);
    }

}