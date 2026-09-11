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
        'points',
        'boilerplate',
        'language',
        'partial_credit',
        'html_checks',
        'reference_code',
        'order_index',
    ];

    // 2. CRITICAL: Tell Laravel that 'options' is an array/JSON
    protected $casts = [
        'options' => 'array',
        'html_checks' => 'array',
        'partial_credit' => 'boolean',
    ];

    public function quiz()
    {
        return $this->belongsTo(Quiz::class);
    }

    public function testCases()
    {
        return $this->morphMany(QuestionTestCase::class, 'testable')->orderBy('order_index');
    }
}
