<?php

namespace App\Services;

use App\Models\ProviderProfile;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Stripe\StripeClient;

/**
 * The Stripe identities behind the marketplace.
 *
 * Two different objects for two different roles, and the distinction matters:
 *
 *  - A client *pays*, so they get a **Customer**. That is the payer-side
 *    object — it carries saved cards and receipts and needs no identity check.
 *  - A provider *is paid*, so they get a **connected account** (Express).
 *    Only a connected account can receive a transfer, and receiving money is
 *    what obliges Stripe to verify who they are.
 *
 * Giving a client a connected account would drag a bank-grade identity check
 * onto someone who is only ever handing money over, and still would not let
 * them pay. They are not interchangeable.
 *
 * Everything here is best-effort at the call site: a Stripe outage must never
 * stop somebody registering. Each `ensure` is idempotent, so whatever failed
 * at signup is simply created the next time it is needed.
 */
class StripeConnectService
{
    public function enabled(): bool
    {
        return filled(config('services.stripe.secret'));
    }

    /**
     * Runs a Stripe call with the library's own `E_USER_WARNING` notices
     * neutralised.
     *
     * stripe-php raises one on every v1 Accounts request ("we recommend
     * Accounts v2"). Laravel promotes warnings to ErrorException, so that
     * advisory would otherwise abort account creation outright — a provider
     * would finish signing up with no way to be paid, and the only trace would
     * be a log line quoting a documentation link.
     */
    public function withoutStripeNotices(callable $fn): mixed
    {
        set_error_handler(
            static fn () => true,          // swallow, do not escalate
            E_USER_WARNING | E_USER_NOTICE | E_USER_DEPRECATED
        );

        try {
            return $fn();
        } finally {
            restore_error_handler();
        }
    }

    public function stripe(): StripeClient
    {
        return new StripeClient(config('services.stripe.secret'));
    }

    // --- Clients: the payer side ------------------------------------------

    /**
     * The client's Customer id, creating it on first use.
     *
     * Returns null rather than throwing — a checkout can still proceed without
     * a Customer, it just will not remember the card.
     */
    public function ensureCustomer(User $user): ?string
    {
        if (! $this->enabled()) {
            return null;
        }

        if ($user->stripe_customer_id) {
            return $user->stripe_customer_id;
        }

        try {
            $customer = $this->stripe()->customers->create([
                'email' => $user->email,
                'name' => $user->name,
                'phone' => $user->phone,
                'metadata' => ['user_id' => (string) $user->id, 'role' => $user->role->value],
            ]);

            $user->forceFill(['stripe_customer_id' => $customer->id])->save();

            return $customer->id;
        } catch (\Throwable $e) {
            Log::warning('Could not create Stripe customer', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    // --- Providers: the paid side -----------------------------------------

    /**
     * The provider's connected account id, creating it on first use.
     *
     * A fresh Express account exists but can do nothing until its owner has
     * completed onboarding — `transfers` is requested here and granted by
     * Stripe once they have.
     */
    public function ensureAccount(User $provider): ?string
    {
        if (! $this->enabled() || ! $provider->isProvider()) {
            return null;
        }

        $profile = $provider->providerProfile;

        if (! $profile) {
            return null;
        }

        if ($profile->stripe_account_id) {
            return $profile->stripe_account_id;
        }

        try {
            $account = $this->withoutStripeNotices(fn () => $this->stripe()->accounts->create([
                'type' => 'express',
                'country' => config('booking.payments.connect_country', 'US'),
                'email' => $provider->email,
                'business_type' => 'individual',
                'capabilities' => [
                    'transfers' => ['requested' => true],
                    'card_payments' => ['requested' => true],
                ],
                'business_profile' => [
                    'name' => $profile->business_name ?: $provider->name,
                    'product_description' => 'Appointment-based services booked through '.config('app.name'),
                ],
                'metadata' => ['user_id' => (string) $provider->id],
            ]));

            $profile->forceFill([
                'stripe_account_id' => $account->id,
                'stripe_charges_enabled' => (bool) $account->charges_enabled,
                'stripe_payouts_enabled' => (bool) $account->payouts_enabled,
                'stripe_details_submitted' => (bool) $account->details_submitted,
                'stripe_synced_at' => now(),
            ])->save();

            return $account->id;
        } catch (\Throwable $e) {
            Log::warning('Could not create Stripe connected account', [
                'user_id' => $provider->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * A one-time URL where the provider completes Stripe's onboarding.
     *
     * Account Links are single-use and short-lived by design, so this is
     * generated on demand and never stored.
     */
    public function onboardingLink(User $provider, ?string $returnTo = null): ?string
    {
        $accountId = $this->ensureAccount($provider);

        if (! $accountId) {
            return null;
        }

        $frontend = rtrim((string) config('app.frontend_url'), '/');

        /*
         * Both URLs must point at a route that actually exists. `/app/payouts`
         * did not, so Stripe returned the provider to a blank page — and the
         * gate, having been reloaded, had no idea they had been anywhere.
         * The query flag is what tells it to re-check on mount.
         */
        $return = $returnTo ?: $frontend.'/app?payouts=return';

        try {
            return $this->withoutStripeNotices(fn () => $this->stripe()->accountLinks->create([
                'account' => $accountId,
                // Stripe sends them here if the link has already been used or
                // has expired; the app then mints a fresh one.
                'refresh_url' => $frontend.'/app?payouts=refresh',
                'return_url' => $return,
                'type' => 'account_onboarding',
            ])->url);
        } catch (\Throwable $e) {
            Log::warning('Could not create Stripe onboarding link', [
                'user_id' => $provider->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /** Pulls the account's current state from Stripe into our mirror. */
    public function syncAccount(User $provider): ?ProviderProfile
    {
        $profile = $provider->providerProfile;

        if (! $this->enabled() || ! $profile?->stripe_account_id) {
            return $profile;
        }

        try {
            $account = $this->withoutStripeNotices(
                fn () => $this->stripe()->accounts->retrieve($profile->stripe_account_id)
            );

            return $this->applyAccount($profile, $account->toArray());
        } catch (\Throwable $e) {
            Log::warning('Could not sync Stripe connected account', [
                'user_id' => $provider->id,
                'error' => $e->getMessage(),
            ]);

            return $profile;
        }
    }

    /**
     * Writes a Stripe account payload onto the profile. Shared by the manual
     * sync and the `account.updated` webhook, so both agree on what the
     * columns mean.
     */
    public function applyAccount(ProviderProfile $profile, array $account): ProviderProfile
    {
        $requirements = $account['requirements'] ?? [];

        $profile->forceFill([
            'stripe_charges_enabled' => (bool) ($account['charges_enabled'] ?? false),
            'stripe_payouts_enabled' => (bool) ($account['payouts_enabled'] ?? false),
            'stripe_details_submitted' => (bool) ($account['details_submitted'] ?? false),
            'stripe_requirements' => array_filter([
                'currently_due' => $requirements['currently_due'] ?? [],
                'past_due' => $requirements['past_due'] ?? [],
                'disabled_reason' => $requirements['disabled_reason'] ?? null,
            ]),
            'stripe_synced_at' => now(),
        ])->save();

        return $profile;
    }

    /**
     * Whether this provider can actually be paid.
     *
     * Only `transfers` matters: with destination charges the platform is the
     * merchant taking the card, and the connected account only needs to be
     * able to receive the money that follows.
     */
    public function canReceiveFunds(?User $provider): bool
    {
        $profile = $provider?->providerProfile;

        return (bool) ($profile?->stripe_account_id && $profile->stripe_payouts_enabled);
    }

    /** Where the money for this provider should land, or null if nowhere yet. */
    public function destinationFor(?User $provider): ?string
    {
        return $this->canReceiveFunds($provider)
            ? $provider->providerProfile->stripe_account_id
            : null;
    }

    /** A dashboard link so a provider can see their own payouts. */
    public function dashboardLink(User $provider): ?string
    {
        $profile = $provider->providerProfile;

        if (! $this->enabled() || ! $profile?->stripe_account_id || ! $profile->stripe_details_submitted) {
            return null;
        }

        try {
            return $this->withoutStripeNotices(
                fn () => $this->stripe()->accounts->createLoginLink($profile->stripe_account_id)->url
            );
        } catch (\Throwable $e) {
            Log::warning('Could not create Stripe dashboard link', [
                'user_id' => $provider->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
