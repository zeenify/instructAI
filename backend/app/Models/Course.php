<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    protected $fillable = [
        'teacher_id', 
        'class_id', 
        'title', 
        'description', 
        'is_published', 
        'order_index'
    ];

    public function classroom() {
        return $this->belongsTo(Classroom::class, 'class_id');
    }
}