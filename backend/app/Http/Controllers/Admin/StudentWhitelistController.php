<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EnrolledStudent;
use App\Models\User;
use App\Models\Classroom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        $graduated = 0;
        $alreadyGraduated = 0;

        $targetLrn = $this->resolveTargetLrns($request);

        if ($targetLrn->isEmpty()) {
            $kind = $request->has('class_id') ? 'class' : 'LRN';
            return response()->json([
                'message' => "No students found matching {$kind} selection.",
                'graduated' => 0,
                'already_graduated' => 0,
            ]);
        }

        $lrnSet = $targetLrn->toArray();

        // Set graduated_at on whitelist rows.
        EnrolledStudent::whereIn('lrn_number', $lrnSet)->get()->each(function (EnrolledStudent $entry) use (&$graduated, &$alreadyGraduated) {
            if ($entry->graduated_at !== null) {
                $alreadyGraduated++;
                return;
            }
            $entry->update(['graduated_at' => now()]);
            $graduated++;
        });

        // Revoke every token / end every session for the affected students
        // (same mechanism as the existing user disable action).
        $studentUsers = User::whereHas('studentProfile', function ($q) use ($lrnSet) {
            $q->whereIn('lrn_number', $lrnSet);
        })->get();

        if ($studentUsers->isNotEmpty()) {
            User::whereIn('id', $studentUsers->pluck('id'))->update(['is_active' => false]);
            $studentUsers->each(fn (User $u) => $u->tokens()->delete());
        }

        return response()->json([
            'message' => "Marked {$graduated} student(s) as graduated; {$alreadyGraduated} were already graduated.",
            'graduated' => $graduated,
            'already_graduated' => $alreadyGraduated,
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

        $reenrolled = 0;
        $notGraduated = 0;

        $targetLrn = $this->resolveTargetLrns($request);

        if ($targetLrn->isEmpty()) {
            $kind = $request->has('class_id') ? 'class' : 'LRN';
            return response()->json([
                'message' => "No students found matching {$kind} selection.",
                'reenrolled' => 0,
                'not_graduated' => 0,
            ]);
        }

        $lrnSet = $targetLrn->toArray();

        EnrolledStudent::whereIn('lrn_number', $lrnSet)->get()->each(function (EnrolledStudent $entry) use (&$reenrolled, &$notGraduated) {
            if ($entry->graduated_at === null) {
                $notGraduated++;
                return;
            }
            $entry->update(['graduated_at' => null]);
            $reenrolled++;
        });

        // Restore access for the re-enrolled students.
        User::whereHas('studentProfile', function ($q) use ($lrnSet) {
            $q->whereIn('lrn_number', $lrnSet);
        })->update(['is_active' => true]);

        return response()->json([
            'message' => "Re-enrolled {$reenrolled} student(s); {$notGraduated} were not graduated.",
            'reenrolled' => $reenrolled,
            'not_graduated' => $notGraduated,
        ]);
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
            return collect($request->input('lrn_numbers'));
        }

        return EnrolledStudent::query()
            ->join('student_profiles', 'student_profiles.lrn_number', '=', 'enrolled_students.lrn_number')
            ->join('enrollments', 'enrollments.student_id', '=', 'student_profiles.user_id')
            ->where('enrollments.class_id', $request->integer('class_id'))
            ->distinct()
            ->pluck('enrolled_students.lrn_number');
    }
}
