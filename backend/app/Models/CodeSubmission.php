<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CodeSubmission extends Model
{
    protected $fillable = ['student_id', 'lesson_id', 'block_id', 'code', 'output', 'submitted_at'];
    public $timestamps = false;
}
