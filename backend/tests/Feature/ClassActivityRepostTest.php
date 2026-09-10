<?php

namespace Tests\Feature;

use App\Models\ActivityQuestion;
use App\Models\ClassActivity;
use App\Models\Classroom;
use App\Models\QuestionTestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClassActivityRepostTest extends TestCase
{
    use RefreshDatabase;

    private function teacher(): User
    {
        return User::factory()->create(['role' => 'teacher']);
    }

    private function classroomFor(User $teacher, string $name = 'Test Class'): Classroom
    {
        return Classroom::create([
            'teacher_id' => $teacher->id,
            'name' => $name,
            'class_code' => (string) random_int(100000, 999999),
        ]);
    }

    private function liveQuiz(Classroom $class, User $teacher): ClassActivity
    {
        $activity = ClassActivity::create([
            'class_id' => $class->id,
            'teacher_id' => $teacher->id,
            'title' => 'Midterm Quiz',
            'description' => 'Chapters 1-3',
            'activity_type' => 'quiz',
            'grading_method' => 'auto',
            'max_points' => 10,
            'is_published' => true,
            'is_live' => true,
            'live_status' => 'active',
            'live_started_at' => now(),
            'live_current_q' => 2,
            'pacing_mode' => 'teacher',
            'timer_mode' => 'none',
            'show_results' => 'immediate',
            'shuffle_questions' => false,
            'order_index' => 3,
        ]);

        $mc = ActivityQuestion::create([
            'activity_id' => $activity->id,
            'type' => 'multiple_choice',
            'question_text' => 'Pick Beta?',
            'options' => ['Alpha', 'Beta', 'Gamma'],
            'expected_output' => '1',
            'points' => 5,
            'order_index' => 0,
        ]);

        $coding = ActivityQuestion::create([
            'activity_id' => $activity->id,
            'type' => 'coding',
            'question_text' => 'Sum two numbers.',
            'language' => 'python',
            'boilerplate' => 'def solve(a, b):',
            'expected_output' => '3',
            'points' => 5,
            'order_index' => 1,
        ]);

        QuestionTestCase::create([
            'testable_type' => ActivityQuestion::class,
            'testable_id' => $coding->id,
            'input' => '1\n2',
            'expected_output' => '3',
            'hidden' => false,
            'order_index' => 0,
        ]);
        QuestionTestCase::create([
            'testable_type' => ActivityQuestion::class,
            'testable_id' => $coding->id,
            'input' => '-1\n4',
            'expected_output' => '3',
            'hidden' => true,
            'order_index' => 1,
        ]);

        return $activity->fresh();
    }

    public function test_teacher_reposts_quiz_to_another_class(): void
    {
        $t = $this->teacher();
        $source = $this->classroomFor($t, 'Section A');
        $target = $this->classroomFor($t, 'Section B');
        $quiz = $this->liveQuiz($source, $t);

        Sanctum::actingAs($t);
        $res = $this->postJson("/api/teacher/activities/{$quiz->id}/repost", [
            'class_id' => $target->id,
        ])->assertStatus(201);

        $cloneId = $res->json('activity.id');
        $this->assertNotSame($quiz->id, $cloneId);

        $clone = ClassActivity::with('questions')->findOrFail($cloneId);
        $this->assertSame($target->id, $clone->class_id);
        $this->assertSame($t->id, $clone->teacher_id);
        $this->assertSame('Midterm Quiz', $clone->title);
        $this->assertSame('teacher', $clone->pacing_mode);
        $this->assertFalse($clone->is_published, 'Re-posted quiz starts as a draft');
        $this->assertFalse($clone->is_live);
        $this->assertSame('scheduled', $clone->live_status);
        $this->assertNull($clone->live_started_at);
        $this->assertNull($clone->live_question_deadline_at);
        $this->assertNull($clone->close_room_at);
        $this->assertSame(1, $clone->order_index, 'Clone lands at the end of the target class');

        $this->assertCount(2, $clone->questions);
        $clonedCoding = $clone->questions->firstWhere('type', 'coding');
        $this->assertSame('def solve(a, b):', $clonedCoding->boilerplate);
        $this->assertCount(2, $clonedCoding->testCases, 'Coding test cases are cloned too');
        $this->assertSame(
            $clonedCoding->id,
            $clonedCoding->testCases->first()->testable_id,
            'Cloned test cases point at the cloned question'
        );

        // Original is untouched — still live, still published
        $original = $quiz->fresh(['questions']);
        $this->assertTrue($original->is_live);
        $this->assertTrue($original->is_published);
        $this->assertCount(2, $original->questions);
    }

    public function test_repost_rejected_for_same_class(): void
    {
        $t = $this->teacher();
        $class = $this->classroomFor($t);
        $quiz = $this->liveQuiz($class, $t);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$quiz->id}/repost", [
            'class_id' => $class->id,
        ])->assertStatus(422);
    }

    public function test_repost_rejected_for_another_teachers_class(): void
    {
        $t = $this->teacher();
        $other = $this->teacher();
        $class = $this->classroomFor($t);
        $foreignClass = $this->classroomFor($other, 'Not Mine');
        $quiz = $this->liveQuiz($class, $t);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$quiz->id}/repost", [
            'class_id' => $foreignClass->id,
        ])->assertStatus(403);
    }

    public function test_repost_requires_class_id(): void
    {
        $t = $this->teacher();
        $class = $this->classroomFor($t);
        $quiz = $this->liveQuiz($class, $t);

        Sanctum::actingAs($t);
        $this->postJson("/api/teacher/activities/{$quiz->id}/repost", [])
            ->assertStatus(422);
    }
}
