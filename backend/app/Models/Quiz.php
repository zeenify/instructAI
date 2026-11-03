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
        'question_limit',
        'results_revealed_at',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'is_randomized' => 'boolean',
        'ai_enabled' => 'boolean',
        'results_revealed_at' => 'datetime:Y-m-d\TH:i:sP',
    ];

    /** Students see score/answers only after the teacher reveals them. */
    public function resultsRevealed(): bool
    {
        return $this->results_revealed_at !== null;
    }


    public function module() {
        return $this->belongsTo(Module::class);
    }

    public function questions() {
        return $this->hasMany(Question::class);
    }
}