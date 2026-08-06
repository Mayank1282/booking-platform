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

            /*
             * Who ended it. `cancelled_by` was always recorded but never
             * surfaced, so a cancellation gave no clue whether the client
             * backed out or the provider dropped it — which matters to both
             * sides, and to any dispute.
             */
            'cancelled_by_role' => $this->when($this->cancelled_by !== null, fn () => match (true) {
                $this->cancelled_by === $this->client_id => 'client',
                $this->cancelled_by === $this->provider_id => 'provider',
                default => 'admin',
            }),
            'cancelled_by_name' => $this->whenLoaded('canceller', fn () => $this->canceller?->name),

            'service' => new ServiceResource($this->whenLoaded('service')),
            'client' => new PublicUserResource($this->whenLoaded('client')),
            'provider' => new PublicUserResource($this->whenLoaded('provider')),
            'payment' => new PaymentResource($this->whenLoaded('payment')),
            'review' => new ReviewResource($this->whenLoaded('review')),

            // An unpaid booking is only a hold on the slot. The UI uses these
            // to show a countdown and to avoid calling it a real booking.
            'expires_at' => $this->expires_at?->toIso8601String(),
            'hold_seconds_remaining' => $this->holdSecondsRemaining(),
            'is_expired_hold' => $this->isExpiredHold(),

            // Pre-computed so the UI never has to re-derive the rules.
            'is_paid' => $this->isPaid(),
            'is_reviewable' => $this->relationLoaded('review') ? $this->isReviewable() : null,
            'is_completable' => $this->isCompletable(),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
