<?php

namespace App\Models;

use App\Enums\BookingStatus;
use App\Enums\LocationType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

#[Fillable([
    'provider_id', 'category_id', 'title', 'slug', 'description', 'image_path',
    'duration_minutes', 'buffer_minutes', 'price', 'currency', 'location_type', 'is_active',
    'address_line', 'city', 'state', 'postal_code', 'latitude', 'longitude',
])]
class Service extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'duration_minutes' => 'integer',
            'buffer_minutes' => 'integer',
            'rating_avg' => 'float',
            'rating_count' => 'integer',
            'bookings_count' => 'integer',
            'is_active' => 'boolean',
            'location_type' => LocationType::class,
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    // --- Relationships ----------------------------------------------------

    public function provider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'provider_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    // --- Scopes -----------------------------------------------------------

    #[Scope]
    protected function active(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /**
     * Matches services whose title, category, provider or city *begins* with
     * the term.
     *
     * Prefix-anchored on purpose: "t" returns "Tax Planning Consultation" and
     * not every listing containing a "t". Matching the category and provider
     * as well as the title is what keeps this consistent with the typeahead —
     * that offers "Hair & Beauty" for "hair", so the listing has to return the
     * services in it, even though no service title starts with "hair".
     */
    #[Scope]
    protected function search(Builder $query, ?string $term): void
    {
        $query->when($term, function (Builder $q) use ($term) {
            $like = "{$term}%";

            $q->where(fn (Builder $inner) => $inner
                ->where('title', 'like', $like)
                ->orWhereHas('category', fn ($c) => $c->where('name', 'like', $like))
                ->orWhereHas('provider.providerProfile', fn ($p) => $p
                    ->where('business_name', 'like', $like)
                    ->orWhere('city', 'like', $like)));
        });
    }

    #[Scope]
    protected function priceBetween(Builder $query, ?float $min, ?float $max): void
    {
        $query->when($min !== null, fn (Builder $q) => $q->where('price', '>=', $min))
            ->when($max !== null, fn (Builder $q) => $q->where('price', '<=', $max));
    }

    #[Scope]
    protected function minRating(Builder $query, ?float $rating): void
    {
        $query->when($rating, fn (Builder $q) => $q->where('rating_avg', '>=', $rating));
    }

    // --- Helpers ----------------------------------------------------------

    /**
     * Where this service actually happens.
     *
     * A service may carry its own address; when it does not, it falls back to
     * the provider's profile. Callers should never read the raw columns — a
     * blank service address means "inherit", not "no location".
     *
     * @return array{address_line: ?string, city: ?string, state: ?string, postal_code: ?string, latitude: ?float, longitude: ?float, formatted: ?string, source: string}
     */
    public function effectiveLocation(): array
    {
        $ownsCoordinates = $this->latitude !== null && $this->longitude !== null;
        $profile = $this->provider?->providerProfile;

        if ($ownsCoordinates || filled($this->address_line) || filled($this->city)) {
            return $this->locationPayload(
                $this->address_line, $this->city, $this->state, $this->postal_code,
                $this->latitude, $this->longitude, 'service'
            );
        }

        return $this->locationPayload(
            $profile?->address_line, $profile?->city, $profile?->state, $profile?->postal_code,
            $profile?->latitude, $profile?->longitude, 'provider'
        );
    }

    private function locationPayload(
        ?string $address, ?string $city, ?string $state, ?string $postal,
        ?float $lat, ?float $lng, string $source
    ): array {
        $parts = array_filter([$address, $city, $state, $postal]);

        return [
            'address_line' => $address,
            'city' => $city,
            'state' => $state,
            'postal_code' => $postal,
            'latitude' => $lat,
            'longitude' => $lng,
            'formatted' => $parts ? implode(', ', $parts) : null,
            'source' => $source,
        ];
    }

    public function imageUrl(): ?string
    {
        return $this->image_path ? Storage::disk('public')->url($this->image_path) : null;
    }

    /** Wall-clock minutes a booking consumes, including the provider's buffer. */
    public function totalBlockMinutes(): int
    {
        return $this->duration_minutes + $this->buffer_minutes;
    }

    public function upcomingBookingsCount(): int
    {
        return $this->bookings()
            ->whereIn('status', BookingStatus::blocking())
            ->where('starts_at', '>=', now())
            ->count();
    }

    /**
     * Bookings that have been committed to but not yet delivered.
     *
     * Note this counts a confirmed booking whose time has already passed but
     * which the provider has not marked completed. Someone paid to be at a
     * particular address; moving it out from under them is not allowed until
     * the appointment is actually done.
     */
    public function outstandingBookingsCount(): int
    {
        return $this->bookings()->blocking()->count();
    }

    /** The address is frozen while anyone is still owed an appointment. */
    public function locationIsLocked(): bool
    {
        return $this->outstandingBookingsCount() > 0;
    }

    /** True when the given payload would move this service. */
    public function locationWouldChange(array $data): bool
    {
        foreach (['address_line', 'city', 'state', 'postal_code'] as $field) {
            if (array_key_exists($field, $data) && (string) $data[$field] !== (string) $this->{$field}) {
                return true;
            }
        }

        foreach (['latitude', 'longitude'] as $field) {
            if (! array_key_exists($field, $data)) {
                continue;
            }

            $new = $data[$field] === null || $data[$field] === '' ? null : round((float) $data[$field], 6);
            $current = $this->{$field} === null ? null : round((float) $this->{$field}, 6);

            if ($new !== $current) {
                return true;
            }
        }

        return false;
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
