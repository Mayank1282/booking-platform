<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role->value,
            'phone' => $this->phone,
            'avatar_url' => $this->avatarUrl(),
            'timezone' => $this->timezone,
            'provider_profile' => new ProviderProfileResource($this->whenLoaded('providerProfile')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
