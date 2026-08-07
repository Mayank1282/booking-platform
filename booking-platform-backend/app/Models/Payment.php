<?php

namespace App\Models;

use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'booking_id', 'client_id', 'provider_id', 'amount', 'application_fee_amount', 'processing_fee_amount', 'refundable_amount', 'currency',
    'status', 'gateway', 'reference', 'charge_reference', 'client_secret',
    'destination_account', 'transfer_reference', 'transfer_amount', 'transfer_currency',
    'settlement_currency', 'settlement_amount', 'exchange_rate', 'stripe_fee', 'net_amount',
    'receipt_url', 'failure_reason', 'paid_at',
    'refunded_at', 'refund_reference', 'refund_amount', 'application_fee_refunded',
    'stripe_fee_refunded', 'transfer_reversed_amount', 'platform_net_amount',
    'refund_reason', 'meta',
])]
#[Hidden(['client_secret'])] // only ever handed back through the explicit intent endpoint
class Payment extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'application_fee_amount' => 'decimal:2',
            'processing_fee_amount' => 'decimal:2',
            'refundable_amount' => 'decimal:2',
            'refund_amount' => 'decimal:2',
            'application_fee_refunded' => 'decimal:2',
            'settlement_amount' => 'decimal:2',
            'exchange_rate' => 'decimal:8',
            'stripe_fee' => 'decimal:2',
            'net_amount' => 'decimal:2',
            'transfer_amount' => 'decimal:2',
            'stripe_fee_refunded' => 'decimal:2',
            'transfer_reversed_amount' => 'decimal:2',
            'platform_net_amount' => 'decimal:2',
            'status' => PaymentStatus::class,
            'paid_at' => 'datetime',
            'refunded_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'provider_id');
    }

    #[Scope]
    protected function succeeded(Builder $query): void
    {
        $query->where('status', PaymentStatus::Succeeded);
    }

    public function isSucceeded(): bool
    {
        return $this->status === PaymentStatus::Succeeded;
    }

    public function isRefundable(): bool
    {
        return $this->status === PaymentStatus::Succeeded;
    }
}
