<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Lesson extends Model
{
    protected $fillable = ['module_id', 'title', 'content', 'order_index', 'is_published'];

    protected $casts = [
        'content' => 'array', // CRITICAL: This allows saving the JSON blocks
        'is_published' => 'boolean'
    ];

    public function module() {
        return $this->belongsTo(Module::class);
    }
}