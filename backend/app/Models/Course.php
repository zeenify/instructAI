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

    protected $casts = [
        'is_published' => 'boolean',
        'order_index' => 'integer'
    ];


    public function classroom() {
        return $this->belongsTo(Classroom::class, 'class_id');
    }
    public function modules() {
        return $this->hasMany(Module::class)->orderBy('order_index', 'asc');
    }

}