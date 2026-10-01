<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PilotAudit extends Model
{
    protected $table = 'pilot_audit';

    protected $fillable = [
        'teacher_id',
        'run_id',
        'route',
        'explain',
        'action',
        'ref',
        'ok',
        'blocked',
        'message',
        'command',
    ];

    protected $casts = [
        'command' => 'array',
        'ok' => 'boolean',
        'blocked' => 'boolean',
    ];
}
