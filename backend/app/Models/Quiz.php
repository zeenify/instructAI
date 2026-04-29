<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Quiz extends Model
{
    protected $fillable = [
        'module_id', 
        'title', 
        'is_randomized', 
        'allow_ai_assistance', 
        'time_limit_minutes',
        'order_index',
        'passing_score',
        'is_published'
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'is_randomized' => 'boolean',
    ];


    public function module() {
        return $this->belongsTo(Module::class);
    }

    public function questions() {
        return $this->hasMany(Question::class);
    }
}