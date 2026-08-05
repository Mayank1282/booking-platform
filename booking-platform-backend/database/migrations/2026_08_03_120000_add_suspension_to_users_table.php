<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Suspension is reversible; deletion is not. Admins reach for this
            // first, so a bad actor loses access without losing their history.
            $table->timestamp('suspended_at')->nullable()->after('timezone');
            $table->string('suspension_reason')->nullable()->after('suspended_at');

            // Set when an account has been erased. The row survives so that
            // the other party's bookings and the payment ledger stay intact,
            // but every personal field is scrubbed and the email released.
            $table->timestamp('anonymised_at')->nullable()->after('suspension_reason');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['suspended_at', 'suspension_reason']);
        });
    }
};
