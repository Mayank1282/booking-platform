@component('mail::message')
# Booking cancelled

Booking **{{ $booking->code }}** ({{ $booking->service->title }}) was cancelled by
{{ $cancelledBy->name }}.

@component('mail::table')
| | |
|:---|:---|
| **Was scheduled for** | {{ $booking->starts_at->format('D, j M Y') }} at {{ $booking->starts_at->format('g:i A') }} |
@if ($booking->cancellation_reason)
| **Reason** | {{ $booking->cancellation_reason }} |
@endif
@endcomponent

@if ($booking->payment?->status?->value === 'refunded')
The payment for this booking has been refunded.
@endif

@component('mail::button', ['url' => $frontendUrl.'/services'])
Browse other services
@endcomponent

Thanks,<br>
{{ config('app.name') }}
@endcomponent
