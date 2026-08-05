@component('mail::message')
# Your booking is confirmed

**{{ $booking->service->title }}** with {{ $booking->provider->name }} is locked in.

@component('mail::table')
| | |
|:---|:---|
| **Reference** | {{ $booking->code }} |
| **When** | {{ $booking->starts_at->format('D, j M Y') }} at {{ $booking->starts_at->format('g:i A') }} |
| **Duration** | {{ $booking->duration_minutes }} minutes |
| **Amount paid** | {{ $booking->currency }} {{ number_format((float) $booking->price_amount, 2) }} |
@endcomponent

Need to change plans? You can cancel free of charge up to
{{ config('booking.cancellation_window_hours') }} hours before the start time.

@component('mail::button', ['url' => $frontendUrl.'/app/bookings/'.$booking->id])
View booking
@endcomponent

See you soon,<br>
{{ config('app.name') }}
@endcomponent
