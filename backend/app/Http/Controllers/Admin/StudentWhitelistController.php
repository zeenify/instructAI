<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EnrolledStudent;
use Illuminate\Http\Request;

class StudentWhitelistController extends Controller
{
    public function index()
    {
        return response()->json([
            'students' => EnrolledStudent::orderByDesc('created_at')->limit(2000)->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'entries' => 'required|array|min:1|max:1000',
            'entries.*.lrn_number' => 'required|string|size:12|regex:/^[0-9]+$/',
            'entries.*.first_name' => 'nullable|string|max:100',
            'entries.*.last_name' => 'nullable|string|max:100',
            'entries.*.grade_level' => 'nullable|string|max:20',
            'entries.*.section' => 'nullable|string|max:100',
        ]);

        $added = 0;
        $updated = 0;

        foreach ($data['entries'] as $entry) {
            $existing = EnrolledStudent::where('lrn_number', $entry['lrn_number'])->first();

            if ($existing) {
                $existing->update(array_filter([
                    'first_name' => $entry['first_name'] ?? null,
                    'last_name' => $entry['last_name'] ?? null,
                    'grade_level' => $entry['grade_level'] ?? null,
                    'section' => $entry['section'] ?? null,
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
}
