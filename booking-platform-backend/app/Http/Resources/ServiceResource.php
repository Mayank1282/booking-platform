<?php

namespace App\Http\Resources;

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
            'price' => (float) $this->price,
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

            // Flattened for map markers and list cards so the frontend does not
            // have to dig through the nested provider profile.
            'location' => $this->when($profile !== null, fn () => [
                'city' => $profile?->city,
                'formatted_address' => $profile?->formattedAddress(),
                'latitude' => $profile?->latitude,
                'longitude' => $profile?->longitude,
            ]),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
