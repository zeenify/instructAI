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

        $added = 0;
        $updated = 0;

        foreach ($data['entries'] as $entry) {
            $email = strtolower($entry['email']);
            $payload = array_filter([
                'first_name' => $entry['first_name'] ?? null,
                'last_name' => $entry['last_name'] ?? null,
                'position' => $entry['position'] ?? null,
            ]);

            $existing = WhitelistedTeacher::where('email', $email)->first();

            if ($existing) {
                $existing->update($payload);
                $updated++;
            } else {
                WhitelistedTeacher::create(['email' => $email] + $payload);
                $added++;
            }
        }

        return response()->json([
            'message' => "Teacher whitelist updated: {$added} added, {$updated} updated.",
            'added' => $added,
            'updated' => $updated,
        ]);
    }

    public function destroy($id)
    {
        WhitelistedTeacher::findOrFail($id)->delete();

        return response()->json(['message' => 'Removed from the teacher whitelist']);
    }
}
