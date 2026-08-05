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
        ];
    }
}
