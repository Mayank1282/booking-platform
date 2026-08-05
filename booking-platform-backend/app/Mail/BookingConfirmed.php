<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingConfirmed extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Booking $booking) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Your booking is confirmed — {$this->booking->code}",
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.bookings.confirmed',
            with: [
                'booking' => $this->booking,
                'frontendUrl' => rtrim(config('app.frontend_url'), '/'),
            ],
        );
    }
}
