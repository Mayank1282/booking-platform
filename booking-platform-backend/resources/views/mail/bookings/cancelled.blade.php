@php
    $service = $booking->service;
    $providerName = $booking->provider->providerProfile?->business_name ?: $booking->provider->name;
    $money = $booking->currency.' '.number_format((float) $booking->price_amount, 2);
    $when = $booking->starts_at->format('l, j F Y').' at '.$booking->starts_at->format('g:i A');

    // Who pressed the button, said from this recipient's point of view — "you
    // cancelled" reads very differently from "the provider cancelled".
    $cancelledByClient = $cancelledBy->id === $booking->client_id;
    $cancelledByProvider = $cancelledBy->id === $booking->provider_id;
    $byYou = $cancelledBy->id === ($forProvider ? $booking->provider_id : $booking->client_id);

    $actor = match (true) {
        $byYou => 'you',
        $cancelledByClient => $booking->client->name,
        $cancelledByProvider => $forProvider ? 'you' : $providerName,
        default => 'an administrator',
    };

    $refunded = $booking->payment?->status?->value === 'refunded';
    $wasPaid = $refunded || $booking->payment?->status?->value === 'succeeded';

    // Stripe returns the money at once; the issuing bank decides when it shows.
    $window = config('booking.payments.refund_days_min').'–'.config('booking.payments.refund_days_max')
        .' business days';
@endphp

<x-mail.layout
    heading="This booking is cancelled"
    :intro="$service->title.' on '.$when.' is no longer going ahead. It was cancelled by '.$actor.'.'"
    :preview="'Cancelled · '.$service->title.' · '.$booking->starts_at->format('j M')"
    pill="Cancelled"
    tone="bad"
    :message="$message ?? null"
>
    {{-- The refunded figure heads the same card when there is one. --}}
    <x-mail.details
        :amount="$refunded ? $money : null"
        amountLabel="Refunded"
        :rows="[
        'Reference' => $booking->code,
        'Service' => $service->title,
        ($forProvider ? 'Client' : 'Provider') => $forProvider ? $booking->client->name : $providerName,
        'Was scheduled for' => $when,
        'Cancelled by' => $byYou ? 'You' : $cancelledBy->name,
        'Cancelled on' => $booking->cancelled_at?->format('j M Y, g:i A'),
        'Reason' => $booking->cancellation_reason,
    ]" />

    @if ($refunded)
        <x-mail.note tone="good">
            @if ($forProvider)
                The client has been refunded {{ $money }} in full, so nothing is owed on this
                booking. It should reach them within {{ $window }}.
            @else
                {{ $money }} is on its way back to the card you paid with. It has already left our
                payment provider — your bank decides when it appears, and that usually takes
                {{ $window }}. A separate email with the refund reference is on its way.
            @endif
        </x-mail.note>
    @elseif ($wasPaid)
        <x-mail.note tone="warn">
            @if ($forProvider)
                A refund of {{ $money }} to the client is being processed. Once issued it reaches
                them within {{ $window }}, and you will both get a confirmation with the reference.
            @else
                A refund of {{ $money }} is being processed back to the card you paid with. Once it
                is issued your bank typically takes {{ $window }} to show it, and we will email you
                the refund reference at that point.
            @endif
        </x-mail.note>
    @else
        <x-mail.note tone="neutral">
            No payment had settled on this booking, so there is nothing to refund and no charge was
            taken.
        </x-mail.note>
    @endif

    <x-mail.button :url="$forProvider ? $frontendUrl.'/app/bookings' : $frontendUrl.'/services'">
        {{ $forProvider ? 'Open your calendar' : 'Find another time' }}
    </x-mail.button>

    <x-slot:footer>
        The slot has been released back to {{ $forProvider ? 'your' : "the provider's" }} calendar.
        Reference {{ $booking->code }}.
    </x-slot:footer>
</x-mail.layout>
