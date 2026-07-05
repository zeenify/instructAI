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
        'live_current_q',
        'instruction_files',
        'order_index',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'is_live' => 'boolean',
        'late_submission' => 'boolean',
        'max_points' => 'decimal:2',
        'late_penalty_pct' => 'decimal:2',
        'deadline_at' => 'datetime',
        'live_scheduled_at' => 'datetime',
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
