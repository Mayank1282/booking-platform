<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Http\Resources\PaymentResource;
use App\Models\Booking;
use App\Services\PaymentService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly PaymentService $payments) {}

    /** Starts checkout for a booking and hands the client its payment secret. */
    public function createIntent(Request $request, Booking $booking): JsonResponse
    {
        abort_unless($booking->client_id === $request->user()->id, 403, 'This booking does not belong to you.');

        $result = $this->payments->createIntent($booking->load('service'));

        return $this->ok([
            'payment' => new PaymentResource($result['payment']),
            'client_secret' => $result['client_secret'],
            'gateway' => $result['gateway'],
            'publishable_key' => $result['publishable_key'],
        ], 'Payment ready.');
    }

    /**
     * Simulated-gateway settlement. Only reachable when Stripe is not
     * configured — with real keys, settlement happens through the webhook.
     */
    public function simulate(Request $request, Booking $booking): JsonResponse
    {
        abort_unless($booking->client_id === $request->user()->id, 403, 'This booking does not belong to you.');

        if ($this->payments->usesStripe()) {
            return $this->fail('Stripe is configured — use the real checkout flow.', 422);
        }

        $validated = $request->validate([
            'outcome' => ['required', 'in:success,failure'],
        ]);

        $payment = $booking->payment;

        if (! $payment) {
            return $this->fail('Start the payment before confirming it.', 422);
        }

        $payment = $validated['outcome'] === 'success'
            ? $this->payments->markSucceeded($payment, receiptUrl: null)
            : $this->payments->markFailed($payment, 'The simulated card was declined.');

        return $this->ok([
            'payment' => new PaymentResource($payment),
            'booking' => new BookingResource($booking->fresh(['service.category', 'client', 'provider', 'payment'])),
        ], $payment->isSucceeded() ? 'Payment successful — booking confirmed.' : 'Payment failed.');
    }

    /**
     * Called when the client returns from Stripe. The webhook is the source of
     * truth; this just lets the UI reflect the result immediately rather than
     * waiting for the webhook to land.
     */
    public function syncStatus(Request $request, Booking $booking): JsonResponse
    {
        abort_unless($booking->client_id === $request->user()->id, 403, 'This booking does not belong to you.');

        $payment = $booking->payment;

        if (! $payment || ! $this->payments->usesStripe() || ! $payment->reference) {
            return $this->ok(['payment' => $payment ? new PaymentResource($payment) : null]);
        }

        $intent = $this->payments->stripe()->paymentIntents->retrieve($payment->reference);

        /*
         * Map Stripe's intent status onto ours. `requires_payment_method` and
         * `requires_confirmation` mean nothing has been charged yet, so those
         * stay Pending rather than looking like a payment in flight.
         */
        $payment = match ($intent->status) {
            'succeeded' => $this->payments->markSucceeded($payment),
            'processing' => tap($payment)->update(['status' => PaymentStatus::Processing]),
            'canceled' => $this->payments->markFailed($payment, 'The payment was cancelled.'),
            'requires_payment_method', 'requires_confirmation', 'requires_action' => tap($payment)
                ->update(['status' => PaymentStatus::Pending]),
            default => $payment,
        };

        return $this->ok([
            'payment' => new PaymentResource($payment),
            'booking' => new BookingResource($booking->fresh(['service.category', 'client', 'provider', 'payment'])),
        ]);
    }

    /** Payment history for the signed-in user, in whichever role they hold. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $payments = $user->isProvider()
            ? $user->paymentsAsProvider()
            : $user->paymentsAsClient();

        $results = $payments
            ->with('booking.service')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->latest()
            ->paginate(min((int) $request->integer('per_page', 15), 50));

        return $this->paginated(PaymentResource::collection($results));
    }
}
