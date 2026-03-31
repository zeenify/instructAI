<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\StudentProfile;
use App\Models\TeacherProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Google_Client;
use Illuminate\Support\Facades\Http; 

class AuthController extends Controller
{
    public function registerStudent(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|unique:users',
            'password' => 'required|min:8',
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            // lrn_number and grade_level removed from validation
        ]);

        $user = User::create([
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => 'student',
        ]);

        $user->studentProfile()->create([
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
        ]);

        return response()->json([
            'message' => 'Student registered successfully',
            'token' => $user->createToken('auth_token')->plainTextToken
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
        ]);

        $user = User::create([
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => 'teacher',
        ]);

        $user->teacherProfile()->create([
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'organization' => $data['organization'] ?? null,
        ]);

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
            $accessToken = $request->access_token;
            $chosenRole = $request->role; // 'student' or 'teacher'

            $response = Http::withToken($accessToken)
                            ->get("https://www.googleapis.com/oauth2/v3/userinfo");

            if ($response->failed()) {
                return response()->json(['message' => 'Google verification failed'], 401);
            }

            $googleUser = $response->json();
            $email = $googleUser['email'];

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
                $user = User::create([
                    'email' => $email,
                    'role' => $chosenRole,
                    'google_id' => $googleUser['sub'],
                    'avatar' => $googleUser['picture'] ?? null,
                    'password' => null,
                ]);

                if ($chosenRole === 'student') {
                    $user->studentProfile()->create([
                        'first_name' => $googleUser['given_name'] ?? 'User',
                        'last_name' => $googleUser['family_name'] ?? '',
                    ]);
                } else {
                    $user->teacherProfile()->create([
                        'first_name' => $googleUser['given_name'] ?? 'User',
                        'last_name' => $googleUser['family_name'] ?? '',
                    ]);
                }
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
}