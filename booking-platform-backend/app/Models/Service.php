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
     * Matches services whose title *begins* with the term.
     *
     * Deliberately strict: only the start of the title counts, so "t" returns
     * "Tax Planning Consultation" and nothing else. Matching mid-title words
     * would also surface "Deep Tissue Massage" and "Beard Sculpt & Hot Towel",
     * which is not what a first-letter search is expected to do.
     */
    #[Scope]
    protected function search(Builder $query, ?string $term): void
    {
        $query->when($term, fn (Builder $q) => $q->where('title', 'like', "{$term}%"));
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

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
