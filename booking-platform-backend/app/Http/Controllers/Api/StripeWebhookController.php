<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;

class StripeWebhookController extends Controller
{
    public function __construct(private readonly PaymentService $payments) {}

    /**
     * Stripe posts here directly, so the route is public — the signature is
     * what authenticates it. An unverifiable payload is rejected outright.
     */
    public function handle(Request $request): JsonResponse
    {
        $secret = config('services.stripe.webhook_secret');

        if (blank($secret)) {
            Log::warning('Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set.');

            return response()->json(['received' => false], 400);
        }

        try {
            $event = Webhook::constructEvent(
                $request->getContent(),
                $request->header('Stripe-Signature', ''),
                $secret,
            );
        } catch (SignatureVerificationException $e) {
            Log::warning('Rejected Stripe webhook with an invalid signature.', ['error' => $e->getMessage()]);

            return response()->json(['received' => false], 400);
        } catch (\UnexpectedValueException $e) {
            return response()->json(['received' => false], 400);
        }

        $this->payments->handleWebhookEvent(
            $event->id,
            $event->type,
            json_decode(json_encode($event->toArray()), true),
        );

        return response()->json(['received' => true]);
    }
}
