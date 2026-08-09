<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoTransportFactory;
use Symfony\Component\Mailer\Transport\Dsn;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        /*
         * Brevo's HTTP API transport, over port 443.
         *
         * Render blocks outbound SMTP, so port 587 never leaves the container.
         * The same credentials work locally, which makes it look like a Brevo
         * or credentials fault rather than a network one — and since mail
         * failures here are deliberately non-fatal, it fails in silence.
         *
         * Installing symfony/brevo-mailer is not enough on its own: Laravel
         * only auto-discovers a fixed set of transports, and `brevo` is not
         * among them. Without this the driver resolves to "Unsupported mail
         * transport [brevo]".
         */
        /*
         * Point the reset link at the React app.
         *
         * Laravel's ResetPassword notification builds its URL from a named
         * route, `password.reset`, which only exists in a Blade application.
         * This backend is API-only and the reset page is a React route, so the
         * notification threw "Route [password.reset] not defined" on every
         * request — and because mail failures here are non-fatal, the user was
         * told a link was on its way while nothing had been sent.
         */
        ResetPassword::createUrlUsing(function ($notifiable, string $token) {
            return rtrim((string) config('app.frontend_url'), '/')
                .'/reset-password?token='.$token
                .'&email='.urlencode($notifiable->getEmailForPasswordReset());
        });

        Mail::extend('brevo', function (array $config) {
            return (new BrevoTransportFactory)->create(
                new Dsn('brevo+api', 'default', $config['key'] ?? null)
            );
        });
    }
}
