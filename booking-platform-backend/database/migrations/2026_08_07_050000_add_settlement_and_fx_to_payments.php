<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Records what Stripe actually kept and what the money became after currency
 * conversion.
 *
 * The client is charged in INR, but the platform settles in USD and the
 * connected account is paid in USD. Between the two sit Stripe's processing
 * fee and an exchange rate, and neither is knowable from our own arithmetic —
 * they have to be read back from Stripe and stored.
 *
 * This matters most at refund time. Stripe does not return its processing fee
 * when a charge is refunded, so refunding a client in full leaves the platform
 * genuinely out of pocket by that fee. Without these columns that loss is
 * invisible: the books would say the booking netted out to zero when it did
 * not.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            // What the charge became once Stripe settled it, in the platform's
            // own currency. `amount` above stays the INR the client was quoted.
            $table->string('settlement_currency', 3)->nullable()->after('currency');
            $table->decimal('settlement_amount', 12, 2)->nullable()->after('settlement_currency');
            $table->decimal('exchange_rate', 18, 8)->nullable()->after('settlement_amount');

            // Stripe's cut, in the settlement currency. Not ours to keep and
            // not ours to give back — Stripe retains it on a refund.
            $table->decimal('stripe_fee', 12, 2)->default(0)->after('exchange_rate');
            $table->decimal('net_amount', 12, 2)->nullable()->after('stripe_fee');

            // What actually left for the provider, in their account's currency.
            $table->decimal('transfer_amount', 12, 2)->nullable()->after('transfer_reference');
            $table->string('transfer_currency', 3)->nullable()->after('transfer_amount');

            // The refund side of the same story.
            $table->decimal('stripe_fee_refunded', 12, 2)->default(0)->after('application_fee_refunded');
            $table->decimal('transfer_reversed_amount', 12, 2)->default(0)->after('stripe_fee_refunded');
            $table->decimal('platform_net_amount', 12, 2)->nullable()->after('transfer_reversed_amount');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn([
                'settlement_currency', 'settlement_amount', 'exchange_rate',
                'stripe_fee', 'net_amount', 'transfer_amount', 'transfer_currency',
                'stripe_fee_refunded', 'transfer_reversed_amount', 'platform_net_amount',
            ]);
        });
    }
};
