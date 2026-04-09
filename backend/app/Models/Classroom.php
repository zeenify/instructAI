<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Classroom extends Model
{
    protected $table = 'classes'; // Maps to our 'classes' table
    protected $fillable = ['teacher_id', 'name', 'class_code', 'description'];

    public function teacher() {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    // This is required for withCount('students') to work
    public function students() {
        return $this->belongsToMany(User::class, 'enrollments', 'class_id', 'student_id');
    }

    public function courses() {
        return $this->hasMany(Course::class, 'class_id');
    }
}