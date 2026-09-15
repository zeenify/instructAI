<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EnrolledStudent extends Model
{
    protected $fillable = [
        'lrn_number',
        'first_name',
        'last_name',
        'grade_level',
        'section',
        'claimed',
    ];

    protected $casts = [
        'claimed' => 'boolean',
    ];
}
