<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'amount' => (float) $this->amount,
            'currency' => $this->currency,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'gateway' => $this->gateway,
            'reference' => $this->reference,
            'receipt_url' => $this->receipt_url,
            'failure_reason' => $this->failure_reason,
            'paid_at' => $this->paid_at?->toIso8601String(),
            'refunded_at' => $this->refunded_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),

            'booking' => $this->whenLoaded('booking', fn () => [
                'id' => $this->booking->id,
                'code' => $this->booking->code,
                'status' => $this->booking->status->value,
                'starts_at' => $this->booking->starts_at->toIso8601String(),
                'service_title' => $this->booking->service?->title,
            ]),
        ];
    }
}
