<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WhitelistedTeacher extends Model
{
    protected $table = 'teacher_whitelists';

    protected $fillable = [
        'email',
        'first_name',
        'last_name',
        'position',
        'claimed',
    ];

    protected $casts = [
        'claimed' => 'boolean',
    ];
}
