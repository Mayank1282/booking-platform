<?php

namespace App\Enums;

enum BookingStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return ucfirst($this->value);
    }

    /**
     * Statuses that still occupy a slot in the provider's calendar.
     * Cancelled bookings free their slot; completed ones are in the past.
     */
    public static function blocking(): array
    {
        return [self::Pending->value, self::Confirmed->value];
    }

    /** Which statuses a booking may legally move to from here. */
    public function canTransitionTo(self $next): bool
    {
        return in_array($next, match ($this) {
            self::Pending => [self::Confirmed, self::Cancelled],
            self::Confirmed => [self::Completed, self::Cancelled],
            self::Completed, self::Cancelled => [],
        }, true);
    }
}
