<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProviderProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'business_name' => $this->business_name,
            'slug' => $this->slug,
            'headline' => $this->headline,
            'bio' => $this->bio,
            'address_line' => $this->address_line,
            'city' => $this->city,
            'state' => $this->state,
            'country' => $this->country,
            'postal_code' => $this->postal_code,
            'formatted_address' => $this->formattedAddress(),
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'has_coordinates' => $this->hasCoordinates(),
            'rating_avg' => $this->rating_avg,
            'rating_count' => $this->rating_count,
            'is_published' => $this->is_published,

            // Drives the onboarding gate: a provider who cannot be paid yet
            // cannot usefully take bookings.
            'payouts_enabled' => (bool) $this->stripe_payouts_enabled,
            'payouts_details_submitted' => (bool) $this->stripe_details_submitted,

            /*
             * Services with no address of their own sit at this one, so editing
             * it moves them. While any of those still owes a client an
             * appointment the address is frozen. Only computed for the owner —
             * the public directory never pays for the query.
             */
            'location_locked' => $this->when(
                $request->user()?->id === $this->user_id,
                fn () => $this->lockedByInheritingBookings()
            ),
        ];
    }
}
