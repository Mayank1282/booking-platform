<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\BookingException;
use App\Mail\PaymentRefunded;
use App\Support\Pricing;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\ProviderProfile;
use App\Models\WebhookEvent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Stripe\StripeClient;

/**
 * Wraps Stripe PaymentIntents. When no Stripe secret is configured the service
 * transparently falls back to a simulated gateway so the whole booking →
 * payment → confirmation lifecycle still runs locally and in the demo.
 */
class PaymentService
{
    public function __construct(
        private readonly BookingService $bookings,
        private readonly StripeConnectService $connect,
    ) {}

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
            // The client is charged the total; the commission inside it is
            // recorded alongside so the ledger shows the split even when the
            // provider cannot be paid out yet.
            'amount' => $booking->price_amount,
            'application_fee_amount' => $booking->platform_fee_amount,
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

        /*
         * Destination charge.
         *
         * The card is taken on the platform account, Stripe keeps
         * `application_fee_amount` here, and the remainder is transferred to
         * the provider's connected account. Because the provider's share is
         * `amount - application_fee`, a provider who listed ₹800 receives
         * exactly ₹800 — Stripe's own processing fee comes out of the
         * platform's balance, i.e. out of our commission, not theirs.
         *
         * A provider who has not finished onboarding has nowhere to receive
         * money yet. Rather than block the booking, the charge is taken
         * without a destination and the split stays recorded on our side;
         * they are paid once their account is live.
         */
        /*
         * The booking is worth provider + commission. Stripe's processing and
         * conversion are added here, at checkout, because they are a cost of
         * *this* gateway — a Razorpay checkout for the same booking carries
         * neither.
         */
        $split = Pricing::fromStored(
            $booking->provider_amount,
            $booking->platform_fee_amount,
            0,
            $booking->currency,
            $booking->platform_fee_bps,
        )->withProcessingFor('stripe');

        // Record what this gateway added, so the booking reflects what was
        // actually charged rather than what it was listed at.
        $booking->update([
            'processing_fee_amount' => $split->processingFee(),
            'price_amount' => $split->total(),
        ]);

        $destination = $this->connect->destinationFor($booking->provider);

        $params = [
            'amount' => $split->totalMinor(),
            'currency' => $split->currency,
            'metadata' => [
                'booking_id' => (string) $booking->id,
                'booking_code' => $booking->code,
                'payment_id' => (string) $payment->id,
                'provider_amount' => (string) $split->providerAmount(),
                'platform_fee' => (string) $split->platformFee(),
                'processing_fee' => (string) $split->processingFee(),
                'refundable' => (string) $split->refundable(),
            ],
            'description' => "Booking {$booking->code} — {$booking->service->title}",
            'automatic_payment_methods' => ['enabled' => true],
        ];

        // Let Stripe remember the client's card between bookings.
        if ($customerId = $this->connect->ensureCustomer($booking->client)) {
            $params['customer'] = $customerId;
        }

        if ($destination) {
            $params['transfer_data'] = ['destination' => $destination];

            /*
             * Held back from the transfer: the commission *and* the processing
             * pass-through. Stripe deducts its own fee from the platform
             * balance, so the platform receives both and pays Stripe out of
             * the second — netting the commission alone.
             *
             * The provider receives `total - application_fee`, which is
             * exactly the amount they listed. They are untouched by the
             * commission and untouched by Stripe's fees.
             */
            if ($split->applicationFeeMinor() > 0) {
                $params['application_fee_amount'] = $split->applicationFeeMinor();
            }
        }

        $intent = $this->stripe()->paymentIntents->create($params);

        $payment->update([
            'gateway' => 'stripe',
            'reference' => $intent->id,
            'client_secret' => $intent->client_secret,
            'amount' => $split->total(),
            // Recorded either way: the split is known whether or not the
            // provider's payout account is live yet.
            'application_fee_amount' => $split->platformFee(),
            'processing_fee_amount' => $split->processingFee(),
            'refundable_amount' => $split->refundable(),
            'destination_account' => $destination,
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

        // Outside the transaction: these are extra Stripe round-trips, and a
        // slow or failed read must not roll back a payment that has settled.
        $this->captureSettlement($payment->fresh());

        return $payment->fresh('booking');
    }

    /**
     * Records what Stripe actually kept and what the money became.
     *
     * Our own arithmetic knows the INR split, but not Stripe's processing fee
     * or the rate it converted at — those exist only on Stripe's side and have
     * to be read back. Without them the books cannot be reconciled, and a
     * refund has no way to know how much was really deducted.
     */
    public function captureSettlement(Payment $payment): Payment
    {
        if (! $this->usesStripe() || $payment->gateway !== 'stripe' || ! $payment->charge_reference) {
            return $payment;
        }

        try {
            $charge = $this->connect->withoutStripeNotices(
                fn () => $this->stripe()->charges->retrieve($payment->charge_reference)
            );

            $updates = [];

            // The balance transaction is the platform's own view of the
            // charge: the settled amount, Stripe's cut and the rate applied.
            if ($charge->balance_transaction) {
                $tx = $this->connect->withoutStripeNotices(
                    fn () => $this->stripe()->balanceTransactions->retrieve($charge->balance_transaction)
                );

                $updates += [
                    'settlement_currency' => strtoupper($tx->currency),
                    'settlement_amount' => $this->fromMinorUnits($tx->amount, $tx->currency),
                    'stripe_fee' => $this->fromMinorUnits($tx->fee, $tx->currency),
                    'net_amount' => $this->fromMinorUnits($tx->net, $tx->currency),
                    'exchange_rate' => $tx->exchange_rate,
                ];
            }

            // The transfer settles in the provider's own currency, which is
            // not necessarily the one the client paid in.
            if ($charge->transfer) {
                $transfer = $this->connect->withoutStripeNotices(
                    fn () => $this->stripe()->transfers->retrieve($charge->transfer)
                );

                $updates += [
                    'transfer_reference' => $transfer->id,
                    'transfer_amount' => $this->fromMinorUnits($transfer->amount, $transfer->currency),
                    'transfer_currency' => strtoupper($transfer->currency),
                ];
            }

            if ($updates) {
                $payment->update($updates);
                $payment = $payment->fresh();
                $this->recordPlatformPosition($payment);
            }
        } catch (\Throwable $e) {
            Log::warning('Could not capture settlement details from Stripe', [
                'payment_id' => $payment->id,
                'error' => $e->getMessage(),
            ]);
        }

        return $payment->fresh();
    }

    /**
     * What the platform is actually left with, in its own settlement currency.
     *
     * Positive is profit, negative means the booking cost money. After a
     * refund this should land near zero: the processing charged to the client
     * is sized to cover the fee Stripe keeps.
     */
    private function recordPlatformPosition(Payment $payment): void
    {
        if ($payment->settlement_amount === null) {
            return;
        }

        $rate = (float) ($payment->exchange_rate ?: 0);

        // Convert the presentment-currency figures using the rate Stripe
        // actually applied, so every term below is in the same units.
        $toSettlement = fn (float $presentment) => $rate > 0
            ? round($presentment * $rate, 2)
            : $presentment;

        /*
         * The platform's position, from its own balance's point of view.
         *
         * The gross charge and the transfer out cancel each other on a
         * destination charge — what the platform actually keeps is the
         * application fee, less what Stripe took. So the arithmetic starts
         * from the fee rather than from the charge.
         */
        $applicationFee = $toSettlement(
            (float) $payment->application_fee_amount + (float) $payment->processing_fee_amount
        );
        $stripeFee = (float) $payment->stripe_fee;

        $net = $applicationFee - $stripeFee;

        if ($payment->refunded_at) {
            // Refunding pays the client out of the platform balance; the
            // reversal brings the provider's share back into it; and the fee
            // returned with that reversal goes back out again.
            $net = $net
                - $toSettlement((float) $payment->refund_amount)
                + (float) $payment->transfer_reversed_amount
                - $applicationFee;
        }

        $payment->forceFill(['platform_net_amount' => round($net, 2)])->save();
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

        /*
         * Route by gateway before anything else.
         *
         * Everything below this point speaks Stripe, and every Stripe call is
         * guarded on `gateway === 'stripe'`. A Razorpay payment therefore fell
         * straight through all of them and was marked Refunded in our ledger
         * without a single rupee moving — while the client was emailed to say
         * their refund was on its way. Silent, and the worst kind of wrong.
         */
        if ($payment->gateway === 'razorpay') {
            $payment = app(RazorpayService::class)->refund($payment, $reason);
            $this->notifyRefunded($payment);

            return $payment;
        }

        /*
         * The transfer reference is normally captured when the charge settles,
         * but that happens on the webhook — and a client can cancel before it
         * lands. Without it the clawback below is silently skipped and the
         * provider keeps the money for a booking that never happened, so make
         * sure it is there before refunding anything.
         */
        if ($payment->destination_account && ! $payment->transfer_reference) {
            $payment = $this->captureSettlement($payment);
        }

        $split = Pricing::fromStored(
            (float) $payment->amount
                - (float) $payment->application_fee_amount
                - (float) $payment->processing_fee_amount,
            $payment->application_fee_amount,
            $payment->processing_fee_amount,
            $payment->currency,
        );

        $refundId = null;
        $refundAmount = $split->refundable();
        $reversedAmount = 0.0;

        if ($this->usesStripe() && $payment->gateway === 'stripe' && $payment->reference) {
            /*
             * The client gets back everything except the processing they have
             * already cost us. Stripe keeps its fee when a charge is reversed,
             * so refunding that too would mean the platform paying Stripe out
             * of its own pocket for an appointment nobody received. Retaining
             * it leaves the provider whole, the platform level, and the loss
             * exactly where the money actually went.
             *
             * `reverse_transfer` is deliberately NOT used: on a partial refund
             * Stripe reverses the transfer *proportionally*, which would leave
             * the provider holding a slice of a booking that never happened.
             * The reversal is issued explicitly below, in full.
             */
            $refund = $this->stripe()->refunds->create([
                'payment_intent' => $payment->reference,
                'amount' => $split->refundableMinor(),
                'metadata' => [
                    'payment_id' => (string) $payment->id,
                    'processing_retained' => (string) $split->processingFee(),
                ],
            ]);

            $refundId = $refund->id;
            $refundAmount = $this->fromMinorUnits($refund->amount, $refund->currency);

            if ($payment->transfer_reference) {
                $reversedAmount = $this->reverseTransferInFull($payment);
            }
        }

        $payment->update([
            'status' => PaymentStatus::Refunded,
            'refunded_at' => now(),
            'refund_reference' => $refundId,
            'refund_amount' => $refundAmount,
            // The commission goes back to the client; the processing does not.
            'application_fee_refunded' => $split->platformFee(),
            'stripe_fee_refunded' => 0,
            'transfer_reversed_amount' => $reversedAmount,
            'refund_reason' => $reason ?? 'Booking cancelled.',
        ]);

        $payment = $payment->fresh();
        $this->recordPlatformPosition($payment);
        $payment = $payment->fresh();
        $this->notifyRefunded($payment);

        return $payment;
    }

    /**
     * Reverses the whole transfer to the connected account.
     *
     * Issued as its own call rather than through `reverse_transfer` on the
     * refund, because that reverses in proportion to a partial refund — and
     * this refund is deliberately partial. The provider owes back all of their
     * share, not the fraction that happens to match.
     */
    private function reverseTransferInFull(Payment $payment): float
    {
        try {
            $transfer = $this->connect->withoutStripeNotices(
                fn () => $this->stripe()->transfers->retrieve($payment->transfer_reference)
            );

            $outstanding = $transfer->amount - $transfer->amount_reversed;

            if ($outstanding <= 0) {
                return $this->fromMinorUnits($transfer->amount_reversed, $transfer->currency);
            }

            /*
             * `refund_application_fee` is essential, not optional.
             *
             * On a destination charge Stripe transfers the gross amount and
             * then deducts the application fee from the *connected account's*
             * balance — so the provider nets transfer minus fee. Reversing the
             * gross without returning the fee claws back more than they ever
             * received, leaving the provider out of pocket on a booking that
             * was cancelled. Returning it alongside puts them back at zero.
             */
            $reversal = $this->connect->withoutStripeNotices(
                fn () => $this->stripe()->transfers->createReversal(
                    $payment->transfer_reference,
                    ['amount' => $outstanding, 'refund_application_fee' => true]
                )
            );

            return $this->fromMinorUnits(
                $transfer->amount_reversed + $reversal->amount,
                $transfer->currency
            );
        } catch (\Throwable $e) {
            // The client has already been refunded; a failed clawback is a
            // reconciliation problem to chase, not a reason to fail the
            // cancellation the client asked for.
            Log::error('Could not reverse the transfer to the provider', [
                'payment_id' => $payment->id,
                'transfer' => $payment->transfer_reference,
                'error' => $e->getMessage(),
            ]);

            return 0.0;
        }
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

        /*
         * Connected-account events describe an account, not a payment, so they
         * are handled before the payment lookup — there is no charge to find.
         * This is how a provider finishing onboarding becomes payable without
         * anyone pressing refresh.
         */
        if ($type === 'account.updated') {
            $this->syncConnectedAccount($intent);
            $event->update(['processed_at' => now()]);

            return;
        }

        /*
         * `payment_intent.*` events carry the intent itself, so `id` is the
         * `pi_…` we stored as the reference. `charge.*` events carry a charge,
         * whose `id` is a `ch_…` — the intent is a field on it. Matching only
         * on `id` silently loses every dashboard-issued refund.
         */
        $payment = $this->findPaymentForEvent($intent);

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
                'charge.refunded' => $this->markRefundedFromStripe($payment, $intent),
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

    /** Mirrors an `account.updated` payload onto the provider's profile. */
    private function syncConnectedAccount(array $account): void
    {
        $profile = filled($account['id'] ?? null)
            ? ProviderProfile::where('stripe_account_id', $account['id'])->first()
            : null;

        if (! $profile) {
            Log::info('account.updated for an unknown connected account', [
                'account' => $account['id'] ?? null,
            ]);

            return;
        }

        app(StripeConnectService::class)->applyAccount($profile, $account);
    }

    /**
     * Resolves the ledger row a Stripe event object belongs to, trying the
     * intent id first, then the charge id, then the charge's own reference.
     */
    private function findPaymentForEvent(array $object): ?Payment
    {
        $candidates = array_filter([
            $object['payment_intent'] ?? null,
            $object['id'] ?? null,
        ]);

        foreach ($candidates as $reference) {
            $payment = Payment::where('reference', $reference)
                ->orWhere('charge_reference', $reference)
                ->first();

            if ($payment) {
                return $payment;
            }
        }

        return null;
    }

    /**
     * A refund raised in the Stripe dashboard rather than by us, so the ids
     * still land in our ledger.
     *
     * Stripe also emits `charge.refunded` for refunds we issued ourselves. In
     * that case the row is already Refunded and both parties have already been
     * emailed, so this returns without sending a second copy.
     */
    private function markRefundedFromStripe(Payment $payment, array $charge): void
    {
        if ($payment->status === PaymentStatus::Refunded) {
            return;
        }

        $payment->update([
            'status' => PaymentStatus::Refunded,
            'refunded_at' => now(),
            'charge_reference' => $charge['id'] ?? $payment->charge_reference,
            'refund_reference' => $charge['refunds']['data'][0]['id'] ?? $payment->refund_reference,
            'refund_amount' => isset($charge['amount_refunded'])
                ? $this->fromMinorUnits((int) $charge['amount_refunded'], $charge['currency'] ?? 'inr')
                : $payment->refund_amount,
            'refund_reason' => $payment->refund_reason ?? 'Refunded in Stripe.',
        ]);

        $this->notifyRefunded($payment->fresh());
    }

    /**
     * Tells both sides the money went back. The client is the one out of
     * pocket, but the provider needs it too — it is the receipt proving the
     * booking is settled and nothing is owed either way.
     *
     * Mail must never take a refund down with it: the money has already moved,
     * and an SMTP outage should not surface as a failed refund.
     */
    private function notifyRefunded(Payment $payment): void
    {
        $booking = $payment->booking?->load(['service.provider.providerProfile', 'provider', 'client']);

        if (! $booking) {
            return;
        }

        $payment->setRelation('booking', $booking);

        foreach ([[$booking->client, false], [$booking->provider, true]] as [$user, $forProvider]) {
            try {
                Mail::to($user->email)->send(new PaymentRefunded($payment, $forProvider));
            } catch (\Throwable $e) {
                Log::warning('Refund mail failed to send', [
                    'payment_id' => $payment->id,
                    'to' => $user->email,
                    'error' => $e->getMessage(),
                ]);
            }
        }
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
