<?php

namespace App\Models;

use App\Enums\BookingStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'code', 'client_id', 'provider_id', 'service_id',
    'starts_at', 'ends_at', 'duration_minutes',
    'price_amount', 'currency', 'status', 'expires_at', 'notes',
    'confirmed_at', 'completed_at', 'cancelled_at', 'cancelled_by', 'cancellation_reason',
])]
class Booking extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'duration_minutes' => 'integer',
            'price_amount' => 'decimal:2',
            'status' => BookingStatus::class,
            'expires_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    // --- Relationships ----------------------------------------------------

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'provider_id');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }

    public function review(): HasOne
    {
        return $this->hasOne(Review::class);
    }

    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    // --- Scopes -----------------------------------------------------------

    /** Ahead in time and still live — a lapsed hold is not "upcoming". */
    #[Scope]
    protected function upcoming(Builder $query): void
    {
        $query->where('starts_at', '>=', now())->blocking();
    }

    #[Scope]
    protected function past(Builder $query): void
    {
        $query->where('starts_at', '<', now());
    }

    /**
     * Bookings that still hold a slot — used for every overlap check.
     *
     * Confirmed bookings always block. A pending one blocks only while its
     * hold is alive, so an abandoned checkout frees the slot the moment it
     * lapses, without waiting for a sweep to run. Correctness therefore does
     * not depend on the scheduler — `bookings:expire` only tidies the labels.
     */
    #[Scope]
    protected function blocking(Builder $query): void
    {
        $query->where(function (Builder $q) {
            $q->where('status', BookingStatus::Confirmed)
                ->orWhere(function (Builder $pending) {
                    $pending->where('status', BookingStatus::Pending)
                        ->where(fn (Builder $hold) => $hold
                            ->whereNull('expires_at')
                            ->orWhere('expires_at', '>', now()));
                });
        });
    }

    /** Bookings that are real — paid for, or already delivered. */
    #[Scope]
    protected function real(Builder $query): void
    {
        $query->whereIn('status', BookingStatus::real());
    }

    /** A hold that has run out of time and no longer reserves anything. */
    public function isExpiredHold(): bool
    {
        return $this->status === BookingStatus::Pending
            && $this->expires_at !== null
            && $this->expires_at->isPast();
    }

    /** Seconds left to pay, or null when this is not a live hold. */
    public function holdSecondsRemaining(): ?int
    {
        if ($this->status !== BookingStatus::Pending || $this->expires_at === null) {
            return null;
        }

        return max(0, now()->diffInSeconds($this->expires_at, absolute: false));
    }

    /** Bookings whose time range intersects the given window. */
    #[Scope]
    protected function overlapping(Builder $query, $startsAt, $endsAt): void
    {
        $query->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt);
    }

    // --- Helpers ----------------------------------------------------------

    public function isPaid(): bool
    {
        return $this->payment?->isSucceeded() ?? false;
    }

    public function isReviewable(): bool
    {
        return $this->status === BookingStatus::Completed && $this->review === null;
    }

    /** Providers may only mark a booking complete once its end time has passed. */
    public function isCompletable(): bool
    {
        return $this->status === BookingStatus::Confirmed && $this->ends_at->isPast();
    }
}
