<?php

namespace App\Services;

use App\Models\Category;
use App\Models\ProviderProfile;
use App\Models\Service;

/**
 * Widens a search term until it matches something.
 *
 * Visitors type compound words the catalogue does not use — "hairstyle" when
 * the listing says "Signature Haircut & Style". A plain LIKE returns nothing
 * and the search looks broken, so progressively shorter prefixes are tried
 * until one hits ("hairstyle" → "hairsty" → … → "hair").
 *
 * Shared by the typeahead and the directory listing so both widen identically —
 * a suggestion that appears in the dropdown always returns results when chosen.
 */
class SearchTermResolver
{
    /** Below this, a prefix matches half the catalogue and stops being useful. */
    private const MIN_LENGTH = 3;

    public function resolve(?string $term): ?string
    {
        $term = trim((string) $term);

        if ($term === '') {
            return null;
        }

        if ($this->hasAnyMatch($term)) {
            return $term;
        }

        for ($length = mb_strlen($term) - 1; $length >= self::MIN_LENGTH; $length--) {
            $candidate = mb_substr($term, 0, $length);

            if ($this->hasAnyMatch($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * Prefix matching, identical to the search itself — if this used a looser
     * rule it would happily "resolve" a term the search then finds nothing for.
     */
    private function hasAnyMatch(string $candidate): bool
    {
        $like = "{$candidate}%";

        return Service::query()->active()->where('title', 'like', $like)->exists()
            || Category::query()->active()->where('name', 'like', $like)->exists()
            || ProviderProfile::query()->where('is_published', true)
                ->where(fn ($q) => $q->where('city', 'like', $like)->orWhere('business_name', 'like', $like))
                ->exists();
    }
}
