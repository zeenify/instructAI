<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Classroom;
use Illuminate\Http\JsonResponse;

class ClassController extends Controller
{
    // Every class in the school with its load — the admin's oversight list.
    public function index(): JsonResponse
    {
        $classes = Classroom::query()
            ->with(['teacher:id,email', 'teacher.teacherProfile:id,user_id,first_name,last_name'])
            ->withCount(['students', 'courses', 'activities'])
            ->orderByDesc('created_at')
            ->limit(500)
            ->get()
            ->map(fn (Classroom $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'class_code' => $c->class_code,
                'color' => $c->color,
                // Built from the profile fields directly — accountName() on the
                // nested relation proved flaky under eager-load constraints.
                'teacher' => trim((($c->teacher?->teacherProfile?->first_name) ?? '') . ' ' . (($c->teacher?->teacherProfile?->last_name) ?? '')) ?: ($c->teacher?->email ?? '—'),
                'teacher_email' => $c->teacher?->email,
                'students_count' => $c->students_count,
                'courses_count' => $c->courses_count,
                'activities_count' => $c->activities_count,
                'created_at' => $c->created_at,
            ]);

        return response()->json(['classes' => $classes]);
    }
}
