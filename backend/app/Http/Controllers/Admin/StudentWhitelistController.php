<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EnrolledStudent;
use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Models\Classroom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StudentWhitelistController extends Controller
{
    public function index()
    {
        return response()->json([
            'students' => EnrolledStudent::orderByDesc('created_at')->limit(2000)->get(),
        ]);
    }

    /**
     * List of classes that have at least one enrolled student, with counts.
     * Used by the "graduate a whole class" bulk action.
     */
    public function classes(): JsonResponse
    {
        return response()->json([
            'classes' => Classroom::withCount('students')
                ->whereHas('students')
                ->orderBy('name')
                ->get(['id', 'name', 'class_code', 'students_count']),
        ]);
    }

    /**
     * Bulk mark whitelist entries as graduated, or mark every currently
     * enrolled student of a class as graduated.
     *
     * Shape 1 — by LRN:  { "lrn_numbers": ["123456789012", ...] }
     * Shape 2 — by class: { "class_id": 7 }
     */
    public function graduate(Request $request): JsonResponse
    {
        $request->validate([
            'lrn_numbers' => 'nullable|array|min:1|max:1000',
            'lrn_numbers.*' => 'required|string|size:12|regex:/^[0-9]+$/',
            'class_id' => 'nullable|integer|min:1',
        ]);

        if (!$request->has('lrn_numbers') && !$request->has('class_id')) {
            return response()->json(['message' => 'Either lrn_numbers or class_id is required.'], 422);
        }

        $targetLrn = $this->resolveTargetLrns($request);

        if ($targetLrn->isEmpty()) {
            $kind = $request->has('class_id') ? 'class' : 'LRN';
            return response()->json([
                'message' => "No students found matching {$kind} selection.",
                'graduated' => 0,
                'already_graduated' => 0,
                'not_found' => [],
            ]);
        }

        $lrnSet = $targetLrn->values()->all();

        // Pasted LRNs that aren't on the whitelist must be REPORTED, not
        // silently skipped — a typo would otherwise strand a student.
        $notFound = [];
        if ($request->has('lrn_numbers')) {
            $known = EnrolledStudent::whereIn('lrn_number', $lrnSet)->pluck('lrn_number')->all();
            $notFound = array_values(array_diff($lrnSet, $known));
        }

        // One transaction: the whitelist update and the account lockout either
        // both happen or neither does (no half-graduated batches).
        [$graduated, $alreadyGraduated] = DB::transaction(function () use ($lrnSet, $notFound) {
            $graduatedLrns = EnrolledStudent::whereIn('lrn_number', $lrnSet)
                ->whereNull('graduated_at')->pluck('lrn_number')->all();

            if ($graduatedLrns !== []) {
                EnrolledStudent::whereIn('lrn_number', $graduatedLrns)
                    ->whereNull('graduated_at')
                    ->update(['graduated_at' => now()]);
            }

            // Revoke every token / end every session for the affected students
            // (same mechanism as the existing user disable action). Matches ALL
            // requested LRNs, not just the newly graduated ones, so re-running
            // a graduation always re-locks every account it touches.
            $studentUserIds = User::whereHas('studentProfile', function ($q) use ($lrnSet) {
                $q->whereIn('lrn_number', $lrnSet);
            })->pluck('id');

            if ($studentUserIds->isNotEmpty()) {
                User::whereIn('id', $studentUserIds)->update(['is_active' => false]);
                PersonalAccessToken::where('tokenable_type', (new User)->getMorphClass())
                    ->whereIn('tokenable_id', $studentUserIds)
                    ->delete();
            }

            // Counts exclude not-found LRNs — "already graduated" must mean
            // an actual whitelist entry, never an unknown number.
            $found = count($lrnSet) - count($notFound);

            return [count($graduatedLrns), $found - count($graduatedLrns)];
        });

        $message = "Marked {$graduated} student(s) as graduated; {$alreadyGraduated} were already graduated.";
        if ($notFound !== []) {
            $message .= ' ' . $this->notFoundNote($notFound);
        }

        return response()->json([
            'message' => $message,
            'graduated' => $graduated,
            'already_graduated' => $alreadyGraduated,
            'not_found' => $notFound,
        ]);
    }

    /**
     * Bulk re-enroll (un-graduate) whitelist entries, or re-enroll every
     * currently enrolled student of a class.
     *
     * Shape 1 — by LRN:  { "lrn_numbers": ["123456789012", ...] }
     * Shape 2 — by class: { "class_id": 7 }
     */
    public function reEnroll(Request $request): JsonResponse
    {
        $request->validate([
            'lrn_numbers' => 'nullable|array|min:1|max:1000',
            'lrn_numbers.*' => 'required|string|size:12|regex:/^[0-9]+$/',
            'class_id' => 'nullable|integer|min:1',
        ]);

        if (!$request->has('lrn_numbers') && !$request->has('class_id')) {
            return response()->json(['message' => 'Either lrn_numbers or class_id is required.'], 422);
        }

        $targetLrn = $this->resolveTargetLrns($request);

        if ($targetLrn->isEmpty()) {
            $kind = $request->has('class_id') ? 'class' : 'LRN';
            return response()->json([
                'message' => "No students found matching {$kind} selection.",
                'reenrolled' => 0,
                'not_graduated' => 0,
                'not_found' => [],
            ]);
        }

        $lrnSet = $targetLrn->values()->all();

        $notFound = [];
        if ($request->has('lrn_numbers')) {
            $known = EnrolledStudent::whereIn('lrn_number', $lrnSet)->pluck('lrn_number')->all();
            $notFound = array_values(array_diff($lrnSet, $known));
        }

        // One transaction for the whole undo, same as graduate().
        [$reenrolled, $notGraduated] = DB::transaction(function () use ($lrnSet, $notFound) {
            $reenrolledLrns = EnrolledStudent::whereIn('lrn_number', $lrnSet)
                ->whereNotNull('graduated_at')->pluck('lrn_number')->all();

            if ($reenrolledLrns !== []) {
                EnrolledStudent::whereIn('lrn_number', $reenrolledLrns)
                    ->whereNotNull('graduated_at')
                    ->update(['graduated_at' => null]);

                // Reactivate ONLY the accounts whose graduation was just
                // undone — re-enrolling a class must never resurrect an
                // account the admin disabled for an unrelated reason.
                User::whereHas('studentProfile', function ($q) use ($reenrolledLrns) {
                    $q->whereIn('lrn_number', $reenrolledLrns);
                })->update(['is_active' => true]);
            }

            // Counts exclude not-found LRNs, mirroring graduate().
            $found = count($lrnSet) - count($notFound);

            return [count($reenrolledLrns), $found - count($reenrolledLrns)];
        });

        $message = "Re-enrolled {$reenrolled} student(s); {$notGraduated} were not graduated.";
        if ($notFound !== []) {
            $message .= ' ' . $this->notFoundNote($notFound);
        }

        return response()->json([
            'message' => $message,
            'reenrolled' => $reenrolled,
            'not_graduated' => $notGraduated,
            'not_found' => $notFound,
        ]);
    }

    /**
     * Roster of the students a class-graduate / class-re-enroll action would
     * affect — the admin UI shows these names BEFORE the action can be
     * confirmed, so a class is never graduated blind. Same join as
     * resolveTargetLrns() (enrollments.student_id references users.id, so the
     * path is whitelist → student_profiles → enrollments).
     */
    public function classStudents($classId): JsonResponse
    {
        $students = EnrolledStudent::query()
            ->join('student_profiles', 'student_profiles.lrn_number', '=', 'enrolled_students.lrn_number')
            ->join('enrollments', 'enrollments.student_id', '=', 'student_profiles.user_id')
            ->where('enrollments.class_id', (int) $classId)
            ->distinct()
            ->orderBy('enrolled_students.last_name')
            ->orderBy('enrolled_students.first_name')
            ->get([
                'enrolled_students.id',
                'enrolled_students.lrn_number',
                'enrolled_students.first_name',
                'enrolled_students.last_name',
                'enrolled_students.claimed',
                'enrolled_students.graduated_at',
            ]);

        return response()->json(['students' => $students->values()]);
    }

    /**
     * Human-readable note about pasted LRNs that matched no whitelist row.
     * Lists at most 8 of them so the toast stays readable.
     */
    private function notFoundNote(array $lrns): string
    {
        $shown = array_slice($lrns, 0, 8);
        $extra = count($lrns) - count($shown);

        return count($lrns) . ' LRN(s) were not found on the whitelist and were left alone: '
            . implode(', ', $shown)
            . ($extra > 0 ? " — and {$extra} more." : '.');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'entries' => 'required|array|min:1|max:1000',
            'entries.*.lrn_number' => 'required|string|size:12|regex:/^[0-9]+$/',
            'entries.*.first_name' => 'nullable|string|max:100',
            'entries.*.last_name' => 'nullable|string|max:100',
        ]);

        $added = 0;
        $updated = 0;

        foreach ($data['entries'] as $entry) {
            $existing = EnrolledStudent::where('lrn_number', $entry['lrn_number'])->first();

            if ($existing) {
                $existing->update(array_filter([
                    'first_name' => $entry['first_name'] ?? null,
                    'last_name' => $entry['last_name'] ?? null,
                ]));
                $updated++;
            } else {
                EnrolledStudent::create($entry);
                $added++;
            }
        }

        return response()->json([
            'message' => "Student whitelist updated: {$added} added, {$updated} updated.",
            'added' => $added,
            'updated' => $updated,
        ]);
    }

    public function destroy($id)
    {
        EnrolledStudent::findOrFail($id)->delete();

        return response()->json(['message' => 'Removed from the student whitelist']);
    }

    /**
     * Resolve the LRNs a bulk status action targets.
     * - lrn_numbers: taken verbatim.
     * - class_id: the LRNs of students CURRENTLY enrolled in that class.
     *   enrollments.student_id references users.id, so the join goes through
     *   student_profiles (user_id → lrn_number) — never LRN → student_id.
     */
    private function resolveTargetLrns(Request $request)
    {
        if ($request->has('lrn_numbers')) {
            // unique(): a pasted list can repeat an LRN; counts must not.
            return collect($request->input('lrn_numbers'))->unique()->values();
        }

        return EnrolledStudent::query()
            ->join('student_profiles', 'student_profiles.lrn_number', '=', 'enrolled_students.lrn_number')
            ->join('enrollments', 'enrollments.student_id', '=', 'student_profiles.user_id')
            ->where('enrollments.class_id', $request->integer('class_id'))
            ->distinct()
            ->pluck('enrolled_students.lrn_number');
    }
}
