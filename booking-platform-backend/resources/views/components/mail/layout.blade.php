@props([
    // One line shown in the inbox preview strip, next to the subject.
    'preview' => '',
    'heading' => '',
    'intro' => '',
    // Status pill: 'good' (confirmed), 'warn' (awaiting), 'bad' (cancelled),
    // 'info' (refunded). Anything else falls back to neutral.
    'pill' => null,
    'tone' => 'info',
    // The Symfony message being built. Anonymous components do not inherit the
    // parent view's scope, so each template hands it down; it is what lets the
    // mark ride along as an inline attachment.
    'message' => null,
])

@php
    /*
     * Email clients strip <style> unpredictably and support no CSS variables,
     * so every colour is inlined. The palette is the site's: bone canvas, ink
     * text, terracotta accent.
     */
    $tones = [
        'good' => ['#eef3ec', '#3f6b46'],
        'warn' => ['#fbf2e4', '#8a6320'],
        'bad' => ['#f9ecea', '#9b3b32'],
        'info' => ['#eceef3', '#404a63'],
    ];

    [$pillBg, $pillInk] = $tones[$tone] ?? $tones['info'];

    /*
     * Gmail and Outlook render neither inline SVG nor a CSS-drawn shape, so
     * the mark travels as an inline PNG attachment referenced by cid. The
     * browser preview has no message to attach to, hence the URL fallback.
     */
    $markFile = public_path('mail/mark.png');
    $mark = $message && is_file($markFile) ? $message->embed($markFile) : asset('mail/mark.png');

    $serif = "'Fraunces', Georgia, 'Times New Roman', serif";
    $sans = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
    $mono = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
@endphp

<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>{{ $heading ?: config('app.name') }}</title>
    <style>
        /* Outlook ignores this; the inline styles are what actually hold the
           layout together. This only handles what inline cannot. */
        body { margin: 0; padding: 0; width: 100% !important; }
        img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        a { color: #a63d2a; }

        @media only screen and (max-width: 600px) {
            .sw-pad { padding-left: 22px !important; padding-right: 22px !important; }
            .sw-h1 { font-size: 26px !important; line-height: 32px !important; }

            /*
              Label above value on a narrow screen. These live in a nested,
              borderless table, so going to block here cannot break the card's
              own border or its row separators.
            */
            .sw-label, .sw-value, .sw-figure {
                display: block !important;
                width: 100% !important;
                padding-right: 0 !important;
                text-align: left !important;
            }
            .sw-label { padding-bottom: 4px !important; }
            .sw-figure { font-size: 23px !important; padding-top: 2px !important; }
        }
    </style>
</head>
<body style="margin:0; padding:0; background-color:#f1ede5;">

{{-- Preheader: shown in the inbox list, hidden in the opened mail. --}}
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#f1ede5; opacity:0;">
    {{ $preview }}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1ede5;">
    <tr>
        <td align="center" style="padding:32px 12px;">

            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

                {{-- Wordmark --}}
                <tr>
                    <td class="sw-pad" style="padding:0 34px 18px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="padding-right:9px; line-height:0;">
                                    <img src="{{ $mark }}" width="28" height="28" alt="{{ config('app.name') }}"
                                         style="display:block; width:28px; height:28px; border:0; border-radius:8px;">
                                </td>
                                <td style="font-family:{{ $serif }}; font-size:19px; letter-spacing:-0.2px; color:#17150f;">
                                    {{ config('app.name') }}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                {{-- Card --}}
                <tr>
                    <td style="background-color:#faf9f6; border:1px solid #e5dfd4; border-radius:16px;">

                        {{-- A hairline of accent along the top edge. --}}
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="height:3px; line-height:3px; font-size:0; background-color:#a63d2a; border-radius:16px 16px 0 0;">&nbsp;</td>
                            </tr>
                        </table>

                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td class="sw-pad" style="padding:34px 34px 8px;">
                                    @if ($pill)
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                                            <tr>
                                                <td style="background-color:{{ $pillBg }}; border-radius:999px; padding:5px 12px; font-family:{{ $sans }}; font-size:11px; font-weight:600; letter-spacing:0.7px; text-transform:uppercase; color:{{ $pillInk }};">
                                                    {{ $pill }}
                                                </td>
                                            </tr>
                                        </table>
                                    @endif

                                    <h1 class="sw-h1" style="margin:0; font-family:{{ $serif }}; font-size:31px; line-height:38px; font-weight:400; letter-spacing:-0.6px; color:#17150f;">
                                        {{ $heading }}
                                    </h1>

                                    @if ($intro)
                                        <p style="margin:12px 0 0; font-family:{{ $sans }}; font-size:15px; line-height:24px; color:#5c5545;">
                                            {{ $intro }}
                                        </p>
                                    @endif
                                </td>
                            </tr>

                            <tr>
                                <td class="sw-pad" style="padding:20px 34px 34px;">
                                    {{ $slot }}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                {{-- Footer --}}
                <tr>
                    <td class="sw-pad" style="padding:22px 34px 0;">
                        <p style="margin:0; font-family:{{ $sans }}; font-size:12px; line-height:20px; color:#8b8471;">
                            {{ $footer ?? 'You are receiving this because you have an account on '.config('app.name').'.' }}
                        </p>
                        <p style="margin:10px 0 0; font-family:{{ $mono }}; font-size:11px; line-height:18px; color:#a49c88;">
                            {{ config('app.name') }} · booked, paid and confirmed in one place
                        </p>
                    </td>
                </tr>

            </table>
        </td>
    </tr>
</table>

</body>
</html>
