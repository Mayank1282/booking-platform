<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingPlaced extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Booking $booking,
        public bool $forProvider = false,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->forProvider
                ? "New booking request — {$this->booking->service->title}"
                : "We are holding your slot — {$this->booking->code}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.bookings.placed',
            with: [
                'booking' => $this->booking,
                'forProvider' => $this->forProvider,
                'frontendUrl' => rtrim(config('app.frontend_url'), '/'),
            ],
        );
    }
}
