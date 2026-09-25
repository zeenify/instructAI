<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\ActivityAnswer;
use App\Models\ActivitySubmission;
use App\Models\ClassActivity;
use App\Models\Enrollment;
use App\Support\ActivityGrading;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LiveQuizController extends Controller
{
    private function checkEnrollment($classId)
    {
        $enrolled = Enrollment::where('student_id', auth()->id())
            ->where('class_id', $classId)
            ->exists();

        if (! $enrolled) {
            abort(403, 'Not enrolled in this class');
        }
    }

    private function findQuiz($id): ClassActivity
    {
        $activity = ClassActivity::with(['questions' => fn ($q) => $q->with('testCases')])->findOrFail($id);

        if ($activity->activity_type !== 'quiz') {
            abort(422, 'Not a quiz');
        }

        // Rooms auto-close 24h after start — every student touchpoint (join,
        // state, answers, heartbeat, finish) finalizes a forgotten room here
        $activity->syncExpiredRoom();

        return $activity;
    }

    private function roomLive(ClassActivity $activity): bool
    {
        return $activity->is_live && $activity->live_status === 'active';
    }

    private function roomPaused(ClassActivity $activity): bool
    {
        return $activity->is_live && $activity->live_status === 'paused';
    }

    private function roomClosed(ClassActivity $activity): bool
    {
        return (bool) $activity->close_room_at || $activity->live_status === 'completed';
    }

    private function isFinalized(ActivitySubmission $submission): bool
    {
        return in_array($submission->status, ['submitted', 'graded', 'missed']);
    }

    private function getSubmission($activityId)
    {
        return ActivitySubmission::where('activity_id', $activityId)
            ->where('student_id', auth()->id())
            ->with('answers')
            ->first();
    }

    private function buildQuestionOrder(ClassActivity $activity): array
    {
        $ids = $activity->questions->pluck('id')->all();

        if ($activity->shuffle_questions && $activity->pacing_mode !== 'teacher') {
            shuffle($ids);
        }

        return $ids;
    }

    private function syncTeacherQuestion(ClassActivity $activity): void
    {
        if (! $this->roomLive($activity)) {
            return;
        }

        if ($activity->live_question_deadline_at
            && ! $activity->live_question_revealed_at
            && $activity->live_question_deadline_at->isPast()) {
            $activity->update([
                'live_question_revealed_at' => now(),
                'live_question_deadline_at' => null,
            ]);
        }
    }

    private function syncSubmissionToTeacher(ActivitySubmission $submission, ClassActivity $activity): void
    {
        if ($activity->pacing_mode !== 'teacher' || $this->isFinalized($submission)) {
            return;
        }

        $idx = (int) $activity->live_current_q;
        if ((int) $submission->current_question_idx !== max($idx, 0)) {
            $submission->update(['current_question_idx' => max($idx, 0)]);
        }
    }

    private function teacherPhase(ClassActivity $activity): string
    {
        if (! $this->roomLive($activity)) {
            if ($this->roomPaused($activity)) {
                return 'paused';
            }

            return $this->roomClosed($activity) ? 'complete' : 'waiting';
        }

        if ($activity->live_question_revealed_at) {
            return 'revealed';
        }

        $idx = (int) $activity->live_current_q;

        return $idx >= 0 && $activity->questions->count() > $idx ? 'question' : 'waiting';
    }

    private function currentQuestionFeedback(ClassActivity $activity, ?ActivitySubmission $submission): ?array
    {
        if ($activity->pacing_mode !== 'teacher') {
            return null;
        }

        if (! $this->roomLive($activity) || ! $activity->live_question_revealed_at) {
            return null;
        }

        $question = $activity->questions->get((int) $activity->live_current_q);
        if (! $question) {
            return null;
        }

        $answer = $submission?->answers->firstWhere('question_id', $question->id);

        $correctAnswer = in_array($question->type, ['essay', 'coding']) ? null : $question->expected_output;

        return [
            'question_id' => $question->id,
            'answered' => (bool) $answer,
            'is_correct' => $answer ? (bool) $answer->is_correct : null,
            'score' => $answer ? (float) $answer->score : 0,
            'correct_answer' => $correctAnswer,
        ];
    }

    private function remainingSeconds(?ActivitySubmission $submission, ClassActivity $activity): ?int
    {
        if ($activity->timer_mode !== 'entire_quiz') {
            return null;
        }

        $limit = (int) $activity->time_limit_minutes * 60;

        if (! $submission || ! $submission->started_at) {
            return $limit;
        }

        return max(0, $limit - (int) $submission->started_at->diffInSeconds(now()));
    }

    private function isExpired(?ActivitySubmission $submission, ClassActivity $activity): bool
    {
        return $this->remainingSeconds($submission, $activity) !== null
            && $this->remainingSeconds($submission, $activity) <= 0;
    }

    private function studentActivityPayload(ClassActivity $activity): array
    {
        return [
            'id' => $activity->id,
            'title' => $activity->title,
            'description' => $activity->description,
            'pacing_mode' => $activity->pacing_mode,
            'timer_mode' => $activity->timer_mode,
            'time_limit_minutes' => $activity->time_limit_minutes,
            'per_question_durations' => $activity->per_question_durations,
            'shuffle_questions' => $activity->shuffle_questions,
            'show_results' => $activity->show_results,
            'questions_count' => $activity->questions->count(),
            'total_points' => $activity->questions->sum('points'),
        ];
    }

    private function orderedQuestions(ClassActivity $activity, ?ActivitySubmission $submission): array
    {
        $byId = $activity->questions->keyBy('id');
        $order = $submission?->question_order ?? $byId->keys()->all();

        foreach ($byId->keys() as $qid) {
            if (! in_array($qid, $order)) {
                $order[] = $qid;
            }
        }

        $questions = collect($order)
            ->map(fn ($qid) => $byId->get($qid))
            ->filter()
            ->values()
            ->map(function ($question) {
                $data = $question->toArray();
                // Students never see the expected answer mid-room — the old guard
                // was inverted and leaked it for coding questions.
                unset($data['expected_output'], $data['reference_code']);

                // Sample (non-hidden) test cases show the I/O contract for coding
                $data['sample_tests'] = $question->testCases
                    ->filter(fn ($t) => ! $t->hidden)
                    ->map(fn ($t) => ['input' => (string) $t->input, 'expected_output' => (string) $t->expected_output])
                    ->values();

                return $data;
            });

        if ($submission) {
            $answers = $submission->answers->keyBy('question_id');
            $questions = $questions->map(function ($data) use ($answers) {
                $data['submitted_answer'] = $answers->get($data['id'])?->submitted_answer;

                return $data;
            });
        }

        return $questions->all();
    }

    private function resultsPayload(ClassActivity $activity, ActivitySubmission $submission): array
    {
        $reveal = ($activity->show_results === 'immediate' || $this->roomClosed($activity)) ? 'full' : 'summary';
        $answers = $submission->answers->keyBy('question_id');

        $rows = $activity->questions->map(function ($question) use ($answers, $reveal) {
            $answer = $answers->get($question->id);
            $row = [
                'question_id' => $question->id,
                'question_text' => $question->question_text,
                'type' => $question->type,
                'language' => $question->language,
                'points' => $question->points,
                'submitted_answer' => $answer ? $answer->submitted_answer : null,
                'is_correct' => $answer ? (bool) $answer->is_correct : null,
                'score' => $answer ? (float) $answer->score : 0,
            ];

            if ($reveal === 'full' && ! in_array($question->type, ['essay', 'coding'])) {
                $row['expected_output'] = $question->expected_output;
            }

            if ($question->type === 'multiple_choice') {
                $row['options'] = $question->options;
            }

            return $row;
        })->all();

        return [
            'score' => (float) $submission->score,
            'max_score' => (float) $submission->max_score,
            'status' => $submission->status,
            'reveal' => $reveal,
            'rows' => $rows,
        ];
    }

    private function statePayload(ClassActivity $activity, ?ActivitySubmission $submission): array
    {
        $finalized = $submission && $this->isFinalized($submission);
        $roomClosed = $this->roomClosed($activity);

        $reveal = 'none';
        if ($finalized) {
            $reveal = ($activity->show_results === 'immediate' || $roomClosed) ? 'full' : 'summary';
        }

        return [
            'activity' => $this->studentActivityPayload($activity),
            'submission' => $submission,
            'questions' => $this->orderedQuestions($activity, $submission),
            'reveal' => $reveal,
            'remaining_seconds' => $finalized ? null : $this->remainingSeconds($submission, $activity),
            'room_live' => $this->roomLive($activity),
            'room_paused' => $this->roomPaused($activity),
            'room_closed' => $roomClosed,
            'finalized' => $finalized,
            'results' => $finalized ? $this->resultsPayload($activity, $submission) : null,
            'teacher_phase' => $activity->pacing_mode === 'teacher' ? $this->teacherPhase($activity) : null,
            'live_current_q' => $activity->pacing_mode === 'teacher' ? (int) $activity->live_current_q : null,
            'live_question_deadline_at' => $activity->pacing_mode === 'teacher' ? $activity->live_question_deadline_at?->toISOString() : null,
            'live_question_revealed_at' => $activity->pacing_mode === 'teacher' ? $activity->live_question_revealed_at?->toISOString() : null,
            'current_question_feedback' => $this->currentQuestionFeedback($activity, $submission),
        ];
    }

    public function join($id)
    {
        $activity = $this->findQuiz($id);
        $this->checkEnrollment($activity->class_id);

        if ($this->roomClosed($activity)) {
            abort(422, 'Quiz has ended');
        }

        if (! $activity->is_live) {
            abort(422, 'Quiz is not live yet');
        }

        $submission = $this->getSubmission($id);

        if (! $submission) {
            try {
                $submission = ActivitySubmission::create([
                    'activity_id' => $activity->id,
                    'student_id' => auth()->id(),
                    'status' => 'draft',
                    'max_score' => $activity->questions->sum('points'),
                    'question_order' => $this->buildQuestionOrder($activity),
                    'current_question_idx' => $activity->pacing_mode === 'teacher' ? max((int) $activity->live_current_q, 0) : 0,
                ]);
            } catch (UniqueConstraintViolationException $e) {
                $submission = $this->getSubmission($id);

                if (! $submission) {
                    throw $e;
                }
            }
        } elseif (! $submission->question_order) {
            $submission->update(['question_order' => $this->buildQuestionOrder($activity)]);
        }

        $submission->load('answers');

        return response()->json($this->statePayload($activity, $submission));
    }

    public function start($id)
    {
        $activity = $this->findQuiz($id);
        $this->checkEnrollment($activity->class_id);

        if ($this->roomPaused($activity)) {
            abort(422, 'Quiz is paused');
        }

        if (! $this->roomLive($activity)) {
            abort(422, 'Quiz is not live');
        }

        $submission = $this->getSubmission($id);

        abort_if(! $submission, 422, 'Join the quiz first');
        abort_if($this->isFinalized($submission), 422, 'Quiz already finished');

        if (! $submission->started_at) {
            $submission->update([
                'started_at' => now(),
                'last_seen_at' => now(),
            ]);
        }

        return response()->json(['submission' => $submission->fresh()]);
    }

    public function answers(Request $request, $id)
    {
        $activity = $this->findQuiz($id);
        $this->checkEnrollment($activity->class_id);

        $request->validate([
            'question_id' => 'required|integer',
            'submitted_answer' => 'present',
            'current_question_idx' => 'nullable|integer|min:0|max:999',
        ]);

        $question = $activity->questions->firstWhere('id', (int) $request->question_id);
        abort_if(! $question, 422, 'Question not in this quiz');

        $submission = $this->getSubmission($id);
        abort_if(! $submission, 422, 'Join the quiz first');
        abort_if($this->isFinalized($submission), 422, 'Quiz already finalized');
        abort_if($this->roomPaused($activity), 422, 'Quiz is paused');

        if ($activity->timer_mode === 'entire_quiz' && $this->isExpired($submission, $activity)) {
            $this->finalizeNow($submission, $activity);
            abort(422, 'Time is up');
        }

        if ($activity->pacing_mode === 'teacher') {
            $this->syncTeacherQuestion($activity);
            $this->syncSubmissionToTeacher($submission, $activity);

            $order = $submission->question_order ?? $activity->questions->pluck('id')->all();
            $currentQuestionId = $order[(int) $activity->live_current_q] ?? null;

            if ($currentQuestionId !== $question->id) {
                abort(422, 'Question is not open');
            }

            if ($activity->live_question_revealed_at) {
                abort(422, 'Question closed');
            }

            if (! $submission->started_at) {
                $submission->update([
                    'started_at' => now(),
                    'last_seen_at' => now(),
                ]);
            }
        }

        ActivityAnswer::updateOrCreate(
            [
                'submission_id' => $submission->id,
                'question_id' => $question->id,
            ],
            [
                'submitted_answer' => ActivityGrading::normalizeAnswer($request->submitted_answer),
            ]
        );

        $submission->update([
            'last_seen_at' => now(),
            'current_question_idx' => $activity->pacing_mode === 'teacher'
                ? max((int) $activity->live_current_q, 0)
                : ($request->current_question_idx ?? $submission->current_question_idx),
        ]);

        return response()->json(['ok' => true]);
    }

    public function advance(Request $request, $id)
    {
        $activity = $this->findQuiz($id);
        $this->checkEnrollment($activity->class_id);

        $request->validate([
            'current_question_idx' => 'required|integer|min:0|max:999',
        ]);

        $submission = $this->getSubmission($id);
        abort_if(! $submission, 422, 'Join the quiz first');
        abort_if($this->isFinalized($submission), 422, 'Quiz already finalized');
        abort_if($this->roomPaused($activity), 422, 'Quiz is paused');
        abort_if($activity->pacing_mode === 'teacher', 422, 'Teacher controls the pace');

        $submission->update([
            'last_seen_at' => now(),
            'current_question_idx' => $request->current_question_idx,
        ]);

        return response()->json(['ok' => true]);
    }

    public function finish($id)
    {
        $activity = $this->findQuiz($id);
        $this->checkEnrollment($activity->class_id);

        $submission = $this->getSubmission($id);
        abort_if(! $submission, 422, 'Join the quiz first');
        abort_if($this->isFinalized($submission), 422, 'Quiz already finalized');
        abort_if($this->roomPaused($activity), 422, 'Quiz is paused');
        abort_if($activity->pacing_mode === 'teacher' && ! $this->roomClosed($activity), 422, 'The teacher will end the quiz');

        return DB::transaction(function () use ($submission, $activity) {
            $this->finalizeNow($submission, $activity);
            $submission->load('answers');

            return response()->json($this->statePayload($activity, $submission));
        });
    }

    public function heartbeat($id)
    {
        $activity = $this->findQuiz($id);
        $this->checkEnrollment($activity->class_id);

        $submission = $this->getSubmission($id);

        if ($submission && ! $this->isFinalized($submission)) {
            $submission->update(['last_seen_at' => now()]);
        }

        return response()->json(['ok' => true]);
    }

    public function state($id)
    {
        $activity = $this->findQuiz($id);
        $this->checkEnrollment($activity->class_id);

        $submission = $this->getSubmission($id);

        if ($submission && ! $this->isFinalized($submission)) {
            $this->syncTeacherQuestion($activity);
            $this->syncSubmissionToTeacher($submission, $activity);

            if ($activity->timer_mode === 'entire_quiz' && $this->isExpired($submission, $activity)) {
                $this->finalizeNow($submission, $activity);
            }
        }

        return response()->json($this->statePayload($activity, $submission));
    }

    private function finalizeNow(ActivitySubmission $submission, ClassActivity $activity): void
    {
        ActivityGrading::finalizeSubmission($submission, $activity);
        $submission->load('answers');
    }
}
