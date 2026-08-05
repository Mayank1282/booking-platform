<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The admin view of a user — includes the contact details and moderation
 * state that PublicUserResource deliberately withholds.
 */
class AdminUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role->value,
            'role_label' => $this->role->label(),
            'phone' => $this->phone,
            'avatar_url' => $this->avatarUrl(),

            'is_suspended' => $this->isSuspended(),
            'suspended_at' => $this->suspended_at?->toIso8601String(),
            'suspension_reason' => $this->suspension_reason,
            'is_anonymised' => $this->anonymised_at !== null,

            'business_name' => $this->whenLoaded('providerProfile', fn () => $this->providerProfile?->business_name),
            'city' => $this->whenLoaded('providerProfile', fn () => $this->providerProfile?->city),
            'rating_avg' => $this->whenLoaded('providerProfile', fn () => (float) ($this->providerProfile?->rating_avg ?? 0)),

            'services_count' => $this->whenCounted('services'),
            'bookings_as_client_count' => $this->whenCounted('bookingsAsClient'),
            'bookings_as_provider_count' => $this->whenCounted('bookingsAsProvider'),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
