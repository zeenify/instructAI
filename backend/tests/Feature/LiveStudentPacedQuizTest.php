<?php

namespace Tests\Feature;

use App\Models\ActivityAnswer;
use App\Models\ActivityQuestion;
use App\Models\ClassActivity;
use App\Models\Classroom;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LiveStudentPacedQuizTest extends TestCase
{
    use RefreshDatabase;

    private function teacher(): User
    {
        return User::factory()->create(['role' => 'teacher']);
    }

    private function student(): User
    {
        return User::factory()->create(['role' => 'student']);
    }

    private function classroomFor(User $teacher): Classroom
    {
        return Classroom::create([
            'teacher_id' => $teacher->id,
            'name' => 'Test Class',
            'class_code' => '123456',
        ]);
    }

    private function quiz(Classroom $class, User $teacher, array $overrides = []): ClassActivity
    {
        $activity = ClassActivity::create(array_merge([
            'class_id' => $class->id,
            'teacher_id' => $teacher->id,
            'title' => 'Student-Paced Live Quiz',
            'activity_type' => 'quiz',
            'grading_method' => 'auto',
            'is_published' => true,
            'pacing_mode' => 'student',
            'timer_mode' => 'none',
            'show_results' => 'room_close',
            'shuffle_questions' => false,
            'max_points' => 10,
        ], $overrides));

        $questions = [
            ['type' => 'multiple_choice', 'question_text' => 'Pick Beta?', 'options' => ['Alpha', 'Beta', 'Gamma'], 'expected_output' => '1', 'points' => 2, 'order_index' => 0],
            ['type' => 'identification', 'question_text' => 'Name?', 'options' => null, 'expected_output' => 'answer', 'points' => 2, 'order_index' => 1],
            ['type' => 'enumeration', 'question_text' => 'Name the first two planets.', 'options' => ['mercury', 'venus'], 'expected_output' => null, 'points' => 2, 'order_index' => 2],
            ['type' => 'true_false', 'question_text' => 'True?', 'options' => ['True', 'False'], 'expected_output' => 'True', 'points' => 2, 'order_index' => 3],
            ['type' => 'essay', 'question_text' => 'Explain.', 'options' => null, 'expected_output' => null, 'points' => 2, 'order_index' => 4],
        ];

        foreach ($questions as $q) {
            ActivityQuestion::create(array_merge(['activity_id' => $activity->id], $q));
        }

        return $activity->fresh();
    }

    private function enroll(User $student, Classroom $class): void
    {
        Enrollment::create(['student_id' => $student->id, 'class_id' => $class->id]);
    }

    private function startRoom(ClassActivity $activity, User $teacher): void
    {
        Sanctum::actingAs($teacher);
        $this->postJson("/api/teacher/activities/{$activity->id}/start-live")->assertStatus(200);
    }

    private function join(User $student, ClassActivity $activity)
    {
        Sanctum::actingAs($student);

        return $this->postJson("/api/student/activities/{$activity->id}/quiz/join");
    }

    private function questionId(ClassActivity $activity, int $order): int
    {
        return (int) $activity->fresh()->questions->where('order_index', $order)->first()->id;
    }

    public function test_student_cannot_join_before_room_live(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);

        $this->join($s, $a)->assertStatus(422);
    }

    public function test_join_assigns_canonical_order_when_shuffle_off(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);

        $res = $this->join($s, $a)->assertStatus(200);

        $canonical = $a->questions->sortBy('order_index')->pluck('id')->values()->all();
        $this->assertSame($canonical, $res->json('submission.question_order'));
    }

    public function test_join_assigns_shuffled_order_when_shuffle_on(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t, ['shuffle_questions' => true]);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);

        $res = $this->join($s, $a)->assertStatus(200);

        $order = collect($res->json('submission.question_order'));
        $canonical = $a->questions->sortBy('order_index')->pluck('id')->values()->all();

        $this->assertSame(count($canonical), $order->count());
        $this->assertSame($canonical, $order->sort()->values()->all());
    }

    public function test_autosave_persists_answer_and_state_restores_it(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        $this->join($s, $a)->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/start")->assertStatus(200);

        $qid = $this->questionId($a, 0);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $qid,
            'submitted_answer' => '1',
            'current_question_idx' => 1,
        ])->assertStatus(200);

        $state = $this->getJson("/api/student/activities/{$a->id}/quiz/state")->assertStatus(200);
        $this->assertSame(1, $state->json('submission.current_question_idx'));

        $stored = collect($state->json('submission.answers'))->firstWhere('question_id', $qid);
        $this->assertNotNull($stored);
        $this->assertSame('1', $stored['submitted_answer']);
    }

    public function test_resume_after_rejoin_keeps_submission_and_answers(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        $this->join($s, $a)->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/start")->assertStatus(200);
        $qid = $this->questionId($a, 0);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $qid,
            'submitted_answer' => '1',
        ])->assertStatus(200);

        // "Refresh" — re-join with the same student
        $again = $this->join($s, $a)->assertStatus(200);
        $this->assertNotNull($again->json('submission.started_at'));
        $stored = collect($again->json('submission.answers'))->firstWhere('question_id', $qid);
        $this->assertNotNull($stored);
        $this->assertSame('1', $stored['submitted_answer']);
    }

    public function test_entire_quiz_timer_expiry_finalizes_submission(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t, ['timer_mode' => 'entire_quiz', 'time_limit_minutes' => 5]);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        $this->join($s, $a)->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/start")->assertStatus(200);

        // Freshly started: the whole limit is still on the clock
        $state = $this->getJson("/api/student/activities/{$a->id}/quiz/state")->assertStatus(200);
        $this->assertGreaterThanOrEqual(299, $state->json('remaining_seconds'));
        $this->assertLessThanOrEqual(300, $state->json('remaining_seconds'));

        // Wind the clock past the limit
        $submission = $a->submissions()->where('student_id', $s->id)->first();
        $submission->update(['started_at' => now()->subMinutes(6)]);

        $qid = $this->questionId($a, 0);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $qid,
            'submitted_answer' => '1',
        ])->assertStatus(422)->assertJson(['message' => 'Time is up']);

        $state = $this->getJson("/api/student/activities/{$a->id}/quiz/state")->assertStatus(200);
        $this->assertTrue($state->json('finalized'));
        $this->assertSame('graded', $state->json('submission.status'));
    }

    public function test_finish_scores_auto_questions_with_partial_credit(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        $this->join($s, $a)->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/start")->assertStatus(200);

        foreach ([0, 1, 2, 3] as $order) {
            $answer = match ($order) {
                0 => '1',                    // MC correct
                1 => 'answer',               // identification correct
                2 => ['mercury'],            // enumeration: 1 of 2
                3 => 'False',                // TF wrong
            };
            $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
                'question_id' => $this->questionId($a, $order),
                'submitted_answer' => $answer,
            ])->assertStatus(200);
        }

        $res = $this->postJson("/api/student/activities/{$a->id}/quiz/finish")->assertStatus(200);

        $this->assertSame('graded', $res->json('submission.status'));
        // 2 (MC) + 2 (identification) + 1 (half of enumeration) + 0 (TF wrong) = 5
        $this->assertEquals(5.0, (float) $res->json('submission.score'));
        $this->assertEquals(10.0, (float) $res->json('submission.max_score'));
    }

    public function test_finish_with_essay_stays_submitted_pending_manual_grade(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        $this->join($s, $a)->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/start")->assertStatus(200);

        $essayId = $this->questionId($a, 4);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $essayId,
            'submitted_answer' => 'A long explanation.',
        ])->assertStatus(200);

        $res = $this->postJson("/api/student/activities/{$a->id}/quiz/finish")->assertStatus(200);

        $this->assertSame('submitted', $res->json('submission.status'));
        $this->assertNull($res->json('submission.graded_at'));
    }

    public function test_one_attempt_only_after_finish(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        $this->join($s, $a)->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/start")->assertStatus(200);
        $this->postJson("/api/student/activities/{$a->id}/quiz/finish")->assertStatus(200);

        $this->postJson("/api/student/activities/{$a->id}/quiz/finish")
            ->assertStatus(422)->assertJson(['message' => 'Quiz already finalized']);

        $qid = $this->questionId($a, 0);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $qid,
            'submitted_answer' => '1',
        ])->assertStatus(422)->assertJson(['message' => 'Quiz already finalized']);
    }

    public function test_room_close_force_finalizes_drafts_and_marks_never_started_missed(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $started = $this->student();
        $absent = $this->student();
        $this->enroll($started, $c);
        $this->enroll($absent, $c);
        $this->startRoom($a, $t);

        // Started student joins + begins but does not finish
        $this->join($started, $a)->assertStatus(200);
        Sanctum::actingAs($started);
        $this->postJson("/api/student/activities/{$a->id}/quiz/start")->assertStatus(200);

        // Absent student joins (creates draft) but never starts
        $this->join($absent, $a)->assertStatus(200);

        Sanctum::actingAs($t);
        $res = $this->postJson("/api/teacher/activities/{$a->id}/end-live")->assertStatus(200);
        $this->assertSame(1, $res->json('finalized'));
        $this->assertSame(1, $res->json('missed'));

        $startedRow = $a->submissions()->where('student_id', $started->id)->first();
        $this->assertSame('graded', $startedRow->status);
        $this->assertNotNull($startedRow->room_closed_at);

        $absentRow = $a->submissions()->where('student_id', $absent->id)->first();
        $this->assertSame('missed', $absentRow->status);
    }

    public function test_skipped_questions_score_zero_at_room_close(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        $this->join($s, $a)->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/start")->assertStatus(200);

        // Answer only the MC question correctly, skip the rest
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $this->questionId($a, 0),
            'submitted_answer' => '1',
        ])->assertStatus(200);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$a->id}/end-live")->assertStatus(200);

        $row = $a->submissions()->where('student_id', $s->id)->first();
        $this->assertSame('graded', $row->status);
        $this->assertEquals(2.0, (float) $row->score); // only the answered MC earned points
    }

    public function test_enumeration_duplicate_entries_cannot_inflate_score(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        $this->join($s, $a)->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/start")->assertStatus(200);

        // Same correct item three times must NOT earn more than one item's credit
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $this->questionId($a, 2),
            'submitted_answer' => ['mercury', 'mercury', 'mercury'],
        ])->assertStatus(200);

        $this->postJson("/api/student/activities/{$a->id}/quiz/finish")->assertStatus(200);

        $enum = ActivityAnswer::where('question_id', $this->questionId($a, 2))->first();
        $this->assertFalse((bool) $enum->is_correct);
        // 1 unique correct of 2 items × 2 pts = 1.0 — not 2.0 or 3.0
        $this->assertEquals(1.0, (float) $enum->score);
    }

    public function test_show_results_room_close_hides_answer_review_until_closed(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t); // show_results = room_close
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        $this->join($s, $a)->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/start")->assertStatus(200);
        $this->postJson("/api/student/activities/{$a->id}/quiz/finish")->assertStatus(200);

        // Room still open: summary only, no expected_output rows
        $state = $this->getJson("/api/student/activities/{$a->id}/quiz/state")->assertStatus(200);
        $this->assertSame('summary', $state->json('results.reveal'));
        collect($state->json('results.rows'))->each(function ($row) {
            $this->assertArrayNotHasKey('expected_output', $row);
        });

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$a->id}/end-live")->assertStatus(200);

        Sanctum::actingAs($s);
        $state = $this->getJson("/api/student/activities/{$a->id}/quiz/state")->assertStatus(200);
        $this->assertSame('full', $state->json('results.reveal'));
        $withExpected = collect($state->json('results.rows'))
            ->filter(fn ($row) => ! in_array($row['type'], ['essay', 'coding']))
            ->every(fn ($row) => array_key_exists('expected_output', $row));
        $this->assertTrue($withExpected);
    }

    public function test_non_enrolled_student_cannot_join(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $this->startRoom($a, $t);

        $outsider = $this->student();
        $this->join($outsider, $a)->assertStatus(403);
    }

    public function test_store_rejects_whole_quiz_timer_without_minutes(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        Sanctum::actingAs($t);

        $this->postJson("/api/teacher/classes/{$c->id}/activities", [
            'title' => 'Broken Timer Quiz',
            'activity_type' => 'quiz',
            'pacing_mode' => 'student',
            'timer_mode' => 'entire_quiz',
        ])->assertStatus(422)->assertJson(['message' => 'Set the minutes for the whole-quiz timer before publishing']);

        $this->postJson("/api/teacher/classes/{$c->id}/activities", [
            'title' => 'Good Timer Quiz',
            'activity_type' => 'quiz',
            'pacing_mode' => 'student',
            'timer_mode' => 'entire_quiz',
            'time_limit_minutes' => 10,
        ])->assertStatus(201);
    }

    public function test_publish_blocked_without_timer_minutes_or_questions(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);

        // Entire-quiz timer with no minutes must never reach students
        $noMinutes = ClassActivity::create([
            'class_id' => $c->id,
            'teacher_id' => $t->id,
            'title' => 'No Minutes',
            'activity_type' => 'quiz',
            'is_published' => false,
            'pacing_mode' => 'student',
            'timer_mode' => 'entire_quiz',
        ]);
        ActivityQuestion::create([
            'activity_id' => $noMinutes->id,
            'type' => 'true_false',
            'question_text' => 'True?',
            'options' => ['True', 'False'],
            'expected_output' => 'True',
            'points' => 1,
            'order_index' => 0,
        ]);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$noMinutes->id}/publish")
            ->assertStatus(422)->assertJson(['message' => 'Set the minutes for the whole-quiz timer before publishing']);
        $this->postJson("/api/teacher/activities/{$noMinutes->id}/start-live")
            ->assertStatus(422);

        // Quizzes with zero questions are equally unpublishable
        $noQuestions = ClassActivity::create([
            'class_id' => $c->id,
            'teacher_id' => $t->id,
            'title' => 'No Questions',
            'activity_type' => 'quiz',
            'is_published' => false,
            'pacing_mode' => 'student',
            'timer_mode' => 'none',
        ]);
        $this->postJson("/api/teacher/activities/{$noQuestions->id}/publish")
            ->assertStatus(422)->assertJson(['message' => 'Add at least one question before publishing the quiz']);

        // Once the minutes are set, publishing succeeds
        $noMinutes->update(['time_limit_minutes' => 10]);
        $this->postJson("/api/teacher/activities/{$noMinutes->id}/publish")->assertStatus(200);
    }

    public function test_manual_grading_cannot_credit_skipped_questions(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t); // MC, identification, enumeration, TF, essay — 10 pts
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        $this->join($s, $a)->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/start")->assertStatus(200);
        // Answer ONLY the MC and the essay; skip identification, enumeration, TF
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $this->questionId($a, 0),
            'submitted_answer' => '1',
        ])->assertStatus(200);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $this->questionId($a, 4),
            'submitted_answer' => 'Because Rayleigh scattering.',
        ])->assertStatus(200);
        $res = $this->postJson("/api/student/activities/{$a->id}/quiz/finish")->assertStatus(200);
        $submissionId = $res->json('submission.id');

        // Teacher grades: essay gets 2, but the payload also (like the old UI)
        // sends full points for the skipped questions — those have no answer
        // row and must not count toward the total.
        Sanctum::actingAs($t);
        $graded = $this->postJson("/api/teacher/activities/{$a->id}/submissions/{$submissionId}/grade", [
            'teacher_notes' => 'graded',
            'answers' => [
                ['question_id' => $this->questionId($a, 0), 'score' => 2],
                ['question_id' => $this->questionId($a, 1), 'score' => 2], // skipped
                ['question_id' => $this->questionId($a, 2), 'score' => 2], // skipped
                ['question_id' => $this->questionId($a, 3), 'score' => 2], // skipped
                ['question_id' => $this->questionId($a, 4), 'score' => 2],
            ],
        ])->assertStatus(200);

        $this->assertEquals(4.0, (float) $graded->json('score')); // 2 + essay 2 — skipped ignored
        $this->assertSame('graded', $graded->json('status'));
    }

    public function test_teacher_can_pause_and_resume_student_paced_quiz(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        $this->join($s, $a)->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/start")->assertStatus(200);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$a->id}/pause-live")
            ->assertStatus(200)
            ->assertJsonPath('activity.live_status', 'paused');

        Sanctum::actingAs($s);
        $this->getJson("/api/student/activities/{$a->id}/quiz/state")
            ->assertStatus(200)
            ->assertJsonPath('room_paused', true)
            ->assertJsonPath('room_live', false);

        // Everything is frozen: answering, advancing, finishing, starting
        $qid = $this->questionId($a, 0);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $qid,
            'submitted_answer' => '1',
        ])->assertStatus(422)->assertJson(['message' => 'Quiz is paused']);
        $this->postJson("/api/student/activities/{$a->id}/quiz/advance", [
            'current_question_idx' => 2,
        ])->assertStatus(422)->assertJson(['message' => 'Quiz is paused']);
        $this->postJson("/api/student/activities/{$a->id}/quiz/finish")
            ->assertStatus(422)->assertJson(['message' => 'Quiz is paused']);

        // A student who joined but hasn't started yet can't start either
        $latecomer = $this->student();
        $this->enroll($latecomer, $c);
        $this->join($latecomer, $a)->assertStatus(200);
        $this->postJson("/api/student/activities/{$a->id}/quiz/start")
            ->assertStatus(422)->assertJson(['message' => 'Quiz is paused']);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$a->id}/resume-live")
            ->assertStatus(200)
            ->assertJsonPath('activity.live_status', 'active');

        Sanctum::actingAs($s);
        $this->getJson("/api/student/activities/{$a->id}/quiz/state")
            ->assertStatus(200)
            ->assertJsonPath('room_paused', false)
            ->assertJsonPath('room_live', true);

        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $qid,
            'submitted_answer' => '1',
        ])->assertStatus(200);
    }

    public function test_pause_freezes_whole_quiz_timer_for_paused_duration(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t, ['timer_mode' => 'entire_quiz', 'time_limit_minutes' => 10]);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        $this->join($s, $a)->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/start")->assertStatus(200);

        // Pretend the student has been working for 100s of the 600s limit
        $submission = $a->submissions()->where('student_id', $s->id)->first();
        $originalStart = now()->subSeconds(100);
        $submission->update(['started_at' => $originalStart]);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$a->id}/pause-live")->assertStatus(200);
        sleep(2);
        $this->postJson("/api/teacher/activities/{$a->id}/resume-live")->assertStatus(200);

        // started_at was shifted forward by the pause (~2s), so the student
        // still has ~500s — not 500 minus the time spent paused.
        Sanctum::actingAs($s);
        $remaining = $this->getJson("/api/student/activities/{$a->id}/quiz/state")
            ->assertStatus(200)
            ->json('remaining_seconds');

        $this->assertEqualsWithDelta(500, $remaining, 2.5);
    }
}
