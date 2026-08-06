<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Housekeeping for lapsed payment holds. The availability engine already
 * ignores an expired hold, so this only tidies labels and releases the
 * matching Stripe PaymentIntent.
 */
Schedule::command('bookings:expire')->everyFiveMinutes()->withoutOverlapping();
