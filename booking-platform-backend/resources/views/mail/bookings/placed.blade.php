@component('mail::message')
@if ($forProvider)
# New booking request

**{{ $booking->client->name }}** has requested a booking. It stays pending until the payment settles.
@else
# Thanks — we've got your booking

Your booking has been placed and is awaiting payment confirmation.
@endif

@component('mail::table')
| | |
|:---|:---|
| **Reference** | {{ $booking->code }} |
| **Service** | {{ $booking->service->title }} |
| **{{ $forProvider ? 'Client' : 'Provider' }}** | {{ $forProvider ? $booking->client->name : $booking->provider->name }} |
| **When** | {{ $booking->starts_at->format('D, j M Y') }} at {{ $booking->starts_at->format('g:i A') }} |
| **Duration** | {{ $booking->duration_minutes }} minutes |
| **Amount** | {{ $booking->currency }} {{ number_format((float) $booking->price_amount, 2) }} |
@endcomponent

@component('mail::button', ['url' => $frontendUrl.'/app/bookings/'.$booking->id])
View booking
@endcomponent

Thanks,<br>
{{ config('app.name') }}
@endcomponent
