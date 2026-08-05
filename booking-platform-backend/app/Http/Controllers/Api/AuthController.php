<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\ProviderProfile;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    use ApiResponse;

    /**
     * Registering as a provider also creates the provider profile, so a new
     * provider lands on a usable dashboard instead of a half-set-up account.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        // Plain strings from the validated payload — a Stringable would be
        // rejected by the enum cast on `role`.
        $validated = $request->validated();

        $user = DB::transaction(function () use ($validated) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => $validated['password'],
                'role' => $validated['role'],
                'phone' => $validated['phone'] ?? null,
            ]);

            if ($user->isProvider()) {
                $businessName = (string) ($validated['business_name'] ?? '');

                ProviderProfile::create([
                    'user_id' => $user->id,
                    'business_name' => $businessName,
                    'slug' => $this->uniqueSlug($businessName),
                    'city' => $validated['city'] ?? null,
                ]);

                $this->seedDefaultAvailability($user);
            }

            return $user;
        });

        $user->load('providerProfile');

        return $this->created([
            'user' => new UserResource($user),
            'token' => $user->createToken('api')->plainTextToken,
        ], 'Welcome aboard.');
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->string('email'))->first();

        if (! $user || ! Hash::check($request->string('password'), $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'Those credentials do not match our records.',
            ]);
        }

        if ($user->isSuspended()) {
            throw ValidationException::withMessages([
                'email' => $user->suspension_reason
                    ? "This account is suspended: {$user->suspension_reason}"
                    : 'This account has been suspended. Please contact support.',
            ]);
        }

        $user->load('providerProfile');

        return $this->ok([
            'user' => new UserResource($user),
            'token' => $user->createToken('api')->plainTextToken,
        ], 'Signed in.');
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return $this->ok(null, 'Signed out.');
    }

    public function me(Request $request): JsonResponse
    {
        return $this->ok(new UserResource($request->user()->load('providerProfile')));
    }

    /**
     * One endpoint updates both the user row and, for providers, the profile —
     * they are edited on the same settings screen.
     */
    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($request, $user) {
            $user->fill($request->only(['name', 'email', 'phone', 'timezone']));

            if ($request->hasFile('avatar')) {
                if ($user->avatar_path) {
                    Storage::disk('public')->delete($user->avatar_path);
                }
                $user->avatar_path = $request->file('avatar')->store('avatars', 'public');
            }

            $user->save();

            if ($user->isProvider()) {
                $profile = $user->providerProfile;

                $profileData = $request->only([
                    'business_name', 'headline', 'bio', 'address_line', 'city',
                    'state', 'country', 'postal_code', 'latitude', 'longitude', 'is_published',
                ]);

                if ($profile) {
                    $profile->update($profileData);
                } elseif ($request->filled('business_name')) {
                    ProviderProfile::create($profileData + [
                        'user_id' => $user->id,
                        'slug' => $this->uniqueSlug((string) $request->string('business_name')),
                    ]);
                }
            }
        });

        return $this->ok(
            new UserResource($user->fresh('providerProfile')),
            'Profile updated.'
        );
    }

    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', \Illuminate\Validation\Rules\Password::min(8)],
        ]);

        if (! Hash::check($validated['current_password'], $request->user()->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'That is not your current password.',
            ]);
        }

        $request->user()->update(['password' => $validated['password']]);

        // Signing out every other session is the safe default after a
        // password change.
        $request->user()->tokens()->where('id', '!=', $request->user()->currentAccessToken()->id)->delete();

        return $this->ok(null, 'Password updated.');
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        Password::sendResetLink($request->only('email'));

        // Always answer the same way, whatever the outcome, so the endpoint
        // cannot be used to probe which email addresses have accounts.
        return $this->ok(null, 'If that email is registered, a reset link is on its way.');
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', \Illuminate\Validation\Rules\Password::min(8)],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->update(['password' => $password]);
                $user->tokens()->delete();
            }
        );

        return $status === Password::PASSWORD_RESET
            ? $this->ok(null, 'Password reset. You can sign in now.')
            : $this->fail(__($status), 422);
    }

    private function uniqueSlug(string $value): string
    {
        $base = Str::slug($value) ?: 'provider';
        $slug = $base;
        $i = 2;

        while (ProviderProfile::where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }

    /** Weekdays 9–5, so a brand-new provider is immediately bookable. */
    private function seedDefaultAvailability(User $provider): void
    {
        foreach (range(1, 5) as $day) {
            $provider->availabilityRules()->create([
                'day_of_week' => $day,
                'start_time' => '09:00',
                'end_time' => '17:00',
                'is_active' => true,
            ]);
        }
    }
}
