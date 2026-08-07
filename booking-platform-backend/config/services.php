<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'stripe' => [
        'key' => env('STRIPE_KEY'),
        'secret' => env('STRIPE_SECRET'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    ],

    'razorpay' => [
        // The key id is public — the checkout widget needs it in the browser.
        'key' => env('RAZORPAY_API_KEY'),
        'secret' => env('RAZORPAY_SECRET_KEY'),

        /*
         * Unlike Stripe, Razorpay does not issue a webhook secret: whatever
         * value you type into the dashboard's Secret field *is* the key, and
         * it signs every payload in `X-Razorpay-Signature`. Leave it unset and
         * webhooks cannot be verified at all — anyone who finds the URL could
         * post a forged `payment.captured` and confirm an unpaid booking.
         */
        'webhook_secret' => env('RAZORPAY_WEBHOOK_SECRET'),
    ],

];
