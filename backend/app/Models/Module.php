<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Module extends Model
{
    // THIS LINE IS CRITICAL
    protected $fillable = ['course_id', 'title', 'order_index', 'is_published'];

    public function lessons() {
        return $this->hasMany(Lesson::class)->orderBy('order_index', 'asc');
    }

    public function quizzes() {
        return $this->hasMany(Quiz::class);
    }
    
    public function course() {
        return $this->belongsTo(Course::class);
    }
}