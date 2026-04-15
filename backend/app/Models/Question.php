<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Question extends Model
{
    // 1. Allow these fields to be saved
    protected $fillable = [
        'quiz_id', 
        'type', 
        'question_text', 
        'options', 
        'expected_output', 
        'points'
    ];

    // 2. CRITICAL: Tell Laravel that 'options' is an array/JSON
    protected $casts = [
        'options' => 'array', 
    ];

    public function quiz()
    {
        return $this->belongsTo(Quiz::class);
    }
}