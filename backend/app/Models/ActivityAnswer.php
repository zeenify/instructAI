<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityAnswer extends Model
{
    protected $fillable = [
        'submission_id',
        'question_id',
        'submitted_answer',
        'is_correct',
        'score',
        'ai_evaluated',
    ];

    protected $casts = [
        'is_correct' => 'boolean',
        'ai_evaluated' => 'boolean',
        'score' => 'decimal:2',
    ];

    public function submission()
    {
        return $this->belongsTo(ActivitySubmission::class, 'submission_id');
    }

    public function question()
    {
        return $this->belongsTo(ActivityQuestion::class, 'question_id');
    }
}
