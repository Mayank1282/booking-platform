<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Turns the single price into a marketplace split, and gives users the Stripe
 * identities the split needs: a Customer for whoever pays, a connected account
 * for whoever gets paid.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            /*
             * `price_amount` stays the client-facing total, because that is
             * what every existing charge, refund and receipt already refers
             * to. The two new columns say how that total divides.
             *
             * The rate is snapshotted per booking: a commission change next
             * month must not re-price an appointment agreed today.
             */
            $table->decimal('provider_amount', 10, 2)->default(0)->after('price_amount');
            $table->decimal('platform_fee_amount', 10, 2)->default(0)->after('provider_amount');
            $table->unsignedInteger('platform_fee_bps')->default(0)->after('platform_fee_amount');
        });

        // Bookings made before the commission existed: the provider was owed
        // the whole amount, and the platform took nothing. Recording that
        // honestly beats back-dating a fee nobody ever agreed to.
        DB::table('bookings')->update([
            'provider_amount' => DB::raw('price_amount'),
            'platform_fee_amount' => 0,
            'platform_fee_bps' => 0,
        ]);

        Schema::table('payments', function (Blueprint $table) {
            $table->decimal('application_fee_amount', 10, 2)->default(0)->after('amount');
            // The connected account the funds were routed to, and the transfer
            // Stripe created. Without these the ledger cannot be reconciled
            // against Stripe line by line.
            $table->string('destination_account')->nullable()->after('charge_reference');
            $table->string('transfer_reference')->nullable()->after('destination_account');
            $table->decimal('application_fee_refunded', 10, 2)->default(0)->after('refund_amount');
        });

        DB::table('payments')->update(['application_fee_amount' => 0]);

        Schema::table('users', function (Blueprint $table) {
            // The payer-side identity. A client never needs a connected
            // account — that object exists to *receive* money and would drag
            // an identity check onto someone who only ever pays.
            $table->string('stripe_customer_id')->nullable()->unique()->after('timezone');
        });

        Schema::table('provider_profiles', function (Blueprint $table) {
            $table->string('stripe_account_id')->nullable()->unique()->after('longitude');
            // Mirrored from Stripe rather than asked for on every page load.
            $table->boolean('stripe_charges_enabled')->default(false)->after('stripe_account_id');
            $table->boolean('stripe_payouts_enabled')->default(false)->after('stripe_charges_enabled');
            $table->boolean('stripe_details_submitted')->default(false)->after('stripe_payouts_enabled');
            $table->json('stripe_requirements')->nullable()->after('stripe_details_submitted');
            $table->timestamp('stripe_synced_at')->nullable()->after('stripe_requirements');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['provider_amount', 'platform_fee_amount', 'platform_fee_bps']);
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn([
                'application_fee_amount', 'destination_account',
                'transfer_reference', 'application_fee_refunded',
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('stripe_customer_id');
        });

        Schema::table('provider_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'stripe_account_id', 'stripe_charges_enabled', 'stripe_payouts_enabled',
                'stripe_details_submitted', 'stripe_requirements', 'stripe_synced_at',
            ]);
        });
    }
};
