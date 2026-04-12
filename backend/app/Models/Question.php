<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Question extends Model
{
    protected $fillable = [
        'quiz_id', 
        'type', 
        'question_text', 
        'options', 
        'expected_output', 
        'points'
    ];

    protected $casts = [
        'options' => 'json', // Ensures JSON is handled as an array
    ];

    public function quiz() {
        return $this->belongsTo(Quiz::class);
    }
}