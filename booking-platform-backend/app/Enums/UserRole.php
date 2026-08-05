<?php

namespace App\Enums;

enum UserRole: string
{
    case Client = 'client';
    case Provider = 'provider';
    case Admin = 'admin';

    public function label(): string
    {
        return match ($this) {
            self::Client => 'Client',
            self::Provider => 'Provider',
            self::Admin => 'Administrator',
        };
    }

    /** Roles a visitor may choose at registration — admin is never one. */
    public static function selfAssignable(): array
    {
        return [self::Client->value, self::Provider->value];
    }
}
