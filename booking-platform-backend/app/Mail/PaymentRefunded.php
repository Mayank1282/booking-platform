<?php

namespace App\Mail;

use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PaymentRefunded extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Payment $payment,
        public bool $forProvider = false,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->forProvider
                ? "Refund issued — {$this->payment->booking->code}"
                : "Your refund is on its way — {$this->payment->booking->code}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.payments.refunded',
            with: [
                'payment' => $this->payment,
                'forProvider' => $this->forProvider,
                'frontendUrl' => rtrim(config('app.frontend_url'), '/'),
            ],
        );
    }
}
