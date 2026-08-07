<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id', 'business_name', 'slug', 'headline', 'bio',
    'address_line', 'city', 'state', 'country', 'postal_code',
    'latitude', 'longitude', 'is_published',
    'stripe_account_id', 'stripe_charges_enabled', 'stripe_payouts_enabled',
    'stripe_details_submitted', 'stripe_requirements', 'stripe_synced_at',
])]
class ProviderProfile extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'rating_avg' => 'float',
            'rating_count' => 'integer',
            'is_published' => 'boolean',
            'stripe_charges_enabled' => 'boolean',
            'stripe_payouts_enabled' => 'boolean',
            'stripe_details_submitted' => 'boolean',
            'stripe_requirements' => 'array',
            'stripe_synced_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** True when the profile carries usable map coordinates. */
    public function hasCoordinates(): bool
    {
        return $this->latitude !== null && $this->longitude !== null;
    }

    /**
     * True when a service that inherits this address still owes a client an
     * appointment. Those clients agreed to a particular place, so the address
     * cannot move until every one of those bookings is completed or cancelled.
     */
    public function lockedByInheritingBookings(): bool
    {
        return Service::query()
            ->where('provider_id', $this->user_id)
            ->whereNull('latitude')
            ->whereHas('bookings', fn ($q) => $q->blocking())
            ->exists();
    }

    public function formattedAddress(): ?string
    {
        $parts = array_filter([
            $this->address_line,
            $this->city,
            $this->state,
            $this->postal_code,
            $this->country,
        ]);

        return $parts ? implode(', ', $parts) : null;
    }
}
