<?php

namespace App\Services;

use App\Enums\PaymentStatus;
use App\Exceptions\BookingException;
use App\Models\Booking;
use App\Models\Payment;
use App\Support\Pricing;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Razorpay checkout, for clients paying from India.
 *
 * Deliberately much simpler than the Stripe path, because the money moves
 * differently:
 *
 *  - Razorpay settles INR natively, so there is no currency conversion and no
 *    conversion fee to pass on. The client pays the provider's price plus the
 *    platform commission and nothing else.
 *  - Razorpay Route is not enabled on this account, so there are no linked
 *    accounts and no automatic split. The whole amount lands in the platform's
 *    Razorpay balance and the provider's share is recorded as owed, to be
 *    settled separately.
 *
 * That second point is the important limitation: a Razorpay booking is *not*
 * paid out automatically. `Payment::destination_account` stays null, which is
 * what the ledger and the provider's earnings screen key off.
 *
 * Uses the HTTP API directly rather than the SDK — four endpoints and two HMAC
 * checks do not justify another dependency.
 */
class RazorpayService
{
    private const BASE = 'https://api.razorpay.com/v1';

    public function enabled(): bool
    {
        return filled(config('services.razorpay.key')) && filled(config('services.razorpay.secret'));
    }

    private function client(): PendingRequest
    {
        return Http::withBasicAuth(
            (string) config('services.razorpay.key'),
            (string) config('services.razorpay.secret'),
        )->acceptJson()->timeout(20);
    }

    /**
     * Creates (or reuses) the Razorpay order behind a booking.
     *
     * An Order is Razorpay's equivalent of a PaymentIntent: it fixes the
     * amount server-side so the browser cannot choose its own price.
     */
    public function createOrder(Booking $booking): array
    {
        if (! $this->enabled()) {
            throw new BookingException('Razorpay is not configured.', 503);
        }

        /*
         * No processing line: `withProcessingFor('razorpay')` is a no-op
         * because the gateway config marks it as not passing its cost on. The
         * client pays provider + commission, and Razorpay's own fee comes out
         * of the commission.
         */
        $split = Pricing::fromStored(
            $booking->provider_amount,
            $booking->platform_fee_amount,
            0,
            $booking->currency,
            $booking->platform_fee_bps,
        )->withProcessingFor('razorpay');

        $payment = $booking->payment;

        $payment ??= Payment::create([
            'booking_id' => $booking->id,
            'client_id' => $booking->client_id,
            'provider_id' => $booking->provider_id,
            'amount' => $split->total(),
            'currency' => $booking->currency,
            'status' => PaymentStatus::Pending,
            'gateway' => 'razorpay',
        ]);

        $response = $this->client()->post(self::BASE.'/orders', [
            'amount' => $split->totalMinor(),
            'currency' => strtoupper($split->currency),
            // Razorpay caps this at 40 characters.
            'receipt' => substr($booking->code, 0, 40),
            'notes' => [
                'booking_id' => (string) $booking->id,
                'booking_code' => $booking->code,
                'provider_amount' => (string) $split->providerAmount(),
                'platform_fee' => (string) $split->platformFee(),
            ],
        ]);

        if ($response->failed()) {
            Log::error('Razorpay order creation failed', [
                'booking' => $booking->code,
                'status' => $response->status(),
                'body' => $response->json(),
            ]);

            throw new BookingException(
                $response->json('error.description') ?? 'Could not start the payment.',
                422
            );
        }

        $order = $response->json();

        $booking->update([
            'processing_fee_amount' => 0,
            'price_amount' => $split->total(),
        ]);

        $payment->update([
            'gateway' => 'razorpay',
            'reference' => $order['id'],
            'amount' => $split->total(),
            'application_fee_amount' => $split->platformFee(),
            'processing_fee_amount' => 0,
            'refundable_amount' => $split->total(),
            // No Route, so nothing is transferred automatically — the
            // provider's share is owed, not sent.
            'destination_account' => null,
            'status' => PaymentStatus::Pending,
        ]);

        return [
            'payment' => $payment->fresh(),
            'order_id' => $order['id'],
            'amount' => $order['amount'],
            'currency' => $order['currency'],
            'gateway' => 'razorpay',
            'key' => config('services.razorpay.key'),
        ];
    }

    /**
     * Verifies the handshake the browser returns after checkout.
     *
     * The browser is not trusted: without this check anyone could POST a made-up
     * payment id and confirm a booking nobody paid for. Razorpay signs
     * `order_id|payment_id` with the API secret, so only someone holding that
     * secret could have produced it.
     */
    public function verifyCheckoutSignature(string $orderId, string $paymentId, string $signature): bool
    {
        $expected = hash_hmac(
            'sha256',
            $orderId.'|'.$paymentId,
            (string) config('services.razorpay.secret')
        );

        return hash_equals($expected, $signature);
    }

    /**
     * Verifies a webhook body against the secret you set in the dashboard.
     *
     * Note this signs the *raw* body — re-encoding the parsed JSON would
     * reorder keys and change whitespace, and the digest would never match.
     */
    public function verifyWebhookSignature(string $rawBody, ?string $signature): bool
    {
        $secret = (string) config('services.razorpay.webhook_secret');

        if ($secret === '' || ! $signature) {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $rawBody, $secret), $signature);
    }

    /** A single payment, straight from Razorpay. */
    public function fetchPayment(string $paymentId): ?array
    {
        $response = $this->client()->get(self::BASE."/payments/{$paymentId}");

        return $response->successful() ? $response->json() : null;
    }

    /**
     * Refunds a Razorpay payment.
     *
     * The whole amount goes back: with no conversion there is no conversion
     * fee to retain, and Razorpay's own fee is absorbed by the commission
     * rather than charged to the client. Nothing was transferred out, so
     * there is no transfer to reverse either — which is why this is three
     * lines where the Stripe equivalent is thirty.
     */
    public function refund(Payment $payment, ?string $reason = null): Payment
    {
        if (! $payment->charge_reference) {
            throw new BookingException('This payment has no Razorpay payment id to refund.', 422);
        }

        $response = $this->client()->post(
            self::BASE."/payments/{$payment->charge_reference}/refund",
            [
                'amount' => Pricing::toMinor((float) $payment->amount, $payment->currency),
                'speed' => 'normal',
                'notes' => ['reason' => $reason ?? 'Booking cancelled.'],
            ]
        );

        if ($response->failed()) {
            Log::error('Razorpay refund failed', [
                'payment_id' => $payment->id,
                'body' => $response->json(),
            ]);

            /*
             * Razorpay's own wording here is unusable — a declined refund comes
             * back as a bare "invalid request sent" with no reason or source,
             * which tells a client nothing and reads as though they did
             * something wrong. The real cause is almost always on the gateway's
             * side, most often insufficient balance to fund the refund.
             *
             * The raw text is kept in the log for us; the client gets something
             * true and actionable.
             */
            throw new BookingException(
                'The refund could not be processed by the payment provider, so this booking has '
                .'not been cancelled and you have not lost your payment. Please try again shortly, '
                .'or contact us and we will sort it out.',
                422
            );
        }

        $refund = $response->json();

        $payment->update([
            'status' => PaymentStatus::Refunded,
            'refunded_at' => now(),
            'refund_reference' => $refund['id'] ?? null,
            'refund_amount' => Pricing::toMajor((int) ($refund['amount'] ?? 0), $payment->currency),
            'application_fee_refunded' => $payment->application_fee_amount,
            'refund_reason' => $reason ?? 'Booking cancelled.',
        ]);

        return $payment->fresh();
    }
}
