@props([
    'rows' => [],
    // Optional headline figure, rendered as the first row of the same card.
    // Two stacked bordered boxes read as two unrelated things; the amount and
    // the details it refers to are one object, so they share one container.
    'amount' => null,
    'amountLabel' => 'Total',
])

@php
    $sans = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
    $serif = "'Fraunces', Georgia, 'Times New Roman', serif";
    $visible = collect($rows)->reject(fn ($value) => blank($value));
@endphp

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="border:1px solid #e9e4da; border-radius:12px; background-color:#fffefb;">

    @if (filled($amount))
        <tr>
            <td style="padding:16px 18px; background-color:#f6f3ec; border-radius:12px 12px 0 0;">
                {{-- Nested, borderless table: the stacking below happens inside
                     it, so the card's own border is never cut up. --}}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td class="sw-label" style="font-family:{{ $sans }}; font-size:12px; letter-spacing:0.4px; text-transform:uppercase; color:#8b8471; vertical-align:middle;">
                            {{ $amountLabel }}
                        </td>
                        <td class="sw-figure" align="right" style="font-family:{{ $serif }}; font-size:25px; letter-spacing:-0.5px; color:#a63d2a; vertical-align:middle;">
                            {{ $amount }}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    @endif

    @foreach ($visible as $label => $value)
        <tr>
            {{-- One cell per row. The label/value split lives in a nested table
                 so a phone can stack it without touching this separator. --}}
            <td style="padding:13px 18px; {{ ! $loop->first || filled($amount) ? 'border-top:1px solid #f0ece3;' : '' }}">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td class="sw-label" width="38%" style="font-family:{{ $sans }}; font-size:12px; letter-spacing:0.4px; text-transform:uppercase; color:#8b8471; vertical-align:top; padding-right:12px;">
                            {{ $label }}
                        </td>
                        <td class="sw-value" style="font-family:{{ $sans }}; font-size:15px; line-height:22px; color:#17150f; vertical-align:top;">
                            {{ $value }}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    @endforeach
</table>
