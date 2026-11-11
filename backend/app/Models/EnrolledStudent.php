<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EnrolledStudent extends Model
{
    protected $fillable = [
        'lrn_number',
        'first_name',
        'last_name',
        'claimed',
        'graduated_at',
    ];

    protected $casts = [
        'claimed' => 'boolean',
        // NULL = actively enrolled; a timestamp = graduated (login blocked).
        'graduated_at' => 'datetime',
    ];
}
