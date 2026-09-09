<?php

namespace Tests\Feature;

use App\Models\ClassActivity;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Module;
use App\Models\Question;
use App\Models\QuestionTestCase;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TestCaseGradingTest extends TestCase
{
    use RefreshDatabase;

    // Http::fake() accumulates across calls, so ONE fake per test reads from
    // these mutable fields instead of being re-registered.
    protected array $engineQueue = [];
    protected int $engineCursor = 0;
    protected ?array $aiBatchResponse = null; // null => AI service unreachable
    protected bool $engineDown = false;

    private function queueEngine(array $outputs): void
    {
        $this->engineQueue = $outputs;
        $this->engineCursor = 0;
        $this->fakeHttp();
    }

    private function fakeHttp(): void
    {
        Http::fake(function ($request) {
            if (str_contains($request->url(), 'ai.test')) {
                if ($this->aiBatchResponse === null) {
                    return Http::response('ai unreachable', 500);
                }

                return Http::response($this->aiBatchResponse);
            }

            if ($this->engineDown) {
                return Http::response('down', 500);
            }

            $stdout = $this->engineQueue[$this->engineCursor] ?? '';
            $this->engineCursor++;

            return Http::response(['stdout' => $stdout, 'stderr' => '', 'compile_output' => '', 'exit_code' => 0]);
        });
    }

    // ---------- Fixtures ----------

    private function teacher(): User
    {
        return User::factory()->create(['role' => 'teacher']);
    }

    private function student(): User
    {
        return User::factory()->create(['role' => 'student']);
    }

    private function quizQuestion(array $questionOverrides = [], array $testCases = []): array
    {
        static $codeSeq = 0;
        $codeSeq++;
        $teacher = $this->teacher();
        $classroom = Classroom::create(['teacher_id' => $teacher->id, 'name' => 'C', 'class_code' => sprintf('%06d', 700000 + $codeSeq)]);
        $course = Course::create([
            'teacher_id' => $teacher->id,
            'class_id' => $classroom->id,
            'title' => 'Course',
            'order_index' => 0,
        ]);
        $module = Module::create(['course_id' => $course->id, 'title' => 'M', 'order_index' => 0]);
        $quiz = Quiz::create(['module_id' => $module->id, 'title' => 'Q', 'is_published' => true, 'order_index' => 0]);

        $question = Question::create(array_merge([
            'quiz_id' => $quiz->id,
            'type' => 'coding',
            'question_text' => 'Square a number',
            'options' => [],
            'expected_output' => '',
            'language' => 'python',
            'points' => 10,
            'order_index' => 1,
        ], $questionOverrides));

        foreach ($testCases as $index => $tc) {
            QuestionTestCase::create([
                'testable_type' => Question::class,
                'testable_id' => $question->id,
                'input' => $tc['input'] ?? '',
                'expected_output' => $tc['expected_output'],
                'hidden' => $tc['hidden'] ?? false,
                'order_index' => $index,
            ]);
        }

        return [$teacher, $classroom, $quiz, $question->fresh(['testCases'])];
    }

    private function submitQuiz(User $student, Quiz $quiz, Question $question, string $code): \Illuminate\Testing\TestResponse
    {
        Sanctum::actingAs($student);

        return $this->postJson("/api/student/quizzes/{$quiz->id}/submit", [
            'answers' => [$question->id => $code],
            'question_ids' => [$question->id],
        ]);
    }

    // ---------- Test-case authoring ----------

    public function test_teacher_can_crud_test_cases(): void
    {
        [$teacher, , , $question] = $this->quizQuestion();
        Sanctum::actingAs($teacher);

        $this->putJson("/api/teacher/questions/{$question->id}/test-cases", [
            'test_cases' => [
                ['input' => '3', 'expected_output' => '9', 'hidden' => false],
                ['input' => '-2', 'expected_output' => '4', 'hidden' => true],
            ],
        ])->assertStatus(200)->assertJsonCount(2, 'test_cases');

        $get = $this->getJson("/api/teacher/questions/{$question->id}/test-cases")->assertStatus(200);
        $this->assertSame('9', $get->json('test_cases.0.expected_output'));
        $this->assertTrue($get->json('test_cases.1.hidden'));

        // Bulk replace wipes the old set
        $this->putJson("/api/teacher/questions/{$question->id}/test-cases", [
            'test_cases' => [
                ['input' => '10', 'expected_output' => '100'],
            ],
        ])->assertStatus(200)->assertJsonCount(1, 'test_cases');

        $this->assertSame(1, QuestionTestCase::where('testable_id', $question->id)->count());
    }

    public function test_other_teacher_cannot_touch_test_cases(): void
    {
        [, , , $question] = $this->quizQuestion();
        Sanctum::actingAs($this->teacher());

        $this->putJson("/api/teacher/questions/{$question->id}/test-cases", [
            'test_cases' => [['expected_output' => 'x']],
        ])->assertStatus(403);

        $this->getJson("/api/teacher/questions/{$question->id}/test-cases")->assertStatus(403);
    }

    public function test_test_case_validation(): void
    {
        [$teacher, , , $question] = $this->quizQuestion();
        Sanctum::actingAs($teacher);

        // expected_output is required per test
        $this->putJson("/api/teacher/questions/{$question->id}/test-cases", [
            'test_cases' => [['input' => '1']],
        ])->assertStatus(422);

        // Max 20 test cases
        $this->putJson("/api/teacher/questions/{$question->id}/test-cases", [
            'test_cases' => collect(range(1, 21))->map(fn ($i) => ['expected_output' => (string) $i])->all(),
        ])->assertStatus(422);
    }

    public function test_student_quiz_payload_shows_only_sample_tests(): void
    {
        [, , $quiz, $question] = $this->quizQuestion([], [
            ['input' => '3', 'expected_output' => '9', 'hidden' => false],
            ['input' => '5', 'expected_output' => '25', 'hidden' => false],
            ['input' => '7', 'expected_output' => '49', 'hidden' => true],
        ]);

        Sanctum::actingAs($this->student());
        $res = $this->getJson("/api/student/quizzes/{$quiz->id}")->assertStatus(200);

        $samples = $res->json('quiz.questions.0.sample_tests');
        $this->assertCount(2, $samples);
        $this->assertSame('9', $samples[0]['expected_output']);
        $this->assertStringNotContainsString('49', json_encode($res->json('quiz.questions.0')));
    }

    // ---------- Grading ----------

    public function test_quiz_grades_by_test_cases_with_full_and_partial_credit(): void
    {
        [, , $quiz, $question] = $this->quizQuestion(['points' => 10], [
            ['input' => '3', 'expected_output' => '9'],
            ['input' => '5', 'expected_output' => '25'],
        ]);

        // Perfect solution
        $this->queueEngine(["9\n", "25\n"]);
        $res = $this->submitQuiz($this->student(), $quiz, $question, 'n = int(input())'."\n".'print(n * n)');
        $res->assertStatus(200);
        $this->assertEquals(10.0, (float) $res->json('score'));
        $this->assertTrue($res->json('details.0.is_correct'));
        $this->assertSame(2, $res->json('details.0.test_results.total'));
        $this->assertSame(2, $res->json('details.0.test_results.passed'));

        // Half credit: passes only the first test
        $this->queueEngine(["9\n", "26\n"]);
        $res2 = $this->submitQuiz($this->student(), $quiz, $question, 'n = int(input())'."\n".'print(n * n + (0 if n == 3 else 1))');
        $res2->assertStatus(200);
        $this->assertEquals(5.0, (float) $res2->json('score'));
        $this->assertFalse($res2->json('details.0.is_correct'));
        $this->assertSame(1, $res2->json('details.0.test_results.passed'));
        $this->assertSame(2, $res2->json('details.0.test_results.total'));
    }

    public function test_test_case_stdin_is_delivered_and_output_normalized(): void
    {
        // Trailing whitespace + CRLF in the teacher's expected output must not fail students
        [, , $quiz, $question] = $this->quizQuestion(['points' => 10], [
            ['input' => "Ada\r\n", 'expected_output' => "Hello Ada  \r\n"],
        ]);

        // Engine echoes exactly "Hello Ada" (no trailing spaces, LF ending)
        $this->queueEngine(["Hello Ada\n"]);

        $res = $this->submitQuiz($this->student(), $quiz, $question, 'name = input()'.chr(10).'print(f"Hello {name}")');
        $res->assertStatus(200);
        $this->assertEquals(10.0, (float) $res->json('score'));
    }

    public function test_java_grading_applies_same_preprocessing_as_practice(): void
    {
        [, , $quiz, $question] = $this->quizQuestion(['points' => 10, 'language' => 'java'], [
            ['input' => '', 'expected_output' => 'Hi'],
        ]);

        $this->queueEngine(["Hi\n"]);

        // Class is NOT named Main — the practice IDE renames it, so grading must too
        $code = 'public class Hello { public static void main(String[] a) { System.out.println("Hi"); } }';
        $res = $this->submitQuiz($this->student(), $quiz, $question, $code);
        $res->assertStatus(200);
        $this->assertEquals(10.0, (float) $res->json('score'));

        Http::assertSent(function ($request) {
            return str_contains((string) $request['code'], 'class Main {')
                && str_contains((string) $request['code'], 'System.out.println("Hi")');
        });
    }

    public function test_engine_down_fails_tests_without_breaking_submission(): void
    {
        [, , $quiz, $question] = $this->quizQuestion(['points' => 10], [
            ['input' => '', 'expected_output' => 'x'],
        ]);

        $this->engineDown = true;
        $this->fakeHttp();

        $res = $this->submitQuiz($this->student(), $quiz, $question, 'print("x")');
        $res->assertStatus(200);
        $this->assertEquals(0.0, (float) $res->json('score'));
        $this->assertFalse($res->json('details.0.is_correct'));
        $this->assertSame(0, $res->json('details.0.test_results.passed'));
    }

    public function test_legacy_coding_output_match_passes_even_when_ai_is_down(): void
    {
        // No test cases -> legacy path. Output matches. AI service down.
        [, , $quiz, $question] = $this->quizQuestion(['points' => 10, 'expected_output' => 'hello'], []);

        $this->queueEngine(["hello\n"]);
        $this->aiBatchResponse = null; // AI unreachable

        $res = $this->submitQuiz($this->student(), $quiz, $question, 'print("hello")');
        $res->assertStatus(200);
        $this->assertTrue($res->json('details.0.is_correct'));
        $this->assertEquals(10.0, (float) $res->json('score'));
    }

    public function test_ai_can_still_reject_hardcoded_legacy_solutions(): void
    {
        [, , $quiz, $question] = $this->quizQuestion(['points' => 10, 'expected_output' => 'hello'], []);

        $this->queueEngine(["hello\n"]);
        $this->aiBatchResponse = ['results' => [['question_num' => 1, 'is_correct' => false]]];

        $res = $this->submitQuiz($this->student(), $quiz, $question, 'print("hello")');
        $res->assertStatus(200);
        $this->assertFalse($res->json('details.0.is_correct'));
        $this->assertEquals(0.0, (float) $res->json('score'));
    }

    // ---------- Verify + teacher run ----------

    public function test_verify_runs_reference_solution_against_test_cases(): void
    {
        [$teacher, , , $question] = $this->quizQuestion([], [
            ['input' => '3', 'expected_output' => '9'],
            ['input' => '5', 'expected_output' => '26'],
        ]);
        Sanctum::actingAs($teacher);

        // Reference is correct for test 1, wrong for test 2
        $this->queueEngine(["9\n", "25\n"]);

        $res = $this->postJson("/api/teacher/questions/{$question->id}/verify", [
            'reference_code' => 'n = int(input())'."\n".'print(n * n)',
        ])->assertStatus(200);

        $this->assertSame(1, $res->json('passed'));
        $this->assertSame(2, $res->json('total'));
        $this->assertFalse($res->json('all_passed'));
        $this->assertSame("9\n", $res->json('results.0.actual_output'));
        $this->assertSame('26', $res->json('results.1.expected_output'));

        $this->assertSame('n = int(input())'."\n".'print(n * n)', $question->fresh()->reference_code);
    }

    public function test_verify_requires_test_cases_and_rejects_html(): void
    {
        [$teacher, , , $question] = $this->quizQuestion();
        Sanctum::actingAs($teacher);

        $this->postJson("/api/teacher/questions/{$question->id}/verify", [
            'reference_code' => 'print(1)',
        ])->assertStatus(422);

        [$htmlTeacher, , , $htmlQuestion] = $this->quizQuestion(['language' => 'html'], [
            ['input' => '', 'expected_output' => '<h1>'],
        ]);
        Sanctum::actingAs($htmlTeacher);

        $this->postJson("/api/teacher/questions/{$htmlQuestion->id}/verify", [
            'reference_code' => '<h1>x</h1>',
        ])->assertStatus(422);
    }

    public function test_teacher_can_run_code_but_students_cannot(): void
    {
        Sanctum::actingAs($this->teacher());

        $this->queueEngine(["7\n"]);

        $this->postJson('/api/teacher/run-code', [
            'language' => 'python',
            'code' => 'print(3 + 4)',
        ])->assertStatus(200)->assertJsonPath('stdout', "7\n");

        Sanctum::actingAs($this->student());
        $this->postJson('/api/teacher/run-code', [
            'language' => 'python',
            'code' => 'print(1)',
        ])->assertStatus(403);
    }

    // ---------- Integrity regressions ----------

    public function test_save_answer_rejects_other_students_attempt(): void
    {
        [$teacher, , $quiz, $question] = $this->quizQuestion();
        $owner = $this->student();
        Sanctum::actingAs($owner);

        $attempt = QuizAttempt::create([
            'student_id' => $owner->id,
            'quiz_id' => $quiz->id,
            'status' => 'in_progress',
            'total_score' => 0,
        ]);

        // A different student tries to write into the owner's attempt
        Sanctum::actingAs($this->student());
        $this->postJson("/api/student/attempts/{$attempt->id}/answer", [
            'question_id' => $question->id,
            'answer' => 'hijacked',
        ])->assertStatus(404);

        // The owner still can
        Sanctum::actingAs($owner);
        $this->postJson("/api/student/attempts/{$attempt->id}/answer", [
            'question_id' => $question->id,
            'answer' => 'mine',
        ])->assertStatus(200);
    }

    public function test_execution_endpoint_is_throttled(): void
    {
        Sanctum::actingAs($this->student());

        $this->queueEngine(["ok\n"]);

        $lastStatus = null;
        for ($i = 0; $i < 31; $i++) {
            $lastStatus = $this->postJson('/api/student/execute', [
                'language' => 'python',
                'code' => 'print(1)',
            ])->status();
        }

        $this->assertSame(429, $lastStatus);
    }

    public function test_live_quiz_hides_expected_output_for_all_question_types(): void
    {
        $teacher = $this->teacher();
        $classroom = Classroom::create(['teacher_id' => $teacher->id, 'name' => 'C', 'class_code' => '444444']);
        $activity = ClassActivity::create([
            'class_id' => $classroom->id,
            'teacher_id' => $teacher->id,
            'title' => 'Live quiz',
            'activity_type' => 'quiz',
            'grading_method' => 'auto',
            'is_published' => true,
            'pacing_mode' => 'teacher',
            'timer_mode' => 'none',
            'show_results' => 'room_close',
            'max_points' => 10,
        ]);

        \App\Models\ActivityQuestion::create([
            'activity_id' => $activity->id,
            'type' => 'identification',
            'question_text' => 'Capital of France?',
            'language' => 'java',
            'expected_output' => 'Paris',
            'points' => 5,
            'order_index' => 0,
        ]);

        $student = $this->student();
        Enrollment::create(['student_id' => $student->id, 'class_id' => $classroom->id]);

        Sanctum::actingAs($teacher);
        $this->postJson("/api/teacher/activities/{$activity->id}/start-live")->assertStatus(200);

        Sanctum::actingAs($student);
        $this->postJson("/api/student/activities/{$activity->id}/quiz/join")->assertStatus(200);

        $state = $this->getJson("/api/student/activities/{$activity->id}/quiz/state")->assertStatus(200);
        foreach ($state->json('questions') as $q) {
            $this->assertArrayNotHasKey('expected_output', $q);
            $this->assertArrayNotHasKey('reference_code', $q);
        }
    }
}
