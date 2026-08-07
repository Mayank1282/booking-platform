<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\StripeConnectService;
use App\Support\Pricing;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A provider's payout account: where their share of each booking lands.
 */
class PayoutController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly StripeConnectService $connect) {}

    /**
     * Current payout status.
     *
     * Re-reads from Stripe when the local mirror is stale, so a provider who
     * has just finished onboarding in another tab does not have to wait for
     * the webhook to land before the screen agrees with reality.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $profile = $user->providerProfile;

        $stale = ! $profile?->stripe_synced_at
            || $profile->stripe_synced_at->lt(now()->subMinutes(2))
            || $request->boolean('refresh');

        if ($profile?->stripe_account_id && $stale) {
            $profile = $this->connect->syncAccount($user) ?? $profile;
        }

        $feeBps = (int) config('booking.payments.platform_fee_bps');

        // A worked example on a round number, so the commission is shown as
        // arithmetic rather than as a percentage the provider has to apply
        // themselves.
        $example = Pricing::fromProviderAmount(1000, config('booking.payments.currency'), $feeBps);

        return $this->ok([
            'connected' => (bool) $profile?->stripe_account_id,
            'account_id' => $profile?->stripe_account_id,
            'charges_enabled' => (bool) $profile?->stripe_charges_enabled,
            'payouts_enabled' => (bool) $profile?->stripe_payouts_enabled,
            'details_submitted' => (bool) $profile?->stripe_details_submitted,
            'can_receive_funds' => $this->connect->canReceiveFunds($user),
            'requirements' => $profile?->stripe_requirements,
            'synced_at' => $profile?->stripe_synced_at?->toIso8601String(),

            'commission' => [
                'percent' => $feeBps / 100,
                'example' => $example->toArray(),
            ],
        ]);
    }

    /** A fresh single-use onboarding link. */
    public function onboarding(Request $request): JsonResponse
    {
        $url = $this->connect->onboardingLink($request->user());

        return $url
            ? $this->ok(['url' => $url], 'Continue in the window that opens.')
            : $this->fail('Payout onboarding is unavailable right now. Please try again shortly.', 503);
    }

    /** Stripe's own dashboard, for a provider who has already onboarded. */
    public function dashboard(Request $request): JsonResponse
    {
        $url = $this->connect->dashboardLink($request->user());

        return $url
            ? $this->ok(['url' => $url])
            : $this->fail('Finish setting up payouts first.', 422);
    }
}
