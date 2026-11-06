<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Whole-database backup & restore for the school's data.
 *
 * There is exactly ONE Neon database (local, staging and prod all point at
 * it), so this is the last line of defence: a single admin can download a
 * complete JSON snapshot and put it back atomically.
 *
 * - Export streams the JSON (nothing is stored on Render's ephemeral disk)
 *   and needs no pg_dump — the image does not ship postgresql-client.
 * - Restore runs in ONE transaction: wipe + reinsert + sequence reset. Any
 *   failure rolls back and the database is untouched.
 * - Infrastructure/security tables are deliberately excluded: migrations,
 *   sessions, cache*, password_reset_tokens and personal_access_tokens.
 *   Excluding tokens also means the restoring admin stays logged in.
 */
class BackupController extends Controller
{
    public const FORMAT_VERSION = 1;

    /**
     * Insert order — parents before children (FK-safe). Restores wipe in
     * reverse. Keep in sync with the FKs; an unknown table in the file is
     * rejected rather than guessed at.
     */
    private const TABLES = [
        'users',
        'student_profiles',
        'teacher_profiles',
        'classes',
        'courses',
        'enrollments',
        'modules',
        'lessons',
        'quizzes',
        'questions',
        'quiz_attempts',
        'student_answers',
        'code_submissions',
        'lesson_completions',
        'notifications',
        'document_chunks',
        'ai_chat_logs',
        'class_activities',
        'activity_questions',
        'activity_submissions',
        'activity_answers',
        'question_test_cases',
        'enrolled_students',
        'teacher_whitelists',
        'pilot_messages',
        'pilot_audit',
    ];

    /**
     * Stream a complete JSON snapshot: meta (version, timestamp, row counts)
     * + every table's rows in FK order.
     */
    public function export()
    {
        $tables = self::TABLES;
        $exportedAt = now()->toIso8601String();
        $filename = 'instructai-backup-' . now()->format('Ymd-His') . '.json';

        return response()->streamDownload(function () use ($tables, $exportedAt) {
            @set_time_limit(0);

            // Tables stream first; meta goes LAST so the row counts come from
            // the same read instead of a second COUNT pass over every table
            // (each round trip to Neon costs ~0.3-1s — 26 extra queries were
            // minutes on a slow link). JSON key order is irrelevant to readers.
            echo '{"tables":{';

            $rowCounts = [];
            $firstTable = true;
            foreach ($tables as $table) {
                if (! $firstTable) {
                    echo ',';
                }
                $firstTable = false;

                echo json_encode($table) . ':[';

                $firstRow = true;
                $count = 0;
                DB::table($table)->orderBy('id')->chunk(500, function ($rows) use (&$firstRow, &$count) {
                    foreach ($rows as $row) {
                        if (! $firstRow) {
                            echo ',';
                        }
                        $firstRow = false;
                        $count++;
                        echo json_encode($row);
                    }
                    flush();
                });

                echo ']';
                $rowCounts[$table] = $count;
            }

            $meta = [
                'app' => 'instructai',
                'format_version' => self::FORMAT_VERSION,
                'exported_at' => $exportedAt,
                'tables' => $tables,
                'row_counts' => $rowCounts,
            ];

            echo '},"meta":' . json_encode($meta) . '}';
        }, $filename, [
            'Content-Type' => 'application/json',
            'Cache-Control' => 'no-store',
        ]);
    }

    /**
     * Restore a backup produced by export(). Atomic: wipe + insert + reset
     * sequences inside one transaction; a failure changes nothing.
     */
    public function restore(Request $request)
    {
        @set_time_limit(0);

        $request->validate([
            // 64 MB (the Dockerfile raises post_max_size to match).
            'file' => 'required|file|max:65536',
        ]);

        $raw = file_get_contents($request->file('file')->getRealPath());
        if ($raw === false) {
            return response()->json(['message' => 'Could not read the uploaded file.'], 422);
        }

        $data = json_decode($raw, true);
        if (! is_array($data)) {
            return response()->json(['message' => 'That file is not valid JSON.'], 422);
        }
        if (($data['meta']['app'] ?? null) !== 'instructai') {
            return response()->json(['message' => 'That is not an InstructAI backup file.'], 422);
        }
        if ((int) ($data['meta']['format_version'] ?? 0) !== self::FORMAT_VERSION) {
            return response()->json([
                'message' => 'This backup was made by an incompatible version of InstructAI.',
            ], 422);
        }

        $tables = self::TABLES;
        $fileTables = array_keys((array) ($data['tables'] ?? []));
        $missing = array_values(array_diff($tables, $fileTables));
        $unknown = array_values(array_diff($fileTables, $tables));

        if ($missing || $unknown) {
            return response()->json([
                'message' => 'The backup does not match this database structure.',
                'missing_tables' => $missing,
                'unknown_tables' => $unknown,
            ], 422);
        }

        // Validate every table payload is a list of row objects before any
        // destructive work starts.
        $totalRows = 0;
        foreach ($tables as $table) {
            $rows = $data['tables'][$table];
            if (! is_array($rows) || array_is_list($rows) === false) {
                return response()->json([
                    'message' => "The backup's \"$table\" section is malformed.",
                ], 422);
            }
            foreach ($rows as $row) {
                if (! is_array($row) || array_is_list($row)) {
                    return response()->json([
                        'message' => "The backup's \"$table\" section contains a malformed row.",
                    ], 422);
                }
            }
            $totalRows += count($rows);
        }

        try {
            DB::transaction(function () use ($data, $tables) {
                // Wipe children first, then parents.
                foreach (array_reverse($tables) as $table) {
                    DB::table($table)->delete();
                }

                // Reinsert in dependency order, chunked.
                foreach ($tables as $table) {
                    $rows = $data['tables'][$table];
                    foreach (array_chunk($rows, 500) as $chunk) {
                        DB::table($table)->insert($chunk);
                    }
                }

                // Postgres: explicit ids do not advance the sequences — without
                // this the next INSERT collides with a restored id.
                if (DB::getDriverName() === 'pgsql') {
                    foreach ($tables as $table) {
                        $seq = DB::selectOne(
                            "SELECT pg_get_serial_sequence(?, 'id') AS seq",
                            [$table]
                        );
                        if ($seq && $seq->seq) {
                            // $table is from our own whitelist; the sequence
                            // name comes from the database — both safe to inline.
                            DB::statement(
                                'SELECT setval(\'' . $seq->seq . '\', (SELECT COALESCE(MAX(id), 0) + 1 FROM "' . $table . '"), false)'
                            );
                        }
                    }
                }
            });
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Restore failed — nothing was changed. ' . $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'message' => 'Restore complete.',
            'tables' => count($tables),
            'rows' => $totalRows,
        ]);
    }
}
