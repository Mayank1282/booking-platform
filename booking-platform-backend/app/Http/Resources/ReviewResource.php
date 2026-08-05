<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'rating' => $this->rating,
            'comment' => $this->comment,
            'client' => new PublicUserResource($this->whenLoaded('client')),
            'service' => new ServiceResource($this->whenLoaded('service')),
            'booking_code' => $this->whenLoaded('booking', fn () => $this->booking->code),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
