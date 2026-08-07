<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Http\Resources\PaymentResource;
use App\Models\Booking;
use App\Services\PaymentService;
use App\Services\RazorpayService;
use App\Support\Pricing;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly PaymentService $payments,
        private readonly RazorpayService $razorpay,
    ) {}

    /**
     * Starts a payment on the gateway the client picked.
     *
     * The same booking is a different total depending on the answer: Stripe
     * settles this platform in USD and passes its card and conversion costs
     * on, Razorpay settles INR natively and does not. So the choice is made
     * here, server-side, and the amount is derived from it — never sent up by
     * the browser.
     */
    public function createIntent(Request $request, Booking $booking): JsonResponse
    {
        abort_unless($booking->client_id === $request->user()->id, 403, 'This booking does not belong to you.');

        $gateway = $request->string('gateway')->toString() ?: 'stripe';

        abort_unless(
            (bool) config("booking.payments.gateways.{$gateway}.enabled"),
            422,
            'That payment method is not available.'
        );

        $booking->load('service');

        if ($gateway === 'razorpay') {
            $result = $this->razorpay->createOrder($booking);

            return $this->ok([
                'payment' => new PaymentResource($result['payment']),
                'gateway' => 'razorpay',
                'order_id' => $result['order_id'],
                'amount' => $result['amount'],
                'currency' => $result['currency'],
                'key' => $result['key'],
            ], 'Payment ready.');
        }

        $result = $this->payments->createIntent($booking);

        return $this->ok([
            'payment' => new PaymentResource($result['payment']),
            'client_secret' => $result['client_secret'],
            'gateway' => $result['gateway'],
            'publishable_key' => $result['publishable_key'],
        ], 'Payment ready.');
    }

    /** Which gateways this client may choose between, and what each costs. */
    public function gateways(Request $request, Booking $booking): JsonResponse
    {
        abort_unless($booking->client_id === $request->user()->id, 403, 'This booking does not belong to you.');

        $base = Pricing::fromStored(
            $booking->provider_amount,
            $booking->platform_fee_amount,
            0,
            $booking->currency,
            $booking->platform_fee_bps,
        );

        $options = [];

        foreach ((array) config('booking.payments.gateways') as $name => $config) {
            if (! ($config['enabled'] ?? false)) {
                continue;
            }

            $priced = $base->withProcessingFor($name);

            $options[] = [
                'gateway' => $name,
                'label' => $config['label'] ?? ucfirst($name),
                'pricing' => $priced->toArray(),
            ];
        }

        return $this->ok($options);
    }

    /**
     * Confirms a Razorpay checkout from the browser's handshake.
     *
     * The signature is what makes this trustworthy: it is HMAC'd from
     * `order_id|payment_id` with the API secret, so a forged payment id cannot
     * produce a valid one. Without this check anyone could confirm a booking
     * nobody paid for.
     */
    public function confirmRazorpay(Request $request, Booking $booking): JsonResponse
    {
        abort_unless($booking->client_id === $request->user()->id, 403, 'This booking does not belong to you.');

        $data = $request->validate([
            'razorpay_order_id' => ['required', 'string'],
            'razorpay_payment_id' => ['required', 'string'],
            'razorpay_signature' => ['required', 'string'],
        ]);

        $valid = $this->razorpay->verifyCheckoutSignature(
            $data['razorpay_order_id'],
            $data['razorpay_payment_id'],
            $data['razorpay_signature'],
        );

        abort_unless($valid, 422, 'That payment could not be verified.');

        $payment = $booking->payment;

        abort_unless(
            $payment && $payment->reference === $data['razorpay_order_id'],
            422,
            'That payment does not belong to this booking.'
        );

        $payment->update(['charge_reference' => $data['razorpay_payment_id']]);

        // Settling confirms the booking, exactly as the Stripe path does. The
        // webhook may also arrive; both are idempotent.
        $this->payments->markSucceeded($payment->fresh());

        return $this->ok([
            'payment' => new PaymentResource($payment->fresh()),
            'booking' => new BookingResource($booking->fresh(['service', 'provider', 'payment'])),
        ], 'Payment received — your booking is confirmed.');
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
