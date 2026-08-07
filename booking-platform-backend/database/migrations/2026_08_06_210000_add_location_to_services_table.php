<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Gives a service its own address.
     *
     * Until now the only address on the platform belonged to the provider, so
     * every listing they owned shared one location. A provider working out of
     * two salons — or offering one service at home and another at a studio —
     * had no way to say so.
     *
     * These stay nullable on purpose: blank means "wherever the provider is",
     * so existing listings keep working and a single-location provider never
     * has to type their address twice.
     */
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->string('address_line')->nullable()->after('location_type');
            $table->string('city')->nullable()->after('address_line')->index();
            $table->string('state')->nullable()->after('city');
            $table->string('postal_code')->nullable()->after('state');
            $table->decimal('latitude', 10, 7)->nullable()->after('postal_code');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
        });
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->dropColumn([
                'address_line', 'city', 'state', 'postal_code', 'latitude', 'longitude',
            ]);
        });
    }
};
