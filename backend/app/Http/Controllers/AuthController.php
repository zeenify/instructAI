<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\StudentProfile;
use App\Models\TeacherProfile;
use App\Models\EnrolledStudent;
use App\Models\WhitelistedTeacher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Google_Client;
use Illuminate\Support\Facades\Http; 

class AuthController extends Controller
{
    /**
     * The version of the Terms of Service + Data Privacy Notice that the
     * sign-up checkbox agrees to. Bump this whenever either document's
     * substance changes — the value stored with each account is the record
     * of WHAT was agreed to (RA 10173 consent practice).
     */
    public const CONSENT_VERSION = '2026-11-04';

    public function registerStudent(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|unique:users',
            'password' => 'required|min:8',
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'lrn_number' => 'required|string|size:12|unique:student_profiles,lrn_number',
            // Legal-consent gate: no account without an explicit "I agree".
            'accepted_terms' => 'required|accepted',
        ]);

        if ($error = $this->lrnEnrollmentError($data['lrn_number'])) {
            return response()->json(['message' => $error], 422);
        }

        $user = User::create([
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => 'student',
            'terms_accepted_at' => now(),
            'terms_version' => self::CONSENT_VERSION,
        ]);

        $user->studentProfile()->create([
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'lrn_number' => $data['lrn_number'],
        ]);

        $this->markLrnClaimed($data['lrn_number']);

        return response()->json([
            'message' => 'Student registered successfully',
            'token' => $user->createToken('auth_token')->plainTextToken,
            'role' => 'student',
            'user' => $user->load('studentProfile')
        ], 201);
    }

    public function registerTeacher(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|unique:users',
            'password' => 'required|min:8',
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'organization' => 'nullable|string', // Added organization (optional)
            // Legal-consent gate: no account without an explicit "I agree".
            'accepted_terms' => 'required|accepted',
        ]);

        if ($error = $this->teacherWhitelistError($data['email'])) {
            return response()->json(['message' => $error], 422);
        }

        $user = User::create([
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => 'teacher',
            'terms_accepted_at' => now(),
            'terms_version' => self::CONSENT_VERSION,
        ]);

        $user->teacherProfile()->create([
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'organization' => $data['organization'] ?? null,
        ]);

        $this->markTeacherClaimed($data['email']);

        return response()->json([
            'message' => 'Teacher registered successfully',
            'token' => $user->createToken('auth_token')->plainTextToken
        ], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json(['message' => 'Invalid login credentials'], 401);
        }

        $user = User::where('email', $request->email)->firstOrFail();

        if (!$user->is_active) {
            // Tokens never expire, so revoking them is what ends live sessions.
            $user->tokens()->delete();

            return response()->json(['message' => $this->disabledLoginMessage($user)], 403);
        }

        // Determine which profile to load
        $profile = $user->role === 'student' ? 'studentProfile' : 'teacherProfile';
        
        return response()->json([
            'token' => $user->createToken('auth_token')->plainTextToken,
            'role' => $user->role,
            'user' => $user->load($profile)
        ]);
    }

    public function loginWithGoogle(Request $request)
    {
        try {
            $chosenRole = $request->role; // 'student' or 'teacher'
            $lrnNumber = $request->lrn_number;

            // The frontend's implicit OAuth flow only yields an access_token;
            // an id_token may arrive when other clients use the JWT flow.
            $payload = null;
            if ($request->id_token) {
                $client = new \Google_Client(['client_id' => env('GOOGLE_CLIENT_ID')]);
                $payload = $client->verifyIdToken($request->id_token);
            } elseif ($request->access_token) {
                try {
                    $client = new \Google_Client();
                    $client->setClientId(env('GOOGLE_CLIENT_ID'));
                    $client->setAccessToken($request->access_token);
                    $me = (new \Google_Service_Oauth2($client))->userinfo->get();
                    $payload = [
                        'email' => $me->email,
                        'sub' => $me->id,
                        'picture' => $me->picture,
                        'given_name' => $me->givenName,
                        'family_name' => $me->familyName,
                    ];
                } catch (\Exception $e) {
                    return response()->json(['message' => 'Google verification failed'], 401);
                }
            }

            if (!$payload) {
                return response()->json(['message' => 'Google sign-in did not return a token'], 401);
            }

            $email = $payload['email'];

            $user = User::where('email', $email)->first();

            // IF NEW USER AND NO ROLE CHOSEN YET
            if (!$user && !$chosenRole) {
                return response()->json([
                    'requires_role' => true,
                    'email' => $email
                ], 200); // We return 200 so React can handle the next step
            }

            // IF NEW USER AND ROLE IS CHOSEN
            if (!$user && $chosenRole) {
                $request->validate([
                    // nullable: teachers legitimately send lrn_number null —
                    // without it the string/size rules ran against null and
                    // 500'd every Google teacher signup.
                    'lrn_number' => 'required_if:role,student|nullable|string|size:12|unique:student_profiles,lrn_number',
                    // Legal-consent gate: this branch CREATES the account, so
                    // the modal must carry the agreed flag. Existing users
                    // (above) are grandfathered and never re-asked.
                    'accepted_terms' => 'required|accepted',
                ]);

                if ($chosenRole === 'student' && ($error = $this->lrnEnrollmentError($lrnNumber))) {
                    return response()->json(['message' => $error], 422);
                }

                if ($chosenRole === 'teacher' && ($error = $this->teacherWhitelistError($email))) {
                    return response()->json(['message' => $error], 422);
                }

                $user = User::create([
                    'email' => $email,
                    'role' => $chosenRole,
                    'google_id' => $payload['sub'],
                    'avatar' => $payload['picture'] ?? null,
                    'password' => null,
                    'terms_accepted_at' => now(),
                    'terms_version' => self::CONSENT_VERSION,
                ]);

                if ($chosenRole === 'student') {
                    $user->studentProfile()->create([
                        'first_name' => $payload['given_name'] ?? 'User',
                        'last_name' => $payload['family_name'] ?? '',
                        'lrn_number' => $lrnNumber,
                    ]);
                    $this->markLrnClaimed($lrnNumber);
                } else {
                    $user->teacherProfile()->create([
                        'first_name' => $payload['given_name'] ?? 'User',
                        'last_name' => $payload['family_name'] ?? '',
                    ]);
                    $this->markTeacherClaimed($email);
                }

                // Model::create() does NOT load column defaults back onto the
                // instance — is_active is null on the in-memory model, so the
                // disabled-account gate below rejected every brand-new Google
                // account ("disabled by the school admin") even though the
                // row was saved active. Reload from the database.
                $user->refresh();
            }

            // Disabled accounts (incl. re-disabled Google ones) get no token.
            if (!$user->is_active) {
                $user->tokens()->delete();

                return response()->json(['message' => $this->disabledLoginMessage($user)], 403);
            }

            // Generate Token
            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'token' => $token,
                'role' => $user->role,
                'user' => $user->load($user->role === 'student' ? 'studentProfile' : 'teacherProfile')
            ]);

        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }



    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }

    /**
     * Why a sign-in was refused. A graduated student gets the graduation
     * wording (the defense panel's revision) instead of the generic
     * "disabled" line — the check is MESSAGE-ONLY: is_active stays the
     * single access gate, nothing about authorization changes here.
     */
    private function disabledLoginMessage(User $user): string
    {
        if ($user->role === 'student') {
            $lrn = $user->studentProfile?->lrn_number;

            if ($lrn && EnrolledStudent::where('lrn_number', $lrn)->whereNotNull('graduated_at')->exists()) {
                return 'Your LRN is marked as graduated, so this account can no longer sign in. '
                    . 'Please contact the school admin if you believe this is a mistake.';
            }
        }

        return 'This account has been disabled by the school admin.';
    }

    /**
     * Panel fix (#4/#6): students can only sign up with an LRN on the school's
     * enrollment whitelist. Returns the rejection message or null when valid.
     * Graduated (graduated_at set) LRNs are also rejected — a graduated
     * student can only return via admin re-enrollment.
     */
    private function lrnEnrollmentError(?string $lrnNumber): ?string
    {
        if (!$lrnNumber) {
            return 'An LRN is required to register as a student.';
        }

        if (!EnrolledStudent::where('lrn_number', $lrnNumber)
                ->whereNull('graduated_at')->exists()) {
            return 'This LRN is not on the Penaranda Senior High School '
                . 'active enrollment list. '
                . 'Please ask your teacher to add it to the enrollment whitelist.';
        }

        return null;
    }

    private function markLrnClaimed(string $lrnNumber): void
    {
        EnrolledStudent::where('lrn_number', $lrnNumber)->update(['claimed' => true]);
    }

    /**
     * Panel fix: teacher accounts must be pre-approved by the school admin.
     * Returns the rejection message or null when the email is whitelisted.
     */
    private function teacherWhitelistError(string $email): ?string
    {
        if (!WhitelistedTeacher::where('email', strtolower($email))->exists()) {
            return 'This email is not approved for teacher registration. '
                . 'Please ask the school admin to add it to the teacher whitelist.';
        }

        return null;
    }

    private function markTeacherClaimed(string $email): void
    {
        WhitelistedTeacher::where('email', strtolower($email))->update(['claimed' => true]);
    }
}