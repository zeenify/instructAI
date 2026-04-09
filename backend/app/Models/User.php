<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens; // Import this

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'email', 
        'password', 
        'role', 
        'google_id', 
        'avatar'
    ];

    protected $hidden = [
        'password', 
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
        ];
    }

    // Relationships
    public function studentProfile()
    {
        return $this->hasOne(StudentProfile::class);
    }

    public function teacherProfile()
    {
        return $this->hasOne(TeacherProfile::class);
    }

    public function managedClasses() {
        return $this->hasMany(Classroom::class, 'teacher_id');
    }

    public function enrollments() {
        return $this->hasMany(Enrollment::class, 'student_id');
    }

    public function classes() {
        return $this->belongsToMany(Classroom::class, 'enrollments', 'student_id', 'class_id');
    }

}