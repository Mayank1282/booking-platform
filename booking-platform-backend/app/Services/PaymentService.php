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
            // Still Pending: a PaymentIntent that exists is only an *offer* to
            // pay. Stripe reports it as `requires_payment_method` until a card
            // is actually submitted. Marking it Processing here made unpaid
            // bookings display as mid-payment forever.
            'status' => PaymentStatus::Pending,
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
    public function markSucceeded(Payment $payment, ?string $receiptUrl = null, ?string $chargeId = null): Payment
    {
        if ($payment->isSucceeded()) {
            return $payment;
        }

        /*
         * Pull the charge id and receipt straight from Stripe when they were
         * not supplied. The browser-return path has no webhook payload to read
         * them from, and losing them would leave a settled payment with no link
         * to the actual charge.
         */
        if ($this->usesStripe() && $payment->gateway === 'stripe' && $payment->reference && ! $chargeId) {
            try {
                $intent = $this->stripe()->paymentIntents->retrieve($payment->reference, [
                    'expand' => ['latest_charge'],
                ]);

                $charge = $intent->latest_charge ?? null;
                $chargeId = is_object($charge) ? $charge->id : $charge;
                $receiptUrl ??= is_object($charge) ? ($charge->receipt_url ?? null) : null;
            } catch (\Throwable $e) {
                Log::warning('Could not read charge details from Stripe', [
                    'payment_id' => $payment->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        DB::transaction(function () use ($payment, $receiptUrl, $chargeId) {
            $payment->update([
                'status' => PaymentStatus::Succeeded,
                'paid_at' => now(),
                'receipt_url' => $receiptUrl ?? $payment->receipt_url,
                'charge_reference' => $chargeId ?? $payment->charge_reference,
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

    /**
     * Voids an unpaid PaymentIntent when its booking is cancelled.
     *
     * Without this, cancelling a booking someone opened checkout for leaves a
     * live intent in Stripe that could still be confirmed afterwards — paying
     * for a booking that no longer exists.
     */
    public function voidUnpaidIntent(Payment $payment): void
    {
        if ($payment->isSucceeded() || $payment->status === PaymentStatus::Refunded) {
            return;
        }

        if ($this->usesStripe() && $payment->gateway === 'stripe' && $payment->reference) {
            try {
                $intent = $this->stripe()->paymentIntents->retrieve($payment->reference);

                // Only these are cancellable; anything settled is handled by refund().
                if (in_array($intent->status, [
                    'requires_payment_method', 'requires_confirmation',
                    'requires_action', 'requires_capture',
                ], true)) {
                    $this->stripe()->paymentIntents->cancel($payment->reference);
                }
            } catch (\Throwable $e) {
                // Tidying up must never block a cancellation the user asked for.
                Log::warning('Could not void PaymentIntent', [
                    'payment_id' => $payment->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $payment->update([
            'status' => PaymentStatus::Failed,
            'failure_reason' => 'The booking was cancelled before payment was completed.',
        ]);
    }

    /**
     * Refunds a settled payment (used when a booking with a paid charge is
     * cancelled).
     *
     * The refund's own id is stored alongside the payment so our ledger can be
     * reconciled against Stripe's line by line — without it there is no way to
     * prove which Stripe refund corresponds to which booking.
     */
    public function refund(Payment $payment, ?string $reason = null): Payment
    {
        if (! $payment->isRefundable()) {
            throw new BookingException('Only a settled payment can be refunded.');
        }

        $refundId = null;
        $refundAmount = (float) $payment->amount;

        if ($this->usesStripe() && $payment->gateway === 'stripe' && $payment->reference) {
            $refund = $this->stripe()->refunds->create(['payment_intent' => $payment->reference]);

            $refundId = $refund->id;
            $refundAmount = $this->fromMinorUnits($refund->amount, $refund->currency);
        }

        $payment->update([
            'status' => PaymentStatus::Refunded,
            'refunded_at' => now(),
            'refund_reference' => $refundId,
            'refund_amount' => $refundAmount,
            'refund_reason' => $reason ?? 'Booking cancelled.',
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
                    $intent['charges']['data'][0]['receipt_url'] ?? null,
                    // `latest_charge` on newer API versions, `charges.data` on older.
                    $intent['latest_charge'] ?? ($intent['charges']['data'][0]['id'] ?? null),
                ),
                'payment_intent.payment_failed' => $this->markFailed(
                    $payment,
                    $intent['last_payment_error']['message'] ?? null
                ),
                // A refund issued from the Stripe dashboard rather than by us,
                // so the ids still land in our ledger.
                'charge.refunded' => $payment->update([
                    'status' => PaymentStatus::Refunded,
                    'refunded_at' => now(),
                    'charge_reference' => $intent['id'] ?? $payment->charge_reference,
                    'refund_reference' => $intent['refunds']['data'][0]['id'] ?? $payment->refund_reference,
                    'refund_amount' => isset($intent['amount_refunded'])
                        ? $this->fromMinorUnits((int) $intent['amount_refunded'], $intent['currency'] ?? 'inr')
                        : $payment->refund_amount,
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

    /** The inverse, for reading amounts back out of Stripe responses. */
    private function fromMinorUnits(int $amount, string $currency): float
    {
        $zeroDecimal = (array) config('booking.payments.zero_decimal_currencies');

        return in_array(strtolower($currency), $zeroDecimal, true)
            ? (float) $amount
            : $amount / 100;
    }
}
