<?php

namespace App\Enums;

enum BookingStatus: string
{
    /** A short-lived hold on the slot while the client pays. Not a booking yet. */
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    /** The hold ran out before payment completed; the slot has been released. */
    case Expired = 'expired';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Awaiting payment',
            default => ucfirst($this->value),
        };
    }

    /**
     * Statuses that can occupy a slot in the provider's calendar.
     *
     * Pending is included because a hold must block the slot while its client
     * is paying — otherwise two people could pay for the same time. Whether a
     * *particular* pending row still blocks also depends on its `expires_at`;
     * see Booking::scopeBlocking.
     */
    public static function blocking(): array
    {
        return [self::Pending->value, self::Confirmed->value];
    }

    /** Statuses that represent a real, paid-for booking. */
    public static function real(): array
    {
        return [self::Confirmed->value, self::Completed->value];
    }

    /** Which statuses a booking may legally move to from here. */
    public function canTransitionTo(self $next): bool
    {
        return in_array($next, match ($this) {
            self::Pending => [self::Confirmed, self::Cancelled, self::Expired],
            self::Confirmed => [self::Completed, self::Cancelled],
            self::Completed, self::Cancelled, self::Expired => [],
        }, true);
    }
}
