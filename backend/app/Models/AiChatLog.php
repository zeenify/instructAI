<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiChatLog extends Model
{
    protected $fillable = [
        'student_id',
        'class_id',
        'character_name',
        'lesson_id',
        'quiz_id',
        'message',
        'sender',
        'mode',
        'context_metadata',
    ];

    protected $casts = [
        'context_metadata' => 'array',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function classroom()
    {
        return $this->belongsTo(Classroom::class, 'class_id');
    }

    public function lesson()
    {
        return $this->belongsTo(Lesson::class);
    }

    public function quiz()
    {
        return $this->belongsTo(Quiz::class);
    }

    public function scopeForContext($query, $studentId, $classId, $characterName, $lessonId = null)
    {
        return $query->where('student_id', $studentId)
                     ->where('class_id', $classId)
                     ->where('character_name', $characterName)
                     ->when($lessonId, fn($q) => $q->where('lesson_id', $lessonId));
    }
}
