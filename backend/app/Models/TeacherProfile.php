<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TeacherProfile extends Model
{
    // Removed employee_id and department, added organization
    protected $fillable = ['user_id', 'first_name', 'last_name', 'organization'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}