<?php

namespace Tests\Feature;

use App\Models\ActivityQuestion;
use App\Models\ClassActivity;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Module;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MultiLanguageExecutionTest extends TestCase
{
    use RefreshDatabase;

    // ---------- Student execute proxy ----------

    public function test_execute_rejects_unsupported_language(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/student/execute', [
            'language' => 'ruby',
            'code' => 'puts 1',
        ])->assertStatus(422);
    }

    public function test_execute_tells_client_html_is_preview_only(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/student/execute', [
            'language' => 'html',
            'code' => '<h1>Hi</h1>',
        ])->assertStatus(200)->assertJson(['preview_only' => true]);
    }

    public function test_execute_proxies_language_to_engine(): void
    {
        Http::fake([
            'http://localhost:3000/*' => Http::response(['stdout' => 'Hello from Python', 'stderr' => '', 'compile_output' => '']),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/student/execute', [
            'language' => 'python',
            'code' => 'print("Hello from Python")',
            'input' => "line one\n",
        ])->assertStatus(200)->assertJson(['stdout' => 'Hello from Python']);

        // TrimStrings strips the trailing newline at the API edge
        Http::assertSent(function ($request) {
            return $request->url() === 'http://localhost:3000/execute'
                && $request['language'] === 'python'
                && $request['input'] === 'line one';
        });
    }

    public function test_execute_falls_back_to_deployed_engine(): void
    {
        Http::fake([
            'http://localhost:3000/*' => Http::response('down', 500),
            'https://engine.test/*' => Http::response(['stdout' => 'deployed!', 'stderr' => '', 'compile_output' => '']),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/student/execute', [
            'language' => 'python',
            'code' => 'print("deployed!")',
        ])->assertStatus(200)->assertJson(['stdout' => 'deployed!']);

        Http::assertSent(fn ($request) => $request->url() === 'https://engine.test/execute');
    }

    public function test_execute_returns_503_when_every_engine_is_down(): void
    {
        Http::fake([
            'http://localhost:3000/*' => Http::response('down', 500),
            'https://engine.test/*' => Http::response('down', 500),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/student/execute', [
            'language' => 'javascript',
            'code' => 'console.log(1)',
        ])->assertStatus(503);
    }

    public function test_java_code_is_preprocessed_for_the_engine(): void
    {
        Http::fake([
            'http://localhost:3000/*' => Http::response(['stdout' => '', 'stderr' => '', 'compile_output' => '']),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/student/execute', [
            'language' => 'java',
            'code' => 'public class HelloWorld { public static void main(String[] args) {} }',
        ])->assertStatus(200);

        Http::assertSent(function ($request) {
            return str_contains($request['code'], 'class Main {')
                && ! str_contains($request['code'], 'HelloWorld');
        });
    }

    public function test_python_code_is_sent_untouched(): void
    {
        Http::fake([
            'http://localhost:3000/*' => Http::response(['stdout' => '', 'stderr' => '', 'compile_output' => '']),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $code = "class Dog:\n    pass";
        $this->postJson('/api/student/execute', ['language' => 'python', 'code' => $code])->assertStatus(200);

        Http::assertSent(fn ($request) => $request['code'] === $code);
    }

    public function test_verify_code_challenge_forwards_language(): void
    {
        Http::fake([
            'http://ai.test/*' => Http::response(['passed' => true, 'reason' => 'ok']),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/ai/verify-code-challenge', [
            'question_text' => 'Print hello',
            'code' => 'print("hello")',
            'expected_output' => 'hello',
            'language' => 'python',
        ])->assertStatus(200)->assertJson(['passed' => true]);

        Http::assertSent(function ($request) {
            return $request->url() === 'http://ai.test/ai/verify-code-challenge'
                && $request['language'] === 'python';
        });
    }

    // ---------- Quiz question language ----------

    private function quizForTeacher(): array
    {
        $teacher = User::factory()->create(['role' => 'teacher']);
        $classroom = Classroom::create(['teacher_id' => $teacher->id, 'name' => 'C', 'class_code' => '111111']);
        $course = Course::create([
            'teacher_id' => $teacher->id,
            'class_id' => $classroom->id,
            'title' => 'Course',
            'order_index' => 0,
        ]);
        $module = Module::create(['course_id' => $course->id, 'title' => 'M', 'order_index' => 0]);
        $quiz = Quiz::create(['module_id' => $module->id, 'title' => 'Q', 'order_index' => 0]);

        return [$teacher, $quiz];
    }

    public function test_teacher_can_set_coding_question_language(): void
    {
        [$teacher, $quiz] = $this->quizForTeacher();
        Sanctum::actingAs($teacher);

        $question = Question::create([
            'quiz_id' => $quiz->id,
            'type' => 'coding',
            'question_text' => 'Sum two numbers',
            'options' => [],
            'expected_output' => '3',
            'points' => 5,
            'order_index' => 1,
        ]);

        $this->putJson("/api/teacher/questions/{$question->id}", [
            'language' => 'python',
            'boilerplate' => "def sum_two(a, b):\n    pass\n",
        ])->assertStatus(200)->assertJsonPath('language', 'python');

        $this->putJson("/api/teacher/questions/{$question->id}", [
            'language' => 'ruby',
        ])->assertStatus(422);
    }

    public function test_student_quiz_payload_includes_language(): void
    {
        [$teacher, $quiz] = $this->quizForTeacher();
        $quiz->update(['is_published' => true]);

        Question::create([
            'quiz_id' => $quiz->id,
            'type' => 'coding',
            'question_text' => 'Say hi in Python',
            'options' => [],
            'expected_output' => 'hi',
            'boilerplate' => '# write here',
            'language' => 'python',
            'points' => 5,
            'order_index' => 1,
        ]);

        $student = User::factory()->create(['role' => 'student']);
        Sanctum::actingAs($student);

        $res = $this->getJson("/api/student/quizzes/{$quiz->id}")->assertStatus(200);
        $this->assertSame('python', $res->json('quiz.questions.0.language'));
    }

    // ---------- Activity question language ----------

    private function activityForTeacher(): array
    {
        $teacher = User::factory()->create(['role' => 'teacher']);
        $classroom = Classroom::create(['teacher_id' => $teacher->id, 'name' => 'C', 'class_code' => '222222']);
        $activity = ClassActivity::create([
            'class_id' => $classroom->id,
            'teacher_id' => $teacher->id,
            'title' => 'Activity',
            'activity_type' => 'assignment',
            'grading_method' => 'manual',
            'submission_type' => 'questions',
        ]);

        return [$teacher, $classroom, $activity];
    }

    public function test_activity_coding_question_persists_language(): void
    {
        [$teacher, , $activity] = $this->activityForTeacher();
        Sanctum::actingAs($teacher);

        $created = $this->postJson("/api/teacher/activities/{$activity->id}/questions", [
            'type' => 'coding',
            'question_text' => 'Build a page',
            'language' => 'html',
            'boilerplate' => '<h1>Hello</h1>',
            'expected_output' => 'The page must contain a heading saying Hello',
            'points' => 10,
        ])->assertStatus(201)->assertJsonPath('language', 'html');

        $this->putJson("/api/teacher/activities/{$activity->id}/questions/{$created->json('id')}", [
            'language' => 'cpp',
        ])->assertStatus(200)->assertJsonPath('language', 'cpp');

        $this->postJson("/api/teacher/activities/{$activity->id}/questions", [
            'type' => 'coding',
            'question_text' => 'Bad language',
            'language' => 'go',
            'points' => 1,
        ])->assertStatus(422);
    }

    public function test_student_activity_payload_includes_language(): void
    {
        [$teacher, $classroom, $activity] = $this->activityForTeacher();

        ActivityQuestion::create([
            'activity_id' => $activity->id,
            'type' => 'coding',
            'question_text' => 'JS task',
            'language' => 'javascript',
            'boilerplate' => 'console.log("hi");',
            'expected_output' => 'hi',
            'points' => 5,
            'order_index' => 1,
        ]);

        $student = User::factory()->create(['role' => 'student']);
        Enrollment::create(['student_id' => $student->id, 'class_id' => $classroom->id]);
        Sanctum::actingAs($student);

        $res = $this->getJson("/api/student/activities/{$activity->id}")->assertStatus(200);
        $this->assertSame('javascript', $res->json('activity.questions.0.language'));
    }
}
