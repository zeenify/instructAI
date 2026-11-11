<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\WhitelistedTeacher;
use Illuminate\Http\Request;

class TeacherWhitelistController extends Controller
{
    public function index()
    {
        return response()->json([
            'teachers' => WhitelistedTeacher::orderByDesc('created_at')->limit(2000)->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'entries' => 'required|array|min:1|max:1000',
            'entries.*.email' => 'required|email:filter|max:191',
            'entries.*.first_name' => 'nullable|string|max:100',
            'entries.*.last_name' => 'nullable|string|max:100',
            'entries.*.position' => 'nullable|string|max:100',
        ]);

        // Normalize + dedupe the paste first so counts are exact.
        $entries = collect($data['entries'])
            ->map(function ($entry) {
                $entry['email'] = strtolower($entry['email']);
                return $entry;
            })
            ->unique('email')
            ->values();

        // Existing rows are SKIPPED and reported, never silently rewritten —
        // re-inviting a registered email must read as a no-op, not a change.
        $existing = WhitelistedTeacher::whereIn('email', $entries->pluck('email')->all())
            ->get(['id', 'email', 'claimed'])
            ->keyBy('email');

        $added = 0;
        foreach ($entries as $entry) {
            if ($existing->has($entry['email'])) {
                continue;
            }
            WhitelistedTeacher::create($entry);
            $added++;
        }

        $skipped = $entries->count() - $added;
        $skippedRegistered = $existing->filter(fn ($row) => $row->claimed)->count();

        $message = "Added {$added} teacher invite(s).";
        if ($skipped > 0) {
            $message .= " {$skipped} were already invited and left unchanged";
            $message .= $skippedRegistered > 0
                ? " — {$skippedRegistered} of them already registered."
                : '.';
        }

        return response()->json([
            'message' => $message,
            'added' => $added,
            'already_invited' => $skipped,
            'already_invited_registered' => $skippedRegistered,
        ]);
    }

    public function destroy($id)
    {
        WhitelistedTeacher::findOrFail($id)->delete();

        return response()->json(['message' => 'Removed from the teacher whitelist']);
    }
}
