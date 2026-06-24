<?php

namespace App\Models;

use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

class PersonalAccessToken extends SanctumPersonalAccessToken
{
    public function updateLastUsedAt(): void
    {
        // Intentionally empty — skips the 500ms DB write on every request
    }
}
