<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'name', 'email', 'password', 'role', 'phone', 'avatar_path', 'timezone',
    'suspended_at', 'suspension_reason', 'anonymised_at',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'suspended_at' => 'datetime',
            'anonymised_at' => 'datetime',
        ];
    }

    // --- Relationships ----------------------------------------------------

    public function providerProfile(): HasOne
    {
        return $this->hasOne(ProviderProfile::class);
    }

    /** Services this user offers (provider side). */
    public function services(): HasMany
    {
        return $this->hasMany(Service::class, 'provider_id');
    }

    public function availabilityRules(): HasMany
    {
        return $this->hasMany(AvailabilityRule::class, 'provider_id');
    }

    public function availabilityBlocks(): HasMany
    {
        return $this->hasMany(AvailabilityBlock::class, 'provider_id');
    }

    /** Bookings this user placed (client side). */
    public function bookingsAsClient(): HasMany
    {
        return $this->hasMany(Booking::class, 'client_id');
    }

    /** Bookings received (provider side). */
    public function bookingsAsProvider(): HasMany
    {
        return $this->hasMany(Booking::class, 'provider_id');
    }

    public function paymentsAsClient(): HasMany
    {
        return $this->hasMany(Payment::class, 'client_id');
    }

    public function paymentsAsProvider(): HasMany
    {
        return $this->hasMany(Payment::class, 'provider_id');
    }

    public function reviewsWritten(): HasMany
    {
        return $this->hasMany(Review::class, 'client_id');
    }

    public function reviewsReceived(): HasMany
    {
        return $this->hasMany(Review::class, 'provider_id');
    }

    // --- Helpers ----------------------------------------------------------

    public function isProvider(): bool
    {
        return $this->role === UserRole::Provider;
    }

    public function isClient(): bool
    {
        return $this->role === UserRole::Client;
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }

    public function isSuspended(): bool
    {
        return $this->suspended_at !== null;
    }

    public function avatarUrl(): ?string
    {
        return $this->avatar_path ? Storage::disk('public')->url($this->avatar_path) : null;
    }
}
