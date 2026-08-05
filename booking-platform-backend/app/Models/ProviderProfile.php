<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id', 'business_name', 'slug', 'headline', 'bio',
    'address_line', 'city', 'state', 'country', 'postal_code',
    'latitude', 'longitude', 'is_published',
])]
class ProviderProfile extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'rating_avg' => 'float',
            'rating_count' => 'integer',
            'is_published' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** True when the profile carries usable map coordinates. */
    public function hasCoordinates(): bool
    {
        return $this->latitude !== null && $this->longitude !== null;
    }

    public function formattedAddress(): ?string
    {
        $parts = array_filter([
            $this->address_line,
            $this->city,
            $this->state,
            $this->postal_code,
            $this->country,
        ]);

        return $parts ? implode(', ', $parts) : null;
    }
}
