<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizAttempt extends Model
{
    // These are the columns Laravel is allowed to "Mass Assign"
    protected $fillable = [
        'student_id', 
        'quiz_id', 
        'total_score', 
        'status', 
        'finished_at'
    ];

    public function quiz()
    {
        return $this->belongsTo(Quiz::class);
    }

    public function answers()
    {
        return $this->hasMany(StudentAnswer::class, 'attempt_id');
    }
}