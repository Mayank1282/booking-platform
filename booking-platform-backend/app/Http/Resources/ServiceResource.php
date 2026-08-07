<?php

namespace App\Http\Resources;

use App\Support\Pricing;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $profile = $this->relationLoaded('provider') ? $this->provider?->providerProfile : null;

        // Some callers load the service with only a few columns (for example
        // `service:id,title,slug` on a review). Guard the cast attributes so a
        // partial load renders a partial resource instead of throwing.
        $locationType = $this->location_type;

        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'description' => $this->description,
            'image_url' => $this->imageUrl(),
            'duration_minutes' => $this->duration_minutes,
            'buffer_minutes' => $this->buffer_minutes,
            /*
             * `price` is what the provider set and receives. Clients are shown
             * `pricing.total`, which adds the platform's commission on top —
             * the two are deliberately different numbers, and confusing them
             * would either undercharge the client or shortchange the provider.
             */
            'price' => (float) $this->price,

            /*
             * Null-guarded: some callers load a service with only a few
             * columns (`service:id,title,slug` on a booking or review), and a
             * partial load must render a partial resource rather than throw.
             */
            'pricing' => $this->when(
                $this->price !== null,
                fn () => Pricing::fromProviderAmount($this->price, $this->currency ?? 'inr')->toArray()
            ),
            'currency' => $this->currency,
            'location_type' => $locationType?->value,
            'location_label' => $locationType?->label(),
            'is_mappable' => $locationType?->isMappable() ?? false,
            'rating_avg' => (float) $this->rating_avg,
            'rating_count' => $this->rating_count,
            'bookings_count' => $this->bookings_count,
            'is_active' => $this->is_active,

            'category' => new CategoryResource($this->whenLoaded('category')),
            'provider' => new PublicUserResource($this->whenLoaded('provider')),

            /*
             * The service's own address when it has one, otherwise the
             * provider's. `source` tells the UI which, so the edit form can
             * show "inherited from your profile" rather than pretending the
             * blank fields are the answer.
             */
            'location' => $this->when($this->relationLoaded('provider'), fn () => [
                'city' => $this->effectiveLocation()['city'],
                'formatted_address' => $this->effectiveLocation()['formatted'],
                'latitude' => $this->effectiveLocation()['latitude'],
                'longitude' => $this->effectiveLocation()['longitude'],
                'source' => $this->effectiveLocation()['source'],
            ]),

            // Raw own-address columns, for the provider's edit form only.
            'own_location' => [
                'address_line' => $this->address_line,
                'city' => $this->city,
                'state' => $this->state,
                'postal_code' => $this->postal_code,
                'latitude' => $this->latitude,
                'longitude' => $this->longitude,
            ],

            /*
             * The address is frozen while clients are still owed appointments.
             * Only loaded on the provider's own endpoints, so the public
             * listing pays nothing for it.
             */
            'outstanding_bookings_count' => $this->whenCounted('outstanding_bookings'),
            'location_locked' => $this->when(
                $this->outstanding_bookings_count !== null,
                fn () => $this->outstanding_bookings_count > 0
            ),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
