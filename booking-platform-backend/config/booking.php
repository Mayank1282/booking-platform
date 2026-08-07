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
         * The platform's commission, in basis points — 1000 bps is 10%.
         *
         * Charged on top of the provider's price rather than taken out of it:
         * a provider who lists ₹800 receives ₹800, and the client pays ₹880.
         * Basis points because a fractional rate (2.5% = 250) then needs no
         * decimal arithmetic anywhere.
         *
         * Every booking snapshots the rate in force when it was made, so
         * changing this never re-prices an appointment already agreed.
         */
        'platform_fee_bps' => (int) env('PLATFORM_FEE_BPS', 1000),

        /*
         * Payment processing, passed through to the client.
         *
         * Stripe's own cut is deducted from the platform balance and is *not*
         * returned when a charge is refunded. If the client were only charged
         * the provider's price plus commission, every cancellation would leave
         * the platform paying Stripe out of its own pocket for a service
         * nobody received.
         *
         * So it is quoted to the client as a separate line and retained on a
         * refund. The rate is deliberately a little above Stripe's actual
         * charge (2.9% + fixed, plus 1% currency conversion) so that the
         * refund-side deduction is covered too and the booking nets to zero
         * for both the provider and the platform either way.
         *
         * Set PROCESSING_FEE_BPS=0 to absorb it instead.
         */
        'processing_fee_bps' => (int) env('PROCESSING_FEE_BPS', 490),
        'processing_fee_fixed' => (float) env('PROCESSING_FEE_FIXED', 30),

        /*
         * Which gateways a client may choose between, and what each costs.
         *
         * The processing pass-through is a property of the *gateway*, not of
         * the booking. Stripe settles this platform in USD, so an INR booking
         * carries both a card fee and a currency conversion — quoted to the
         * client and retained on a refund. Razorpay settles INR natively from
         * an Indian account: no conversion, and its fee is absorbed by the
         * commission, so the client sees only the provider's price plus the
         * commission.
         *
         * That is why the same booking is a different total depending on how
         * it is paid, and why the fee cannot live on the booking row.
         */
        'gateways' => [
            'stripe' => [
                'enabled' => (bool) env('STRIPE_SECRET'),
                'label' => 'Card (international)',
                // Passed on to the client, and kept if they cancel.
                'passes_processing_to_client' => true,
                // Route the provider's share automatically via Connect.
                'supports_split' => true,
            ],

            'razorpay' => [
                'enabled' => (bool) env('RAZORPAY_API_KEY'),
                'label' => 'UPI, cards & netbanking (India)',
                // Absorbed by the commission — no conversion, so the client is
                // quoted the provider's price plus the commission and nothing
                // else. The platform carries Razorpay's fee on a refund.
                'passes_processing_to_client' => false,
                /*
                 * Razorpay Route is NOT enabled on this account (no transfer
                 * events are offered), so there are no linked accounts and no
                 * automatic split. Payments land whole in the platform account
                 * and the provider's share is recorded as owed, to be settled
                 * separately. Flip this to true once Route is activated.
                 */
                'supports_split' => false,
            ],
        ],

        /*
         * Country new connected accounts are opened in. Must match the
         * platform account's own country unless cross-border transfers are
         * enabled, so it follows the platform rather than the provider's
         * address.
         */
        'connect_country' => env('STRIPE_CONNECT_COUNTRY', 'US'),

        /*
         * How long a card refund takes to reach the client, per Stripe's own
         * guidance: the refund leaves Stripe immediately, but the issuing bank
         * decides when it lands, and 5–10 business days is what they publish.
         *
         * Quoted in the cancellation and refund emails. Config rather than
         * prose in a template so one edit changes every place it is promised —
         * a number in an email is a commitment, and it must not drift.
         */
        'refund_days_min' => (int) env('STRIPE_REFUND_DAYS_MIN', 5),
        'refund_days_max' => (int) env('STRIPE_REFUND_DAYS_MAX', 10),

        /*
         * Zero-decimal currencies are sent to Stripe as whole units; every
         * other currency is multiplied by 100.
         */
        'zero_decimal_currencies' => ['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'],
    ],
];
