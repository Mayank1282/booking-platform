@props(['url'])

{{-- Table-wrapped so Outlook renders the fill rather than a bare link. --}}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
    <tr>
        <td align="center" style="background-color:#a63d2a; border-radius:10px;">
            <a href="{{ $url }}" target="_blank" rel="noopener" style="display:inline-block; padding:13px 26px; font-family:'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">
                {{ $slot }}
            </a>
        </td>
    </tr>
</table>
