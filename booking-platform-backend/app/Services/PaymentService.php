<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\BookingException;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\WebhookEvent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Stripe\StripeClient;

/**
 * Wraps Stripe PaymentIntents. When no Stripe secret is configured the service
 * transparently falls back to a simulated gateway so the whole booking →
 * payment → confirmation lifecycle still runs locally and in the demo.
 */
class PaymentService
{
    public function __construct(private readonly BookingService $bookings) {}

    public function usesStripe(): bool
    {
        return filled(config('services.stripe.secret'));
    }

    public function gatewayName(): string
    {
        return $this->usesStripe() ? 'stripe' : 'simulated';
    }

    /**
     * Creates (or reuses) the PaymentIntent for a booking and returns the
     * payment row plus the client secret the frontend needs.
     *
     * @return array{payment: Payment, client_secret: string|null, gateway: string, publishable_key: string|null}
     */
    public function createIntent(Booking $booking): array
    {
        if ($booking->status === BookingStatus::Cancelled) {
            throw new BookingException('This booking was cancelled and can no longer be paid for.');
        }

        $payment = $booking->payment;

        if ($payment?->isSucceeded()) {
            throw new BookingException('This booking has already been paid for.');
        }

        $payment ??= Payment::create([
            'booking_id' => $booking->id,
            'client_id' => $booking->client_id,
            'provider_id' => $booking->provider_id,
            'amount' => $booking->price_amount,
            'currency' => $booking->currency,
            'status' => PaymentStatus::Pending,
            'gateway' => $this->gatewayName(),
        ]);

        if (! $this->usesStripe()) {
            // Simulated gateway: hand back a fake secret the frontend can
            // "confirm" against the /simulate endpoint.
            $payment->update([
                'gateway' => 'simulated',
                'reference' => $payment->reference ?? 'sim_'.Str::random(24),
                'client_secret' => $payment->client_secret ?? 'sim_secret_'.Str::random(24),
                'status' => PaymentStatus::Pending,
            ]);

            return [
                'payment' => $payment->fresh(),
                'client_secret' => $payment->client_secret,
                'gateway' => 'simulated',
                'publishable_key' => null,
            ];
        }

        $intent = $this->stripe()->paymentIntents->create([
            'amount' => $this->toMinorUnits((float) $booking->price_amount, $booking->currency),
            'currency' => strtolower($booking->currency),
            'metadata' => [
                'booking_id' => (string) $booking->id,
                'booking_code' => $booking->code,
                'payment_id' => (string) $payment->id,
            ],
            'description' => "Booking {$booking->code} — {$booking->service->title}",
            'automatic_payment_methods' => ['enabled' => true],
        ]);

        $payment->update([
            'gateway' => 'stripe',
            'reference' => $intent->id,
            'client_secret' => $intent->client_secret,
            'status' => PaymentStatus::Processing,
        ]);

        return [
            'payment' => $payment->fresh(),
            'client_secret' => $intent->client_secret,
            'gateway' => 'stripe',
            'publishable_key' => config('services.stripe.key'),
        ];
    }

    /**
     * Settles a payment and confirms its booking. Idempotent — replaying it for
     * an already-succeeded payment is a no-op, which matters because both the
     * client redirect and the Stripe webhook can arrive for the same charge.
     */
    public function markSucceeded(Payment $payment, ?string $receiptUrl = null): Payment
    {
        if ($payment->isSucceeded()) {
            return $payment;
        }

        DB::transaction(function () use ($payment, $receiptUrl) {
            $payment->update([
                'status' => PaymentStatus::Succeeded,
                'paid_at' => now(),
                'receipt_url' => $receiptUrl ?? $payment->receipt_url,
                'failure_reason' => null,
            ]);

            $booking = $payment->booking;

            // A successful payment is what promotes a pending booking to confirmed.
            if ($booking && $booking->status === BookingStatus::Pending) {
                $this->bookings->confirm($booking);
            }
        });

        return $payment->fresh('booking');
    }

    public function markFailed(Payment $payment, ?string $reason = null): Payment
    {
        $payment->update([
            'status' => PaymentStatus::Failed,
            'failure_reason' => $reason ?? 'The payment could not be completed.',
        ]);

        return $payment->fresh();
    }

    /** Refunds a settled payment (used when a provider cancels a paid booking). */
    public function refund(Payment $payment): Payment
    {
        if (! $payment->isRefundable()) {
            throw new BookingException('Only a settled payment can be refunded.');
        }

        if ($this->usesStripe() && $payment->gateway === 'stripe' && $payment->reference) {
            $this->stripe()->refunds->create(['payment_intent' => $payment->reference]);
        }

        $payment->update([
            'status' => PaymentStatus::Refunded,
            'refunded_at' => now(),
        ]);

        return $payment->fresh();
    }

    /**
     * Handles a verified Stripe event. Stripe delivers at-least-once, so the
     * event id is recorded first and duplicates are dropped.
     */
    public function handleWebhookEvent(string $eventId, string $type, array $payload): void
    {
        $alreadySeen = WebhookEvent::where('event_id', $eventId)->whereNotNull('processed_at')->exists();

        if ($alreadySeen) {
            Log::info('Skipping duplicate Stripe webhook', ['event_id' => $eventId, 'type' => $type]);

            return;
        }

        $event = WebhookEvent::updateOrCreate(
            ['event_id' => $eventId],
            ['type' => $type, 'payload' => $payload]
        );

        $intent = $payload['data']['object'] ?? [];
        $payment = filled($intent['id'] ?? null)
            ? Payment::where('reference', $intent['id'])->first()
            : null;

        if ($payment) {
            match ($type) {
                'payment_intent.succeeded' => $this->markSucceeded(
                    $payment,
                    $intent['charges']['data'][0]['receipt_url'] ?? null
                ),
                'payment_intent.payment_failed' => $this->markFailed(
                    $payment,
                    $intent['last_payment_error']['message'] ?? null
                ),
                'charge.refunded' => $payment->update([
                    'status' => PaymentStatus::Refunded,
                    'refunded_at' => now(),
                ]),
                default => Log::info('Unhandled Stripe event type', ['type' => $type]),
            };
        } else {
            Log::warning('Stripe webhook referenced an unknown payment', ['event_id' => $eventId, 'type' => $type]);
        }

        $event->update(['processed_at' => now()]);
    }

    public function stripe(): StripeClient
    {
        return new StripeClient(config('services.stripe.secret'));
    }

    /** Stripe wants the smallest currency unit — paise for INR, cents for USD. */
    private function toMinorUnits(float $amount, string $currency): int
    {
        $zeroDecimal = (array) config('booking.payments.zero_decimal_currencies');

        return in_array(strtolower($currency), $zeroDecimal, true)
            ? (int) round($amount)
            : (int) round($amount * 100);
    }
}
