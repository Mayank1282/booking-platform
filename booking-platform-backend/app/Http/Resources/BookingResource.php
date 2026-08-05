<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),

            'starts_at' => $this->starts_at->toIso8601String(),
            'ends_at' => $this->ends_at->toIso8601String(),
            'duration_minutes' => $this->duration_minutes,

            'price_amount' => (float) $this->price_amount,
            'currency' => $this->currency,
            'notes' => $this->notes,

            'confirmed_at' => $this->confirmed_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancellation_reason' => $this->cancellation_reason,

            'service' => new ServiceResource($this->whenLoaded('service')),
            'client' => new PublicUserResource($this->whenLoaded('client')),
            'provider' => new PublicUserResource($this->whenLoaded('provider')),
            'payment' => new PaymentResource($this->whenLoaded('payment')),
            'review' => new ReviewResource($this->whenLoaded('review')),

            // Pre-computed so the UI never has to re-derive the rules.
            'is_paid' => $this->isPaid(),
            'is_reviewable' => $this->relationLoaded('review') ? $this->isReviewable() : null,
            'is_completable' => $this->isCompletable(),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
