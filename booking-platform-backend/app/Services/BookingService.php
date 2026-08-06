<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Exceptions\BookingException;
use App\Mail\BookingCancelled;
use App\Mail\BookingConfirmed;
use App\Mail\BookingPlaced;
use App\Models\Booking;
use App\Models\Service;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class BookingService
{
    public function __construct(private readonly AvailabilityService $availability) {}

    /**
     * Places a booking. The availability re-check and the insert happen inside
     * one transaction with the provider's overlapping rows locked, so two
     * clients racing for the last slot cannot both win.
     */
    public function create(User $client, Service $service, CarbonImmutable $startsAt, ?string $notes = null): Booking
    {
        if ($service->provider_id === $client->id) {
            throw new BookingException('You cannot book your own service.');
        }

        if (! $service->is_active) {
            throw new BookingException('This service is not accepting bookings right now.');
        }

        $booking = DB::transaction(function () use ($client, $service, $startsAt, $notes) {
            $reservedUntil = $startsAt->addMinutes($service->totalBlockMinutes());

            // Lock the provider's conflicting rows for the duration of the
            // transaction (a no-op on SQLite, a real row lock on MySQL).
            Booking::query()
                ->where('provider_id', $service->provider_id)
                ->blocking()
                ->overlapping($startsAt, $reservedUntil)
                ->lockForUpdate()
                ->get();

            if (! $this->availability->isSlotBookable($service, $startsAt)) {
                throw BookingException::slotUnavailable();
            }

            $booking = Booking::create([
                // Replaced with the id-derived code below; unique and collision-free.
                'code' => 'TMP-'.Str::uuid()->toString(),
                'client_id' => $client->id,
                'provider_id' => $service->provider_id,
                'service_id' => $service->id,
                'starts_at' => $startsAt,
                'ends_at' => $startsAt->addMinutes($service->duration_minutes),
                'duration_minutes' => $service->duration_minutes,
                // Snapshot the price so later edits to the service do not
                // retroactively change what this client agreed to pay.
                'price_amount' => $service->price,
                'currency' => $service->currency,
                'status' => BookingStatus::Pending,
                // A hold, not a booking. It reserves the slot only long enough
                // to pay; once this passes the slot is bookable by anyone else.
                'expires_at' => now()->addMinutes((int) config('booking.hold_minutes')),
                'notes' => $notes,
            ]);

            // Deriving the code from the auto-increment id keeps it unique
            // without a racy max(id)+1 lookup.
            $booking->update(['code' => 'BKG-'.str_pad((string) $booking->id, 6, '0', STR_PAD_LEFT)]);

            $service->increment('bookings_count');

            return $booking;
        });

        $booking->load(['service', 'provider', 'client']);
        $this->mail($booking->client->email, new BookingPlaced($booking));
        $this->mail($booking->provider->email, new BookingPlaced($booking, forProvider: true));

        return $booking;
    }

    /**
     * Promotes a hold into a real booking. Called when payment settles, or by
     * a provider accepting a request directly.
     */
    public function confirm(Booking $booking): Booking
    {
        $this->assertTransition($booking, BookingStatus::Confirmed);

        // Refuse to confirm a hold that already lapsed — the slot may have
        // been taken by someone else in the meantime.
        if ($booking->isExpiredHold() && ! $this->availability->isSlotBookable(
            $booking->service,
            CarbonImmutable::parse($booking->starts_at),
            ignoreBookingId: $booking->id,
        )) {
            throw new BookingException(
                'This reservation expired and the slot has since been taken. Any payment will be refunded.'
            );
        }

        $booking->update([
            'status' => BookingStatus::Confirmed,
            'confirmed_at' => now(),
            // No longer a hold.
            'expires_at' => null,
        ]);

        $booking->load(['service', 'provider', 'client']);
        $this->mail($booking->client->email, new BookingConfirmed($booking));

        return $booking;
    }

    /** Provider marks a finished appointment complete, which unlocks reviews. */
    public function complete(Booking $booking): Booking
    {
        $this->assertTransition($booking, BookingStatus::Completed);

        if ($booking->ends_at->isFuture()) {
            throw new BookingException('This booking cannot be completed before its end time.');
        }

        $booking->update([
            'status' => BookingStatus::Completed,
            'completed_at' => now(),
        ]);

        return $booking->fresh(['service', 'provider', 'client']);
    }

    /**
     * Either party may cancel. Clients are held to the free-cancellation
     * window; providers may cancel at any time (and the client is refunded).
     */
    public function cancel(Booking $booking, User $actor, ?string $reason = null): Booking
    {
        $this->assertTransition($booking, BookingStatus::Cancelled);

        $isClient = $actor->id === $booking->client_id;
        $isProvider = $actor->id === $booking->provider_id;
        $window = (int) config('booking.cancellation_window_hours');

        /*
         * A paid booking is a commitment the provider has taken money for, so
         * they cannot walk away from it unilaterally — the client would lose
         * their slot at the provider's convenience. Only the client may cancel
         * once payment has settled (and they are refunded when they do).
         * Admins retain an override for genuine disputes.
         */
        if ($isProvider && $booking->isPaid()) {
            throw new BookingException(
                'This booking has been paid for and cannot be cancelled from your side. '
                .'Contact the client to agree a change, or ask an administrator to intervene.',
                403
            );
        }

        if ($isClient && $booking->starts_at->isFuture() && now()->diffInHours($booking->starts_at, absolute: false) < $window) {
            throw new BookingException("Bookings can only be cancelled at least {$window} hours in advance. Please contact the provider directly.");
        }

        $booking->update([
            'status' => BookingStatus::Cancelled,
            'cancelled_at' => now(),
            'cancelled_by' => $actor->id,
            'cancellation_reason' => $reason,
        ]);

        $booking->load(['service', 'provider', 'client']);

        // Notify whichever party did not press the button.
        $this->mail(
            $isClient ? $booking->provider->email : $booking->client->email,
            new BookingCancelled($booking, $actor)
        );

        return $booking;
    }

    private function assertTransition(Booking $booking, BookingStatus $to): void
    {
        if (! $booking->status->canTransitionTo($to)) {
            throw BookingException::invalidTransition($booking->status->value, $to->value);
        }
    }

    /**
     * Mail must never take a booking down with it — an SMTP outage should not
     * roll back a paid appointment.
     */
    private function mail(string $to, \Illuminate\Mail\Mailable $mailable): void
    {
        try {
            Mail::to($to)->send($mailable);
        } catch (\Throwable $e) {
            Log::warning('Booking mail failed to send', [
                'to' => $to,
                'mailable' => $mailable::class,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
