<?php

namespace App\Providers;

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
        Mail::extend('brevo', function (array $config) {
            return (new BrevoTransportFactory)->create(
                new Dsn('brevo+api', 'default', $config['key'] ?? null)
            );
        });
    }
}
