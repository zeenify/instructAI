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

class LiveTeacherPacedQuizTest extends TestCase
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
            'title' => 'Live Quiz',
            'activity_type' => 'quiz',
            'grading_method' => 'auto',
            'is_published' => true,
            'pacing_mode' => 'teacher',
            'timer_mode' => 'none',
            'show_results' => 'immediate',
            'shuffle_questions' => false,
            'max_points' => 15,
        ], $overrides));

        $questions = [
            ['type' => 'multiple_choice', 'question_text' => 'Pick Beta?', 'options' => ['Alpha', 'Beta', 'Gamma'], 'expected_output' => '1', 'points' => 5, 'order_index' => 0],
            ['type' => 'true_false', 'question_text' => 'True?', 'options' => null, 'expected_output' => 'True', 'points' => 5, 'order_index' => 1],
            ['type' => 'identification', 'question_text' => 'Name?', 'options' => null, 'expected_output' => 'answer', 'points' => 5, 'order_index' => 2],
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

    private function setQuestion(ClassActivity $activity, int $idx, ?int $duration = null)
    {
        $payload = ['idx' => $idx];
        if ($duration !== null) {
            $payload['duration'] = $duration;
        }

        return $this->postJson("/api/teacher/activities/{$activity->id}/live/question", $payload);
    }

    private function joinAndStart(User $student, ClassActivity $activity)
    {
        Sanctum::actingAs($student);
        $this->postJson("/api/student/activities/{$activity->id}/quiz/join")->assertStatus(200);
        $this->postJson("/api/student/activities/{$activity->id}/quiz/start")->assertStatus(200);
    }

    public function test_teacher_sets_current_question(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $this->startRoom($a, $t);

        Sanctum::actingAs($t);
        $res = $this->setQuestion($a, 1)->assertStatus(200);

        $this->assertSame(1, $res->json('activity.live_current_q'));
        $this->assertNull($res->json('activity.live_question_revealed_at'));
    }

    public function test_teacher_cannot_set_out_of_range_question(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $this->startRoom($a, $t);

        Sanctum::actingAs($t);
        $this->setQuestion($a, 99)->assertStatus(422);
        $this->setQuestion($a, -1)->assertStatus(422);
    }

    public function test_cannot_set_question_when_room_not_live(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);

        Sanctum::actingAs($t);
        $this->setQuestion($a, 0)->assertStatus(422);
    }

    public function test_non_owning_teacher_rejected(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $this->startRoom($a, $t);

        $other = $this->teacher();
        Sanctum::actingAs($other);
        $this->setQuestion($a, 0)->assertStatus(404);
    }

    public function test_student_advance_rejected_in_teacher_mode(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);

        $this->joinAndStart($s, $a);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/advance", ['current_question_idx' => 1])
            ->assertStatus(422);
    }

    public function test_student_answer_gated_to_current_question(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        Sanctum::actingAs($t);
        $this->setQuestion($a, 0)->assertStatus(200);

        $this->joinAndStart($s, $a);

        $questions = $a->questions()->get();
        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $questions[1]->id,
            'submitted_answer' => 'True',
        ])->assertStatus(422);

        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $questions[0]->id,
            'submitted_answer' => '1',
        ])->assertStatus(200);

        $this->assertDatabaseHas('activity_answers', [
            'question_id' => $questions[0]->id,
            'submitted_answer' => '1',
        ]);
    }

    public function test_reveal_grades_and_locks_question(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        Sanctum::actingAs($t);
        $this->setQuestion($a, 0)->assertStatus(200);

        $this->joinAndStart($s, $a);

        $questions = $a->questions()->get();
        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $questions[0]->id,
            'submitted_answer' => '1',
        ])->assertStatus(200);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$a->id}/live/reveal")->assertStatus(200);

        $answer = ActivityAnswer::where('question_id', $questions[0]->id)->firstOrFail();
        $this->assertTrue((bool) $answer->is_correct);
        $this->assertSame(5.0, (float) $answer->score);

        $this->postJson("/api/teacher/activities/{$a->id}/live/reveal")->assertStatus(422);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $questions[0]->id,
            'submitted_answer' => '2',
        ])->assertStatus(422);
    }

    public function test_state_exposes_phase_and_feedback(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        Sanctum::actingAs($t);
        $this->setQuestion($a, 0)->assertStatus(200);

        $this->joinAndStart($s, $a);

        $questions = $a->questions()->get();
        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $questions[0]->id,
            'submitted_answer' => '1',
        ])->assertStatus(200);

        $state = $this->getJson("/api/student/activities/{$a->id}/quiz/state")
            ->assertStatus(200)
            ->assertJsonPath('teacher_phase', 'question')
            ->assertJsonPath('live_current_q', 0)
            ->assertJsonPath('current_question_feedback', null);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$a->id}/live/reveal")->assertStatus(200);

        Sanctum::actingAs($s);
        $this->getJson("/api/student/activities/{$a->id}/quiz/state")
            ->assertStatus(200)
            ->assertJsonPath('teacher_phase', 'revealed')
            ->assertJsonPath('current_question_feedback.is_correct', true)
            ->assertJsonPath('current_question_feedback.correct_answer', '1')
            ->assertJsonPath('current_question_feedback.answered', true);
    }

    public function test_unlaunched_room_shows_waiting_phase(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);

        $this->joinAndStart($s, $a);

        $questions = $a->questions()->get();
        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $questions[0]->id,
            'submitted_answer' => '1',
        ])->assertStatus(422);

        $this->getJson("/api/student/activities/{$a->id}/quiz/state")
            ->assertStatus(200)
            ->assertJsonPath('teacher_phase', 'waiting');
    }

    public function test_countdown_expiry_auto_reveals(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        Sanctum::actingAs($t);
        $this->setQuestion($a, 0, 5)->assertStatus(200);

        $this->joinAndStart($s, $a);

        sleep(6);

        Sanctum::actingAs($s);
        $this->getJson("/api/student/activities/{$a->id}/quiz/state")
            ->assertStatus(200)
            ->assertJsonPath('teacher_phase', 'revealed');
    }

    public function test_skipped_question_scores_zero_at_room_close(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        Sanctum::actingAs($t);
        $this->setQuestion($a, 0)->assertStatus(200);

        $this->joinAndStart($s, $a);

        $questions = $a->questions()->get();
        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $questions[0]->id,
            'submitted_answer' => '1',
        ])->assertStatus(200);

        Sanctum::actingAs($t);
        $this->setQuestion($a, 2)->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $questions[2]->id,
            'submitted_answer' => 'answer',
        ])->assertStatus(200);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$a->id}/end-live")
            ->assertStatus(200)
            ->assertJsonPath('finalized', 1)
            ->assertJsonPath('missed', 0);

        $this->assertDatabaseHas('activity_submissions', [
            'activity_id' => $a->id,
            'status' => 'graded',
            'score' => 10,
            'max_score' => 15,
        ]);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/finish")->assertStatus(422);

        $this->getJson("/api/student/activities/{$a->id}/quiz/state")
            ->assertStatus(200)
            ->assertJsonPath('finalized', true)
            ->assertJsonPath('results.status', 'graded');
    }

    public function test_late_join_syncs_to_teacher_current_question(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        Sanctum::actingAs($t);
        $this->setQuestion($a, 1)->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/join")
            ->assertStatus(200)
            ->assertJsonPath('submission.current_question_idx', 1);
    }

    public function test_non_enrolled_student_rejected(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->startRoom($a, $t);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/join")->assertStatus(403);
    }

    public function test_room_close_hides_feedback_until_reveal(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t, ['show_results' => 'room_close']);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        Sanctum::actingAs($t);
        $this->setQuestion($a, 0)->assertStatus(200);

        $this->joinAndStart($s, $a);

        Sanctum::actingAs($s);
        $this->getJson("/api/student/activities/{$a->id}/quiz/state")
            ->assertStatus(200)
            ->assertJsonPath('teacher_phase', 'question')
            ->assertJsonPath('current_question_feedback', null);
    }

    public function test_teacher_pauses_room_and_student_answers_blocked(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        Sanctum::actingAs($t);
        $this->setQuestion($a, 0)->assertStatus(200);

        $this->joinAndStart($s, $a);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$a->id}/pause-live")
            ->assertStatus(200)
            ->assertJsonPath('activity.live_status', 'paused');

        Sanctum::actingAs($s);
        $this->getJson("/api/student/activities/{$a->id}/quiz/state")
            ->assertStatus(200)
            ->assertJsonPath('room_paused', true)
            ->assertJsonPath('teacher_phase', 'paused');

        $questions = $a->questions()->get();
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $questions[0]->id,
            'submitted_answer' => '1',
        ])->assertStatus(422);
    }

    public function test_teacher_resumes_room_and_answers_work_again(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        Sanctum::actingAs($t);
        $this->setQuestion($a, 0)->assertStatus(200);

        $this->joinAndStart($s, $a);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$a->id}/pause-live")->assertStatus(200);
        $this->postJson("/api/teacher/activities/{$a->id}/resume-live")
            ->assertStatus(200)
            ->assertJsonPath('activity.live_status', 'active');

        Sanctum::actingAs($s);
        $this->getJson("/api/student/activities/{$a->id}/quiz/state")
            ->assertStatus(200)
            ->assertJsonPath('room_paused', false)
            ->assertJsonPath('teacher_phase', 'question');

        $questions = $a->questions()->get();
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $questions[0]->id,
            'submitted_answer' => '1',
        ])->assertStatus(200);
    }

    public function test_student_can_join_while_paused(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        Sanctum::actingAs($t);
        $this->setQuestion($a, 1)->assertStatus(200);
        $this->postJson("/api/teacher/activities/{$a->id}/pause-live")->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/join")
            ->assertStatus(200)
            ->assertJsonPath('room_paused', true)
            ->assertJsonPath('teacher_phase', 'paused');
    }

    public function test_pause_rejected_when_not_live(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$a->id}/pause-live")->assertStatus(422);

        $a2 = $this->quiz($c, $t);
        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$a2->id}/pause-live")->assertStatus(422);
    }

    public function test_resume_extends_current_question_deadline_for_pause_duration(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $this->startRoom($a, $t);
        Sanctum::actingAs($t);
        $this->setQuestion($a, 0)->assertStatus(200);

        $a->update(['live_question_deadline_at' => now()->addSeconds(60)]);
        $deadlineBeforePause = $a->fresh()->live_question_deadline_at;

        $this->postJson("/api/teacher/activities/{$a->id}/pause-live")->assertStatus(200);
        sleep(2);
        $this->postJson("/api/teacher/activities/{$a->id}/resume-live")->assertStatus(200);

        $deadlineAfterResume = $a->fresh()->live_question_deadline_at;
        $this->assertTrue(
            $deadlineAfterResume->gt($deadlineBeforePause),
            'Resume should push the deadline forward by the paused duration'
        );
        $this->assertNull($a->fresh()->live_paused_at);
    }

    public function test_live_board_reports_paused_phase(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $this->startRoom($a, $t);
        Sanctum::actingAs($t);
        $this->setQuestion($a, 0)->assertStatus(200);
        $this->postJson("/api/teacher/activities/{$a->id}/pause-live")->assertStatus(200);

        $board = $this->getJson("/api/teacher/activities/{$a->id}/live-board")->assertStatus(200);
        $this->assertSame('paused', $board->json('pacing.phase'));
    }

    public function test_student_finish_rejected_until_room_closed(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);

        $this->joinAndStart($s, $a);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/finish")->assertStatus(422);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$a->id}/end-live")->assertStatus(200);

        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/finish")->assertStatus(422);

        $this->getJson("/api/student/activities/{$a->id}/quiz/state")
            ->assertStatus(200)
            ->assertJsonPath('finalized', true);
    }

    public function test_live_board_exposes_pacing_and_distribution(): void
    {
        $t = $this->teacher();
        $c = $this->classroomFor($t);
        $a = $this->quiz($c, $t);
        $s = $this->student();
        $this->enroll($s, $c);
        $this->startRoom($a, $t);
        Sanctum::actingAs($t);
        $this->setQuestion($a, 0)->assertStatus(200);

        $this->joinAndStart($s, $a);

        $questions = $a->questions()->get();
        Sanctum::actingAs($s);
        $this->postJson("/api/student/activities/{$a->id}/quiz/answers", [
            'question_id' => $questions[0]->id,
            'submitted_answer' => '1',
        ])->assertStatus(200);

        Sanctum::actingAs($t);
        $board = $this->getJson("/api/teacher/activities/{$a->id}/live-board")->assertStatus(200);

        $this->assertSame('teacher', $board->json('pacing.mode'));
        $this->assertSame(0, $board->json('pacing.current_q'));
        $this->assertSame('question', $board->json('pacing.phase'));
        $this->assertSame(1, $board->json('distribution.0.answered'));
        // per_option keys are the option TEXT (not raw indices) so chips read as labels
        $this->assertSame(1, $board->json('distribution.0.per_option.Beta'));
        $this->assertCount(3, $board->json('questions'));
        $this->assertSame(0, $board->json('students.0.running_score'));

        $this->postJson("/api/teacher/activities/{$a->id}/live/reveal")->assertStatus(200);

        $board = $this->getJson("/api/teacher/activities/{$a->id}/live-board")->assertStatus(200);
        $this->assertEquals(5, $board->json('students.0.running_score'));
    }
}
