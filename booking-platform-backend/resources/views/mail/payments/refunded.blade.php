@php
    $booking = $payment->booking;
    $service = $booking->service;
    $providerName = $booking->provider->providerProfile?->business_name ?: $booking->provider->name;

    // The refund amount, not the booking price — a partial refund issued from
    // the Stripe dashboard is a real case, and quoting the wrong number here
    // is the kind of thing that turns into a support ticket.
    $refunded = (float) ($payment->refund_amount ?? $payment->amount);
    $money = $payment->currency.' '.number_format($refunded, 2);
    $partial = $refunded + 0.001 < (float) $payment->amount;
    $when = $booking->starts_at->format('l, j F Y').' at '.$booking->starts_at->format('g:i A');

    $window = config('booking.payments.refund_days_min').'–'.config('booking.payments.refund_days_max')
        .' business days';
@endphp

<x-mail.layout
    :heading="$forProvider ? 'A refund has been issued' : ($partial ? 'Part of your payment has been refunded' : 'Your payment has been refunded')"
    :intro="$forProvider
        ? 'The charge for '.$service->title.' with '.$booking->client->name.' has been refunded. This booking is settled — nothing further is owed either way.'
        : $money.' from your booking of '.$service->title.' has been sent back to the card you paid with. Expect it within '.$window.'.'"
    :preview="$money.' refunded · '.$booking->code"
    pill="Refunded"
    tone="info"
    :message="$message ?? null"
>
    <x-mail.details :amount="$money" amountLabel="Refunded" :rows="[
        'Reference' => $booking->code,
        'Service' => $service->title,
        ($forProvider ? 'Client' : 'Provider') => $forProvider ? $booking->client->name : $providerName,
        'Was scheduled for' => $when,
        'Original charge' => $payment->currency.' '.number_format((float) $payment->amount, 2),
        'Refunded on' => $payment->refunded_at?->format('j M Y, g:i A'),
        'Reason' => $payment->refund_reason,
        'Refund ID' => $payment->refund_reference,
    ]" />

    @unless ($forProvider)
        <x-mail.note tone="neutral">
            Refunds go back to the card the payment came from and cannot be redirected elsewhere.
            The money has already left our payment provider — your bank decides when it appears, and
            that usually takes {{ $window }}. If it has not arrived by then, quote the refund ID
            above to your bank.
        </x-mail.note>
    @endunless

    @if ($partial)
        <x-mail.note tone="warn">
            This was a partial refund — {{ $payment->currency }}
            {{ number_format((float) $payment->amount - $refunded, 2) }} of the original charge was
            retained.
        </x-mail.note>
    @endif

    <x-mail.button :url="$frontendUrl.'/app/payments'">
        {{ $forProvider ? 'View your earnings' : 'View your payments' }}
    </x-mail.button>

    <x-slot:footer>
        This is a record of a refund on booking {{ $booking->code }}. Keep it for your files.
    </x-slot:footer>
</x-mail.layout>
