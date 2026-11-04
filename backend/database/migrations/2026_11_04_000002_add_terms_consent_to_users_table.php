<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Consent record for the Terms of Service + Data Privacy Notice (RA 10173).
 * Every account-creation path must have an explicit "I agree" checkbox
 * before submitting; these columns record WHEN and to WHICH version of the
 * policies that consent was given — that pairing is what makes the record
 * legally defensible. Null = never consented (pre-existing pilot accounts
 * are grandfathered and simply carry null).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('terms_accepted_at')->nullable()->after('is_active');
            $table->string('terms_version', 20)->nullable()->after('terms_accepted_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['terms_accepted_at', 'terms_version']);
        });
    }
};
