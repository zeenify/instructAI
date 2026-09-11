<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityQuestion extends Model
{
    protected $fillable = [
        'activity_id',
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

    protected $casts = [
        'options' => 'array',
        'html_checks' => 'array',
        'partial_credit' => 'boolean',
        'points' => 'decimal:2',
    ];

    public function activity()
    {
        return $this->belongsTo(ClassActivity::class, 'activity_id');
    }

    public function testCases()
    {
        return $this->morphMany(QuestionTestCase::class, 'testable')->orderBy('order_index');
    }

    public function answers()
    {
        return $this->hasMany(ActivityAnswer::class, 'question_id');
    }
}
