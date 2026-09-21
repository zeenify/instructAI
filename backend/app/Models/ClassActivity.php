<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ClassActivity extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'class_id',
        'teacher_id',
        'title',
        'description',
        'activity_type',
        'submission_type',
        'grading_method',
        'max_points',
        'deadline_at',
        'deadline_behavior',
        'late_submission',
        'late_penalty_pct',
        'time_limit_minutes',
        'is_published',
        'is_live',
        'live_status',
        'live_scheduled_at',
        'live_started_at',
        'live_paused_at',
        'live_current_q',
        'live_question_deadline_at',
        'live_question_revealed_at',
        'pacing_mode',
        'timer_mode',
        'per_question_durations',
        'shuffle_questions',
        'show_results',
        'close_room_at',
        'instruction_files',
        'order_index',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'is_live' => 'boolean',
        'late_submission' => 'boolean',
        'max_points' => 'decimal:2',
        'late_penalty_pct' => 'decimal:2',
        // Serialize datetimes as offset-qualified ISO 8601 (…T15:59:00+00:00).
        // The bare 'Y-m-d H:i:s' default is timezone-naive, and JS parses it
        // as LOCAL time — deadlines shifted by the UTC offset on every
        // display/round-trip.
        'deadline_at' => 'datetime:Y-m-d\TH:i:sP',
        'live_scheduled_at' => 'datetime:Y-m-d\TH:i:sP',
        'live_started_at' => 'datetime:Y-m-d\TH:i:sP',
        'live_paused_at' => 'datetime:Y-m-d\TH:i:sP',
        'live_question_deadline_at' => 'datetime:Y-m-d\TH:i:sP',
        'live_question_revealed_at' => 'datetime:Y-m-d\TH:i:sP',
        'close_room_at' => 'datetime:Y-m-d\TH:i:sP',
        'shuffle_questions' => 'boolean',
        'per_question_durations' => 'array',
        'instruction_files' => 'array',
    ];

    public function class()
    {
        return $this->belongsTo(Classroom::class, 'class_id');
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function questions()
    {
        return $this->hasMany(ActivityQuestion::class, 'activity_id')->orderBy('order_index');
    }

    public function submissions()
    {
        return $this->hasMany(ActivitySubmission::class, 'activity_id');
    }
}
