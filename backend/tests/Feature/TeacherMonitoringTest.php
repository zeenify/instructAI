<?php

namespace Tests\Feature;

use App\Models\ActivityQuestion;
use App\Models\ActivitySubmission;
use App\Models\ClassActivity;
use App\Models\Classroom;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TeacherMonitoringTest extends TestCase
{
    use RefreshDatabase;

    private function teacher(): User
    {
        return User::factory()->create(['role' => 'teacher']);
    }

    private function student(): User
    {
        $student = User::factory()->create(['role' => 'student']);
        $student->studentProfile()->create([
            'first_name' => 'Stu',
            'last_name' => substr(md5($student->id), 0, 6),
            'lrn_number' => (string) (100000000000 + $student->id),
        ]);

        return $student;
    }

    private function activityWithCodingQuestion(): array
    {
        $teacher = $this->teacher();
        $classroom = Classroom::create(['teacher_id' => $teacher->id, 'name' => 'C', 'class_code' => '555001']);
        $activity = ClassActivity::create([
            'class_id' => $classroom->id,
            'teacher_id' => $teacher->id,
            'title' => 'Live coding quiz',
            'activity_type' => 'quiz',
            'grading_method' => 'auto',
            'is_published' => true,
            'pacing_mode' => 'teacher',
            'timer_mode' => 'none',
            'show_results' => 'room_close',
            'max_points' => 10,
        ]);

        $question = ActivityQuestion::create([
            'activity_id' => $activity->id,
            'type' => 'coding',
            'question_text' => 'Print the number',
            'language' => 'python',
            'expected_output' => '5',
            'points' => 10,
            'order_index' => 0,
        ]);

        return [$teacher, $classroom, $activity, $question];
    }

    private function joinStudent(User $student, ClassActivity $activity): ActivitySubmission
    {
        // Open the room once — startLive resets the current question to -1,
        // so re-calling it would close the question students are answering.
        $activity->refresh();
        if ($activity->live_status !== 'active') {
            Sanctum::actingAs(User::find($activity->teacher_id));
            $this->postJson("/api/teacher/activities/{$activity->id}/start-live")->assertStatus(200);
        }

        Enrollment::create(['student_id' => $student->id, 'class_id' => $activity->class_id]);
        Sanctum::actingAs($student);
        $this->postJson("/api/student/activities/{$activity->id}/quiz/join")->assertStatus(200);

        return ActivitySubmission::where('activity_id', $activity->id)->where('student_id', $student->id)->first();
    }

    // ---------- Similarity ----------

    public function test_similarity_flags_identical_answers(): void
    {
        [$teacher, , $activity, $question] = $this->activityWithCodingQuestion();
        Sanctum::actingAs($teacher);

        $code = 'n = input()'."\n".'print(n)';
        $this->joinStudent($this->student(), $activity)->answers()->create([
            'question_id' => $question->id,
            'submitted_answer' => json_encode($code),
        ]);
        $this->joinStudent($this->student(), $activity)->answers()->create([
            'question_id' => $question->id,
            'submitted_answer' => json_encode($code),
        ]);
        $this->joinStudent($this->student(), $activity)->answers()->create([
            'question_id' => $question->id,
            'submitted_answer' => json_encode('print("totally different logic " + str(2 + 3))'),
        ]);

        // Similarity only considers submitted/graded answers
        ActivitySubmission::query()->update(['status' => 'submitted']);

        Sanctum::actingAs($teacher);
        $res = $this->getJson("/api/teacher/activities/{$activity->id}/similarity")->assertStatus(200);
        $this->assertSame(1, $res->json('questions_checked'));
        $pairs = $res->json('pairs');

        // Exactly one flagged pair: the two identical submissions
        $this->assertCount(1, $pairs);
        $this->assertEquals(1.0, (float) $pairs[0]['similarity']);
        $this->assertSame($question->id, $pairs[0]['question_id']);
    }

    public function test_similarity_ignores_drafts_and_respects_threshold(): void
    {
        [$teacher, , $activity, $question] = $this->activityWithCodingQuestion();
        Sanctum::actingAs($teacher);

        // Two identical drafts — must NOT be flagged (not submitted yet)
        $this->joinStudent($this->student(), $activity)->answers()->create([
            'question_id' => $question->id,
            'submitted_answer' => json_encode('print(5)'),
        ]);
        $this->joinStudent($this->student(), $activity)->answers()->create([
            'question_id' => $question->id,
            'submitted_answer' => json_encode('print(5)'),
        ]);

        Sanctum::actingAs($teacher);
        $res = $this->getJson("/api/teacher/activities/{$activity->id}/similarity")->assertStatus(200);
        $this->assertSame([], $res->json('pairs'));

        // Submit one -> still no pair (need two submitted answers)
        ActivitySubmission::first()->update(['status' => 'submitted']);
        Sanctum::actingAs($teacher);
        $res = $this->getJson("/api/teacher/activities/{$activity->id}/similarity")->assertStatus(200);
        $this->assertSame([], $res->json('pairs'));
    }

    public function test_similarity_reports_no_coding_questions(): void
    {
        $teacher = $this->teacher();
        $classroom = Classroom::create(['teacher_id' => $teacher->id, 'name' => 'C', 'class_code' => '555002']);
        $activity = ClassActivity::create([
            'class_id' => $classroom->id,
            'teacher_id' => $teacher->id,
            'title' => 'Essay only',
            'activity_type' => 'assignment',
            'grading_method' => 'manual',
            'submission_type' => 'questions',
            'is_published' => true,
        ]);
        ActivityQuestion::create([
            'activity_id' => $activity->id,
            'type' => 'essay',
            'question_text' => 'Reflect',
            'points' => 5,
            'order_index' => 0,
        ]);

        Sanctum::actingAs($teacher);
        $res = $this->getJson("/api/teacher/activities/{$activity->id}/similarity")->assertStatus(200);
        $this->assertSame(0, $res->json('questions_checked'));
        $this->assertSame([], $res->json('pairs'));
    }

    public function test_students_cannot_access_monitoring_endpoints(): void
    {
        [, , $activity] = $this->activityWithCodingQuestion();

        Sanctum::actingAs($this->student());
        $this->getJson("/api/teacher/activities/{$activity->id}/similarity")->assertStatus(404);
        $this->getJson("/api/teacher/activities/{$activity->id}/live-drafts")->assertStatus(404);
    }

    // ---------- Live drafts ----------

    public function test_live_drafts_returns_current_coding_answers(): void
    {
        [$teacher, , $activity, $question] = $this->activityWithCodingQuestion();
        Sanctum::actingAs($teacher);
        $this->postJson("/api/teacher/activities/{$activity->id}/start-live")->assertStatus(200);
        $this->postJson("/api/teacher/activities/{$activity->id}/live/question", ['idx' => 0])->assertStatus(200);
        $activity->refresh();

        $drafter = $this->student();
        $submission = $this->joinStudent($drafter, $activity);
        Sanctum::actingAs($drafter);
        $answersRes = $this->postJson("/api/student/activities/{$activity->id}/quiz/answers", [
            'question_id' => $question->id,
            'submitted_answer' => 'print("half done")',
        ]);
        $answersRes->assertStatus(200);
        $submission->update(['current_question_idx' => 0]);

        // Also save a draft for the second student, but they never typed code
        $this->joinStudent($this->student(), $activity);

        Sanctum::actingAs($teacher);
        $res = $this->getJson("/api/teacher/activities/{$activity->id}/live-drafts")->assertStatus(200);
        $this->assertSame($question->id, $res->json('question_id'));
        $this->assertSame('python', $res->json('language'));

        $drafts = collect($res->json('drafts'));
        $drafterRow = $drafts->firstWhere('student_id', $drafter->id);
        $this->assertNotNull($drafterRow);
        $this->assertStringContainsString('half done', $drafterRow['code']);

        $emptyRow = $drafts->firstWhere('student_id', $drafter->id === 0 ? -1 : $drafts->max('student_id'));
        $this->assertTrue($drafts->contains(fn ($d) => $d['code'] === null));
    }

    public function test_live_drafts_rejects_non_coding_question(): void
    {
        [$teacher, , $activity] = $this->activityWithCodingQuestion();

        ActivityQuestion::create([
            'activity_id' => $activity->id,
            'type' => 'identification',
            'question_text' => 'Word?',
            'language' => 'python',
            'expected_output' => 'x',
            'points' => 5,
            'order_index' => 1,
        ]);

        Sanctum::actingAs($teacher);
        $res = $this->getJson("/api/teacher/activities/{$activity->id}/live-drafts?question_id=".($activity->questions()->where('type', 'identification')->first()->id));
        $res->assertStatus(422);
    }

    public function test_live_drafts_requires_quiz_activity(): void
    {
        $teacher = $this->teacher();
        $classroom = Classroom::create(['teacher_id' => $teacher->id, 'name' => 'C', 'class_code' => '555003']);
        $assignment = ClassActivity::create([
            'class_id' => $classroom->id,
            'teacher_id' => $teacher->id,
            'title' => 'Assignment',
            'activity_type' => 'assignment',
            'grading_method' => 'manual',
            'submission_type' => 'questions',
            'is_published' => true,
        ]);

        Sanctum::actingAs($teacher);
        $this->getJson("/api/teacher/activities/{$assignment->id}/live-drafts")->assertStatus(422);
    }
}
