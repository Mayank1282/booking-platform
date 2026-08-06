<?php

namespace App\Console\Commands;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Services\PaymentService;
use Illuminate\Console\Command;

/**
 * Marks lapsed holds as expired and voids their unpaid intents.
 *
 * This is housekeeping, not correctness: `Booking::scopeBlocking` already
 * ignores a hold past its expiry, so the slot is free the moment the clock
 * runs out whether or not this ever runs. What this does is stop abandoned
 * attempts sitting in listings and dashboards forever labelled "awaiting
 * payment", and release the matching PaymentIntent at Stripe.
 */
class ExpireStaleBookings extends Command
{
    protected $signature = 'bookings:expire';

    protected $description = 'Expire unpaid booking holds whose payment window has passed';

    public function handle(PaymentService $payments): int
    {
        $stale = Booking::with('payment')
            ->where('status', BookingStatus::Pending)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->get();

        if ($stale->isEmpty()) {
            $this->info('No holds to expire.');

            return self::SUCCESS;
        }

        foreach ($stale as $booking) {
            // Never expire something that was actually paid for — treat that as
            // a booking whose confirmation was missed, and confirm it instead.
            if ($booking->payment?->isSucceeded()) {
                $booking->update([
                    'status' => BookingStatus::Confirmed,
                    'confirmed_at' => $booking->confirmed_at ?? now(),
                    'expires_at' => null,
                ]);

                $this->warn("{$booking->code} was paid but never confirmed — confirmed now.");

                continue;
            }

            $booking->update([
                'status' => BookingStatus::Expired,
                'expires_at' => null,
            ]);

            if ($booking->payment) {
                $payments->voidUnpaidIntent($booking->payment);
            }

            $this->line("{$booking->code} expired — slot released.");
        }

        $this->info("Processed {$stale->count()} hold(s).");

        return self::SUCCESS;
    }
}
