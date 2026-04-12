<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Quiz extends Model
{
    // Important: Allow these to be saved
    protected $fillable = [
        'module_id', 
        'title', 
        'is_randomized', 
        'time_limit_minutes'
    ];

    public function module() {
        return $this->belongsTo(Module::class);
    }

    public function questions() {
        return $this->hasMany(Question::class);
    }
}