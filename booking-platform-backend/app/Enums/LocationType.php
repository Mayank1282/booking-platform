<?php

namespace App\Enums;

enum LocationType: string
{
    case Remote = 'remote';
    case OnSite = 'on_site';
    case ClientLocation = 'client_location';

    public function label(): string
    {
        return match ($this) {
            self::Remote => 'Remote / Online',
            self::OnSite => "At the provider's location",
            self::ClientLocation => "At the client's location",
        };
    }

    /** Only on-site services are worth pinning on the map. */
    public function isMappable(): bool
    {
        return $this === self::OnSite;
    }
}
