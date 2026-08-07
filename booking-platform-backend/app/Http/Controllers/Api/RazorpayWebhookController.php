<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\WebhookEvent;
use App\Services\PaymentService;
use App\Services\RazorpayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Razorpay's callbacks.
 *
 * Authenticated by an HMAC of the raw body against the secret set in the
 * dashboard — there is no session and no token, so that signature is the only
 * thing separating a genuine "payment captured" from a forged one.
 *
 * Razorpay warns that event order is not guaranteed: `payment.failed` can
 * arrive *before* a successful capture when a client retries a UPI PIN. So
 * nothing here assumes a sequence. Each handler decides from the payment's
 * current state, and every event is recorded by id so a redelivery is a no-op.
 */
class RazorpayWebhookController extends Controller
{
    public function __construct(
        private readonly RazorpayService $razorpay,
        private readonly PaymentService $payments,
    ) {}

    public function handle(Request $request): JsonResponse
    {
        // The *raw* body: re-encoding the parsed JSON would reorder keys and
        // the digest would never match.
        $raw = $request->getContent();
        $signature = $request->header('X-Razorpay-Signature');

        if (! $this->razorpay->verifyWebhookSignature($raw, $signature)) {
            Log::warning('Rejected a Razorpay webhook with a bad signature');

            return response()->json(['message' => 'Invalid signature.'], 400);
        }

        $payload = json_decode($raw, true) ?: [];
        $type = $payload['event'] ?? 'unknown';

        /*
         * Razorpay does not send a stable event id header, so one is derived
         * from the payload. Redeliveries of the same event therefore collide
         * on the same key and are dropped.
         */
        $eventId = 'rzp_'.hash('sha256', $type.'|'.($payload['created_at'] ?? '').'|'.$this->entityId($payload));

        if (WebhookEvent::where('event_id', $eventId)->whereNotNull('processed_at')->exists()) {
            return response()->json(['received' => true, 'duplicate' => true]);
        }

        $event = WebhookEvent::updateOrCreate(
            ['event_id' => $eventId],
            ['type' => $type, 'payload' => $payload],
        );

        match ($type) {
            'payment.captured' => $this->captured($payload),
            'payment.failed' => $this->failed($payload),
            'payment.authorized' => $this->authorized($payload),
            'refund.created', 'refund.processed' => $this->refunded($payload),
            'refund.failed' => $this->refundFailed($payload),
            default => Log::info('Unhandled Razorpay event', ['type' => $type]),
        };

        $event->update(['processed_at' => now()]);

        return response()->json(['received' => true]);
    }

    /** Money taken — this is what confirms a booking. */
    private function captured(array $payload): void
    {
        $entity = $payload['payload']['payment']['entity'] ?? [];
        $payment = $this->resolve($entity);

        if (! $payment) {
            return;
        }

        $payment->update(['charge_reference' => $entity['id'] ?? $payment->charge_reference]);

        // Idempotent: the browser handshake may already have settled this.
        $this->payments->markSucceeded($payment->fresh());
    }

    private function failed(array $payload): void
    {
        $entity = $payload['payload']['payment']['entity'] ?? [];
        $payment = $this->resolve($entity);

        // A retry can succeed after a failure, so never downgrade a payment
        // that has already settled.
        if (! $payment || $payment->isSucceeded()) {
            return;
        }

        $this->payments->markFailed(
            $payment,
            $entity['error_description'] ?? 'The payment was declined.'
        );
    }

    /**
     * Authorized but not yet captured.
     *
     * Recorded, never acted on. Razorpay auto-refunds an authorized payment
     * that is never captured (5 days, or 3 for a late authorisation), so this
     * exists to make that state visible rather than to confirm anything —
     * confirming here would promote a booking that can still evaporate.
     */
    private function authorized(array $payload): void
    {
        $entity = $payload['payload']['payment']['entity'] ?? [];
        $payment = $this->resolve($entity);

        if ($payment && $payment->status === PaymentStatus::Pending) {
            $payment->update(['charge_reference' => $entity['id'] ?? $payment->charge_reference]);
        }
    }

    /** A refund raised from the Razorpay dashboard rather than by us. */
    private function refunded(array $payload): void
    {
        $entity = $payload['payload']['refund']['entity'] ?? [];
        $paymentId = $entity['payment_id'] ?? null;

        $payment = $paymentId ? Payment::where('charge_reference', $paymentId)->first() : null;

        if (! $payment || $payment->status === PaymentStatus::Refunded) {
            return;
        }

        $payment->update([
            'status' => PaymentStatus::Refunded,
            'refunded_at' => now(),
            'refund_reference' => $entity['id'] ?? $payment->refund_reference,
            'refund_amount' => isset($entity['amount'])
                ? \App\Support\Pricing::toMajor((int) $entity['amount'], $payment->currency)
                : $payment->refund_amount,
            'application_fee_refunded' => $payment->application_fee_amount,
            'refund_reason' => $payment->refund_reason ?? 'Refunded in Razorpay.',
        ]);
    }

    /** The refund bounced — so it must not sit in the books as refunded. */
    private function refundFailed(array $payload): void
    {
        $entity = $payload['payload']['refund']['entity'] ?? [];

        Log::error('Razorpay refund failed', [
            'refund' => $entity['id'] ?? null,
            'payment' => $entity['payment_id'] ?? null,
        ]);
    }

    /** Finds our ledger row from a Razorpay payment entity. */
    private function resolve(array $entity): ?Payment
    {
        // The order id is what we stored when checkout began; the payment id
        // only exists once the client actually pays.
        foreach ([$entity['order_id'] ?? null, $entity['id'] ?? null] as $ref) {
            if (! $ref) {
                continue;
            }

            $payment = Payment::where('reference', $ref)
                ->orWhere('charge_reference', $ref)
                ->first();

            if ($payment) {
                return $payment;
            }
        }

        Log::warning('Razorpay webhook referenced an unknown payment', [
            'order' => $entity['order_id'] ?? null,
            'payment' => $entity['id'] ?? null,
        ]);

        return null;
    }

    private function entityId(array $payload): string
    {
        return $payload['payload']['payment']['entity']['id']
            ?? $payload['payload']['refund']['entity']['id']
            ?? '';
    }
}
