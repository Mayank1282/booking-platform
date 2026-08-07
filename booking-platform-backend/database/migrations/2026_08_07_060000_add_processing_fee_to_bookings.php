<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The third slice of a booking: payment processing, passed through to the
 * client and retained by Stripe on a refund.
 *
 * Snapshotted per booking like the commission, so a later change to Stripe's
 * rates cannot alter what an appointment already agreed is worth.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->decimal('processing_fee_amount', 10, 2)->default(0)->after('platform_fee_amount');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->decimal('processing_fee_amount', 10, 2)->default(0)->after('application_fee_amount');
            // What the client actually gets back on a cancellation: everything
            // except the processing already spent.
            $table->decimal('refundable_amount', 10, 2)->nullable()->after('processing_fee_amount');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', fn (Blueprint $t) => $t->dropColumn('processing_fee_amount'));
        Schema::table('payments', fn (Blueprint $t) => $t->dropColumn(['processing_fee_amount', 'refundable_amount']));
    }
};
