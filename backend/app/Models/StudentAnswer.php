<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudentAnswer extends Model
{
    protected $fillable = [
        'attempt_id',
        'question_id',
        'submitted_answer',
        'test_results',
        'is_correct',
        'answered_at'
    ];

    protected $casts = [
        'test_results' => 'array',
    ];

    public function question()
    {
        return $this->belongsTo(Question::class);
    }
}
