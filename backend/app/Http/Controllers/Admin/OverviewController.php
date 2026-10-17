<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EnrolledStudent;
use App\Models\User;
use App\Models\WhitelistedTeacher;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class OverviewController extends Controller
{
    // One burst of cheap counts (school scale) for the panel's landing page.
    public function index(): JsonResponse
    {
        $counts = [
            'students' => User::where('role', 'student')->count(),
            'teachers' => User::where('role', 'teacher')->count(),
            'disabled' => User::where('is_active', false)->count(),
            'classes' => DB::table('classes')->count(),
            'courses' => DB::table('courses')->count(),
            'modules' => Schema::hasTable('modules') ? DB::table('modules')->count() : 0,
            'lessons' => Schema::hasTable('lessons') ? DB::table('lessons')->count() : 0,
            'quizzes' => Schema::hasTable('quizzes') ? DB::table('quizzes')->count() : 0,
            'activities' => Schema::hasTable('class_activities') ? DB::table('class_activities')->count() : 0,
        ];

        $newest = User::query()
            ->with('studentProfile:id,user_id,first_name,last_name', 'teacherProfile:id,user_id,first_name,last_name')
            ->orderByDesc('created_at')
            ->limit(6)
            ->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'role' => $u->role,
                'name' => $u->accountName(),
                'email' => $u->email,
                'created_at' => $u->created_at,
            ]);

        // Biggest classes by enrollment, teacher name formatted in PHP so the
        // query stays driver-neutral.
        $topClasses = DB::table('classes as c')
            ->leftJoin('users as t', 't.id', '=', 'c.teacher_id')
            ->leftJoin('teacher_profiles as tp', 'tp.user_id', '=', 't.id')
            ->leftJoin('enrollments as e', 'e.class_id', '=', 'c.id')
            ->groupBy('c.id', 'c.name', 'c.class_code', 't.email', 'tp.first_name', 'tp.last_name')
            ->orderByRaw('count(e.id) desc')
            ->limit(5)
            ->get([
                'c.id', 'c.name', 'c.class_code', 't.email as teacher_email',
                'tp.first_name as teacher_first', 'tp.last_name as teacher_last',
                DB::raw('count(e.id) as students_count'),
            ])
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'class_code' => $c->class_code,
                'teacher' => trim(($c->teacher_first ?? '') . ' ' . ($c->teacher_last ?? '')) ?: ($c->teacher_email ?? '—'),
                'students_count' => (int) $c->students_count,
            ]);

        return response()->json([
            'counts' => $counts,
            'whitelist' => [
                'students' => [
                    'total' => EnrolledStudent::count(),
                    'claimed' => EnrolledStudent::where('claimed', true)->count(),
                ],
                'teachers' => [
                    'total' => WhitelistedTeacher::count(),
                    'claimed' => WhitelistedTeacher::where('claimed', true)->count(),
                ],
            ],
            'newest' => $newest,
            'top_classes' => $topClasses,
        ]);
    }
}
