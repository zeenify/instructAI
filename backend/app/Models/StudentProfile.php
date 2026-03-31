<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudentProfile extends Model
{
    // Removed lrn_number and grade_level
    protected $fillable = ['user_id', 'first_name', 'last_name'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}