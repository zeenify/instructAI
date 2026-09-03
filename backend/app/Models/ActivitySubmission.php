<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivitySubmission extends Model
{
    protected $fillable = [
        'activity_id',
        'student_id',
        'status',
        'submitted_at',
        'score',
        'max_score',
        'graded_at',
        'graded_by',
        'teacher_notes',
        'content',
        'attachments',
        'is_late',
        'started_at',
        'question_order',
        'last_seen_at',
        'current_question_idx',
        'room_closed_at',
    ];

    protected $casts = [
        'attachments' => 'array',
        'question_order' => 'array',
        'is_late' => 'boolean',
        'score' => 'decimal:2',
        'max_score' => 'decimal:2',
        'submitted_at' => 'datetime',
        'graded_at' => 'datetime',
        'started_at' => 'datetime',
        'last_seen_at' => 'datetime',
        'room_closed_at' => 'datetime',
        'current_question_idx' => 'integer',
    ];

    public function activity()
    {
        return $this->belongsTo(ClassActivity::class, 'activity_id');
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function grader()
    {
        return $this->belongsTo(User::class, 'graded_by');
    }

    public function answers()
    {
        return $this->hasMany(ActivityAnswer::class, 'submission_id');
    }
}
