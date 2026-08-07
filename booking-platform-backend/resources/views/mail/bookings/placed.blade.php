@php
    $service = $booking->service;
    $providerName = $booking->provider->providerProfile?->business_name ?: $booking->provider->name;
    $money = $booking->currency.' '.number_format((float) $booking->price_amount, 2);
    $when = $booking->starts_at->format('l, j F Y').' at '.$booking->starts_at->format('g:i A');
    $holdMinutes = (int) config('booking.hold_minutes');
@endphp

<x-mail.layout
    :heading="$forProvider ? 'Someone is booking you' : 'Your slot is being held'"
    :intro="$forProvider
        ? $booking->client->name.' has picked a time for '.$service->title.'. Nothing is committed until their payment settles — we will email you the moment it does.'
        : 'We have put a hold on '.$when.'. It becomes a real booking as soon as your payment goes through.'"
    :preview="'Held for '.$holdMinutes.' minutes · '.$service->title"
    pill="Awaiting payment"
    tone="warn"
    :message="$message ?? null"
>
    <x-mail.details
        :amount="$money"
        :amountLabel="$forProvider ? 'Booking value' : 'To pay'"
        :rows="[
        'Reference' => $booking->code,
        'Service' => $service->title,
        ($forProvider ? 'Client' : 'Provider') => $forProvider ? $booking->client->name : $providerName,
        'When' => $when,
        'Duration' => $booking->duration_minutes.' minutes',
    ]" />

    @unless ($forProvider)
        <x-mail.note tone="warn">
            This hold lasts {{ $holdMinutes }} minutes. If payment is not completed in that time the
            slot is released and someone else can take it — you will not be charged.
        </x-mail.note>
    @endunless

    <x-mail.button :url="$frontendUrl.'/app/bookings/'.$booking->id">
        {{ $forProvider ? 'View the request' : 'Complete payment' }}
    </x-mail.button>

    <x-slot:footer>
        Sent because {{ $forProvider ? 'a client started a booking with you' : 'you started a booking on '.config('app.name') }}.
        Reference {{ $booking->code }}.
    </x-slot:footer>
</x-mail.layout>
