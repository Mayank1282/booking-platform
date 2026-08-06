<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Turns an unpaid booking into a short-lived hold.
     *
     * Previously a booking was created the moment a slot was chosen and stayed
     * pending forever, so an abandoned checkout looked like a real booking and
     * blocked that slot indefinitely. Now a pending row carries an expiry: it
     * reserves the slot only long enough for the client to pay, then releases
     * it automatically.
     */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('expires_at')->nullable()->after('status')->index();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('expires_at');
        });
    }
};
