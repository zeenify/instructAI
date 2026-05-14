<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Lesson extends Model
{
    protected $fillable = ['module_id', 'title', 'content', 'order_index', 'is_published', 'ai_enabled'];

    protected $casts = [
        'content' => 'array',
        'is_published' => 'boolean',
        'ai_enabled' => 'boolean'
    ];

    public function module() {
        return $this->belongsTo(Module::class);
    }
}