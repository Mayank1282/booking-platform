<?php

namespace App\Mail;

use App\Models\Booking;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingCancelled extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Booking $booking,
        public User $cancelledBy,
        public bool $forProvider = false,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Booking cancelled — {$this->booking->code}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.bookings.cancelled',
            with: [
                'booking' => $this->booking,
                'cancelledBy' => $this->cancelledBy,
                'forProvider' => $this->forProvider,
                'frontendUrl' => rtrim(config('app.frontend_url'), '/'),
            ],
        );
    }
}
