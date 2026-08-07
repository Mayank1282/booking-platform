<?php

use App\Mail\BookingCancelled;
use App\Mail\BookingConfirmed;
use App\Mail\BookingPlaced;
use App\Mail\PaymentRefunded;
use App\Models\Booking;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

/*
 * Email preview, local only.
 *
 * Transactional mail is the one part of the product nobody sees while building
 * it — you find the broken layout after a client has already received it. This
 * renders any of them against real data at /dev/mail.
 */
if (app()->environment('local')) {
    Route::get('/dev/mail/{template?}', function (?string $template = null) {
        $booking = Booking::with(['service.provider.providerProfile', 'provider', 'client', 'payment'])
            ->whereHas('payment')
            ->latest()
            ->first()
            ?? Booking::with(['service.provider.providerProfile', 'provider', 'client', 'payment'])->latest()->first();

        abort_if(! $booking, 404, 'Seed a booking first.');

        $mailables = [
            'placed-client' => fn () => new BookingPlaced($booking),
            'placed-provider' => fn () => new BookingPlaced($booking, forProvider: true),
            'confirmed-client' => fn () => new BookingConfirmed($booking),
            'confirmed-provider' => fn () => new BookingConfirmed($booking, forProvider: true),
            'cancelled-client' => fn () => new BookingCancelled($booking, $booking->client),
            'cancelled-provider' => fn () => new BookingCancelled($booking, $booking->client, forProvider: true),
            'cancelled-by-provider' => fn () => new BookingCancelled($booking, $booking->provider),
            'refunded-client' => fn () => $booking->payment
                ? new PaymentRefunded($booking->payment)
                : abort(404, 'This booking has no payment.'),
            'refunded-provider' => fn () => $booking->payment
                ? new PaymentRefunded($booking->payment, forProvider: true)
                : abort(404, 'This booking has no payment.'),
        ];

        if (! $template) {
            $links = collect($mailables)->keys()
                ->map(fn ($key) => '<li style="margin:6px 0"><a href="/dev/mail/'.$key.'">'.$key.'</a></li>')
                ->implode('');

            return '<body style="font-family:system-ui;padding:40px;background:#faf9f6;color:#17150f">'
                .'<h1 style="font-weight:400">Email previews</h1>'
                .'<p style="color:#5c5545">Rendered against booking <strong>'.$booking->code.'</strong>.</p>'
                .'<ul style="line-height:1.7">'.$links.'</ul></body>';
        }

        abort_unless(isset($mailables[$template]), 404, 'Unknown template.');

        return $mailables[$template]()->render();
    });
}
