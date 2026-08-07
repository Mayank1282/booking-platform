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
            'application_fee_amount' => (float) $this->application_fee_amount,
            // Only gateways that pass their cost on (Stripe) set this; an
            // Indian gateway settling INR natively leaves it at zero.
            'processing_fee_amount' => (float) $this->processing_fee_amount,
            'refundable_amount' => (float) ($this->refundable_amount ?? $this->amount),
            // What the provider actually receives, by subtraction — never
            // recomputed from a percentage.
            'provider_amount' => (float) $this->amount - (float) $this->application_fee_amount,
            'destination_account' => $this->destination_account,
            // False while the provider still has payout onboarding to finish:
            // the charge succeeded, the transfer has not happened yet.
            'paid_out' => filled($this->destination_account),
            'currency' => $this->currency,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'gateway' => $this->gateway,

            // Gateway identifiers, so a booking can be traced end to end:
            // intent → charge → refund, each matching Stripe's own records.
            'reference' => $this->reference,
            'charge_reference' => $this->charge_reference,
            'refund_reference' => $this->refund_reference,
            'refund_amount' => $this->refund_amount !== null ? (float) $this->refund_amount : null,
            'application_fee_refunded' => (float) $this->application_fee_refunded,
            'refund_reason' => $this->refund_reason,

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
