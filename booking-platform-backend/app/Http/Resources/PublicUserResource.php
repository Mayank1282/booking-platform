<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A user as seen by someone else — no email, phone or timezone.
 */
class PublicUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'avatar_url' => $this->avatarUrl(),
            'provider_profile' => new ProviderProfileResource($this->whenLoaded('providerProfile')),
        ];
    }
}
