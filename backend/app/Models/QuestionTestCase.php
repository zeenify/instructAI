<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class QuestionTestCase extends Model
{
    protected $fillable = [
        'testable_type',
        'testable_id',
        'input',
        'expected_output',
        'hidden',
        'order_index',
    ];

    protected $casts = [
        'hidden' => 'boolean',
    ];

    public function testable(): MorphTo
    {
        return $this->morphTo();
    }
}
