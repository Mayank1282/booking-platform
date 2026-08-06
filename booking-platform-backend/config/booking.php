<?php

return [

    /*
     * How long an unpaid booking holds its slot before the reservation lapses
     * and the time becomes bookable again. Long enough to finish checkout,
     * short enough that an abandoned attempt does not block anyone.
     */
    'hold_minutes' => (int) env('BOOKING_HOLD_MINUTES', 15),

    /*
     * Granularity of generated slots, in minutes. A 60-minute service on a
     * 15-minute grid can start at :00, :15, :30 or :45.
     */
    'slot_interval' => 15,

    /* How far ahead clients may book. */
    'max_advance_days' => 60,

    /* A slot must start at least this many minutes from now. */
    'min_notice_minutes' => 60,

    /* Free cancellation window before the start time. */
    'cancellation_window_hours' => 24,

    'payments' => [
        'currency' => env('STRIPE_CURRENCY', 'inr'),

        /*
         * Zero-decimal currencies are sent to Stripe as whole units; every
         * other currency is multiplied by 100.
         */
        'zero_decimal_currencies' => ['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'],
    ],
];
