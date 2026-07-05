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
        'order_index',
    ];

    protected $casts = [
        'options' => 'array',
        'points' => 'decimal:2',
    ];

    public function activity()
    {
        return $this->belongsTo(ClassActivity::class, 'activity_id');
    }

    public function answers()
    {
        return $this->hasMany(ActivityAnswer::class, 'question_id');
    }
}
