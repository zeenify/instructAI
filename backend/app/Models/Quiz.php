<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Quiz extends Model
{
    protected $fillable = [
        'module_id',
        'title',
        'is_randomized',
        'ai_enabled',
        'time_limit_minutes',
        'order_index',
        'passing_score',
        'is_published',
        'timer_mode',
        'question_limit'
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'is_randomized' => 'boolean',
        'ai_enabled' => 'boolean',
    ];


    public function module() {
        return $this->belongsTo(Module::class);
    }

    public function questions() {
        return $this->hasMany(Question::class);
    }
}