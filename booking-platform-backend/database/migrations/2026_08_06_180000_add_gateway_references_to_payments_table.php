<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Records the gateway's own identifiers against the payment.
     *
     * Previously only the PaymentIntent id was kept. The charge and refund ids
     * returned by Stripe were discarded, which made it impossible to reconcile
     * a refund in our database against the one in Stripe's — the exact trail
     * you need when a client disputes whether they were paid back.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            // ch_… the actual charge behind a settled PaymentIntent.
            $table->string('charge_reference')->nullable()->after('reference')->index();

            // re_… the refund, so ours and Stripe's records can be matched up.
            $table->string('refund_reference')->nullable()->after('charge_reference')->index();

            // Refunds can be partial, so the amount returned is not always the
            // amount paid.
            $table->decimal('refund_amount', 10, 2)->nullable()->after('refund_reference');
            $table->string('refund_reason')->nullable()->after('refund_amount');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['charge_reference', 'refund_reference', 'refund_amount', 'refund_reason']);
        });
    }
};
