<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Enrollment extends Model
{
    protected $fillable = ['student_id', 'class_id', 'enrolled_at'];
    public $timestamps = false; 

    public function student() { return $this->belongsTo(User::class, 'student_id'); }
    public function classroom() { return $this->belongsTo(Classroom::class, 'class_id'); }
}