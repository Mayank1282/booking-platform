<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\StripeConnectService;
use Illuminate\Console\Command;

/**
 * Makes seeded providers payable in Stripe **test mode**.
 *
 * Real onboarding is a hosted flow: the provider clicks through Stripe's forms
 * and supplies identity documents. There is no way to do that for a dozen
 * seeded accounts, and no way to demo a marketplace split without it.
 *
 * So in test mode this creates `custom` connected accounts pre-filled with
 * Stripe's documented test values — SSN 000-00-0000 and routing 110000000 are
 * fixtures that always verify. Nothing here works against live keys, and it
 * refuses to run if it sees any.
 */
class ProvisionDemoPayouts extends Command
{
    protected $signature = 'stripe:demo-payouts {user? : id or email of a single provider}';

    protected $description = 'Give providers payout-ready test-mode Stripe accounts (test keys only)';

    public function handle(StripeConnectService $connect): int
    {
        if (! $connect->enabled()) {
            $this->error('No Stripe secret configured.');

            return self::FAILURE;
        }

        if (! str_starts_with((string) config('services.stripe.secret'), 'sk_test_')) {
            $this->error('Refusing to run: this is not a test-mode secret key.');

            return self::FAILURE;
        }

        $providers = User::where('role', 'provider')
            ->when($this->argument('user'), fn ($q) => $q->where(
                fn ($w) => $w->where('id', $this->argument('user'))->orWhere('email', $this->argument('user'))
            ))
            ->with('providerProfile')
            ->get();

        if ($providers->isEmpty()) {
            $this->warn('No matching providers.');

            return self::SUCCESS;
        }

        $stripe = $connect->stripe();
        $country = config('booking.payments.connect_country', 'US');

        foreach ($providers as $provider) {
            $profile = $provider->providerProfile;

            if (! $profile) {
                $this->line("  skipped {$provider->email} — no provider profile");

                continue;
            }

            if ($profile->stripe_payouts_enabled) {
                $this->line("  already payable  {$provider->email}  {$profile->stripe_account_id}");

                continue;
            }

            try {
                // An Express account can only accept the terms through the
                // hosted flow, so the demo path uses `custom`, where every
                // field can be supplied over the API.
                $account = $connect->withoutStripeNotices(fn () => $stripe->accounts->create([
                    'type' => 'custom',
                    'country' => $country,
                    'email' => $provider->email,
                    'business_type' => 'individual',
                    'capabilities' => [
                        'transfers' => ['requested' => true],
                        'card_payments' => ['requested' => true],
                    ],
                    'business_profile' => [
                        'mcc' => '7298', // health and beauty spas
                        'name' => $profile->business_name ?: $provider->name,
                        'product_description' => 'Appointment-based services booked through '.config('app.name'),
                        // No `url`: Stripe validates it as a real reachable
                        // site, and the demo frontend is on localhost.
                        // `product_description` satisfies the same requirement.
                    ],
                    'individual' => [
                        'first_name' => str($provider->name)->before(' ')->toString() ?: 'Test',
                        'last_name' => str($provider->name)->after(' ')->toString() ?: 'Provider',
                        'email' => $provider->email,
                        'phone' => '+16505551234',
                        'dob' => ['day' => 1, 'month' => 1, 'year' => 1985],
                        'address' => [
                            'line1' => 'address_full_match', // Stripe test fixture
                            'city' => 'Beverly Hills',
                            'state' => 'CA',
                            'postal_code' => '90210',
                            'country' => $country,
                        ],
                        'ssn_last_4' => '0000',
                        'id_number' => '000000000',
                    ],
                    'tos_acceptance' => [
                        'date' => time(),
                        'ip' => '127.0.0.1',
                    ],
                    'external_account' => [
                        'object' => 'bank_account',
                        'country' => $country,
                        'currency' => 'usd',
                        'routing_number' => '110000000',
                        'account_number' => '000123456789',
                    ],
                    'metadata' => ['user_id' => (string) $provider->id, 'demo' => 'true'],
                ]));

                $connect->applyAccount($profile, $account->toArray());
                $profile->forceFill(['stripe_account_id' => $account->id])->save();

                $state = $account->payouts_enabled ? '<info>payable</info>' : '<comment>pending review</comment>';
                $this->line("  {$provider->email}  {$account->id}  {$state}");
            } catch (\Throwable $e) {
                $this->error("  {$provider->email}: {$e->getMessage()}");
            }
        }

        return self::SUCCESS;
    }
}
