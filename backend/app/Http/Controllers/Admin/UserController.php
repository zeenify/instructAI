<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivitySubmission;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class UserController extends Controller
{
    // School-scale listing: cap instead of paginate — the panel filters
    // client-side beyond what this returns.
    private const LIMIT = 500;

    public function index(Request $request): JsonResponse
    {
        $role = $request->query('role');
        $q = trim((string) $request->query('q', ''));

        abort_unless(in_array($role, [null, '', 'student', 'teacher'], true), 422, 'Unknown role filter.');

        $query = User::query()
            ->with([
                'studentProfile:id,user_id,first_name,last_name,lrn_number',
                'teacherProfile:id,user_id,first_name,last_name,organization',
            ])
            ->withCount(['managedClasses', 'enrollments'])
            ->orderByDesc('created_at')
            ->limit(self::LIMIT);

        if (in_array($role, ['student', 'teacher'], true)) {
            $query->where('role', $role);
        }

        if ($q !== '') {
            $like = "%{$q}%";
            $query->where(function ($outer) use ($like) {
                $outer->where('email', 'like', $like)
                    ->orWhereHas('studentProfile', fn ($p) => $p->where(function ($p2) use ($like) {
                        $p2->where('first_name', 'like', $like)
                            ->orWhere('last_name', 'like', $like)
                            ->orWhere('lrn_number', 'like', $like);
                    }))
                    ->orWhereHas('teacherProfile', fn ($p) => $p->where(function ($p2) use ($like) {
                        $p2->where('first_name', 'like', $like)
                            ->orWhere('last_name', 'like', $like)
                            ->orWhere('organization', 'like', $like);
                    }));
            });
        }

        $users = $query->get()->map(fn (User $u) => [
            'id' => $u->id,
            'role' => $u->role,
            'email' => $u->email,
            'name' => $u->accountName(),
            'lrn' => $u->studentProfile?->lrn_number,
            'organization' => $u->teacherProfile?->organization,
            'classes_count' => $u->role === 'teacher' ? $u->managed_classes_count : $u->enrollments_count,
            'is_active' => (bool) $u->is_active,
            'created_at' => $u->created_at,
        ]);

        return response()->json(['users' => $users]);
    }

    public function disable(User $user): JsonResponse
    {
        $this->assertNotAdmin($user);
        if ($user->id === auth()->id()) {
            abort(422, 'You cannot disable your own account.');
        }

        $user->update(['is_active' => false]);
        // Tokens never expire, so revoking them is what signs the user out now.
        $user->tokens()->delete();

        return response()->json(['message' => "{$user->accountName()} is disabled. Their sessions end immediately."]);
    }

    public function enable(User $user): JsonResponse
    {
        $this->assertNotAdmin($user);
        $user->update(['is_active' => true]);

        return response()->json(['message' => "{$user->accountName()} is active again."]);
    }

    // No password-reset email exists (mail is log-only), so the admin hands
    // the password over personally. The admin may type one or take the
    // generated suggestion; either way it is returned exactly once.
    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $this->assertNotAdmin($user);
        if ($user->id === auth()->id()) {
            abort(422, 'Use the logout page to change your own password.');
        }

        $validated = $request->validate([
            'password' => 'sometimes|nullable|string|min:8|max:64',
        ]);

        $temp = $validated['password'] ?? (Str::upper(Str::random(3)) . '-' . Str::random(7));

        $user->update(['password' => $temp]);
        $user->tokens()->delete();

        return response()->json([
            'message' => "New password set for {$user->accountName()}. Their old sessions just ended.",
            'temp_password' => $temp,
        ]);
    }

    public function destroy(User $user): JsonResponse
    {
        if ($user->id === auth()->id()) {
            abort(422, 'You cannot delete your own account.');
        }
        $this->assertNotAdmin($user);

        if ($user->role === 'teacher' && $user->managedClasses()->exists()) {
            abort(422, "{$user->accountName()} still owns classes. Reassign or delete those first — disabling is the safe move meanwhile.");
        }

        if ($user->role === 'student' && ActivitySubmission::where('student_id', $user->id)->exists()) {
            abort(422, "{$user->accountName()} has classwork submissions on record. Deletion is for empty accounts — disable this one instead.");
        }

        if ($user->role === 'student' && DB::table('quiz_attempts')->where('student_id', $user->id)->exists()) {
            abort(422, "{$user->accountName()} has quiz attempts on record. Deletion is for empty accounts — disable this one instead.");
        }

        Enrollment::where('student_id', $user->id)->delete();
        $user->studentProfile()->delete();
        $user->teacherProfile()->delete();
        $user->delete();

        return response()->json(['message' => 'Account deleted.']);
    }

    private function assertNotAdmin(User $user): void
    {
        abort_if($user->role === 'admin', 422, 'Admin accounts are managed outside this panel.');
    }
}
