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
        'order_index' // <--- MAKE SURE THIS IS HERE
    ];

    public function module() {
        return $this->belongsTo(Module::class);
    }

    public function questions() {
        return $this->hasMany(Question::class);
    }
}