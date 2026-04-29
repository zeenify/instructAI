<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudentAnswer extends Model
{
    protected $fillable = [
        'attempt_id', 
        'question_id', 
        'submitted_answer', 
        'is_correct', 
        'answered_at'
    ];

    public function question()
    {
        return $this->belongsTo(Question::class);
    }
}