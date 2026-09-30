<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PilotMessage extends Model
{
    protected $fillable = [
        'teacher_id',
        'run_id',
        'route',
        'sender',
        'message',
        'context_metadata',
    ];

    protected $casts = [
        'context_metadata' => 'array',
    ];
}
