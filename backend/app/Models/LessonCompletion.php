<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class LessonCompletion extends Model
{
    protected $fillable =['student_id', 'lesson_id', 'completed_at'];
    public $timestamps = false; // We only need completed_at
    
    public function student() {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function lesson() {
        return $this->belongsTo(Lesson::class);
    }
}