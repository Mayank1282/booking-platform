@php
    $service = $booking->service;
    $providerName = $booking->provider->providerProfile?->business_name ?: $booking->provider->name;
    $where = $service->effectiveLocation()['formatted'];
    $money = $booking->currency.' '.number_format((float) $booking->price_amount, 2);
    $when = $booking->starts_at->format('l, j F Y').' at '.$booking->starts_at->format('g:i A');
@endphp

<x-mail.layout
    :heading="$forProvider ? 'A booking has been paid for' : 'Your booking is confirmed'"
    :intro="$forProvider
        ? $booking->client->name.' has paid for '.$service->title.'. The slot is now held for them and shows on your calendar.'
        : $service->title.' with '.$providerName.' is locked in. Payment has settled — nothing else is needed from you.'"
    :preview="$when.' · '.$service->title"
    pill="Confirmed"
    tone="good"
    :message="$message ?? null"
>
    <x-mail.details
        :amount="$money"
        :amountLabel="$forProvider ? 'Paid by client' : 'Amount paid'"
        :rows="[
        'Reference' => $booking->code,
        'Service' => $service->title,
        ($forProvider ? 'Client' : 'Provider') => $forProvider ? $booking->client->name : $providerName,
        'When' => $when,
        'Duration' => $booking->duration_minutes.' minutes',
        'Where' => $service->location_type?->isMappable() ? $where : $service->location_type?->label(),
    ]" />

    @if ($forProvider)
        <x-mail.note tone="neutral">
            This booking is paid, so it can no longer be cancelled from your side. If the client needs
            to move it, ask them to cancel and rebook, or contact support.
        </x-mail.note>
    @else
        <x-mail.note tone="neutral">
            Plans changed? You can cancel free of charge up to
            {{ config('booking.cancellation_window_hours') }} hours before the start time, and the
            full amount is refunded to your original payment method.
        </x-mail.note>
    @endif

    <x-mail.button :url="$frontendUrl.'/app/bookings/'.$booking->id">
        {{ $forProvider ? 'View in your calendar' : 'View your booking' }}
    </x-mail.button>

    <x-slot:footer>
        Sent because {{ $forProvider ? 'a client booked one of your services' : 'you booked through '.config('app.name') }}.
        Reference {{ $booking->code }}.
    </x-slot:footer>
</x-mail.layout>
