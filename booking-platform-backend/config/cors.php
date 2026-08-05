<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'storage/*'],

    'allowed_methods' => ['*'],

    /*
     * The SPA origin in development plus whatever FRONTEND_URL points at in
     * production. Vercel preview deployments are matched by pattern below.
     */
    'allowed_origins' => array_values(array_filter([
        env('FRONTEND_URL', 'http://localhost:5173'),
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ])),

    'allowed_origins_patterns' => ['#^https://.*\.vercel\.app$#'],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // Token auth, not cookie auth — no credentials need to cross origins.
    'supports_credentials' => false,
];
