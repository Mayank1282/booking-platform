@props(['tone' => 'neutral'])

@php
    $skins = [
        'neutral' => ['#f6f3ec', '#e9e4da', '#5c5545'],
        'good' => ['#eef3ec', '#dbe6dc', '#3f6b46'],
        'warn' => ['#fbf2e4', '#efe1c6', '#8a6320'],
        'bad' => ['#f9ecea', '#eed8d4', '#9b3b32'],
    ];

    [$bg, $border, $ink] = $skins[$tone] ?? $skins['neutral'];
@endphp

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px; background-color:{{ $bg }}; border:1px solid {{ $border }}; border-radius:12px;">
    <tr>
        <td style="padding:14px 18px; font-family:'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:{{ $ink }};">
            {{ $slot }}
        </td>
    </tr>
</table>
