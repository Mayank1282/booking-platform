<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\ProviderProfile;
use App\Models\Service;
use App\Services\SearchTermResolver;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly SearchTermResolver $terms) {}

    /**
     * A constraint matching rows whose column begins with the term. Shared by
     * every suggestion type so services, categories, cities and providers all
     * anchor to the first letter in the same way.
     */
    private function startsWith(string $column, string $term): callable
    {
        return fn ($q) => $q->where($column, 'like', "{$term}%");
    }

    /**
     * Typeahead suggestions for the marketplace search box.
     *
     * Returns four kinds of hit — matching services, categories, cities and
     * providers — so a visitor typing a rough term ("hair") is offered the
     * vocabulary the catalogue actually uses ("Hair & Beauty", "Signature
     * Haircut & Style") rather than a dead end.
     */
    public function suggestions(Request $request): JsonResponse
    {
        $term = trim($request->string('q')->toString());

        // A single character is enough to start suggesting — that is what
        // people expect from a search box.
        if ($term === '') {
            return $this->ok(['suggestions' => [], 'matched_term' => null]);
        }

        $matched = $this->terms->resolve($term);

        if ($matched === null) {
            return $this->ok(['suggestions' => [], 'matched_term' => null]);
        }

        $services = Service::query()
            ->active()
            ->with('category:id,name,slug')
            ->search($matched)
            // Whole-title matches rank above matches on a later word, so "t"
            // leads with "Tax Planning Consultation" rather than "Deep Tissue
            // Massage". CASE behaves identically on SQLite and MySQL.
            ->orderByRaw('CASE WHEN title LIKE ? THEN 0 ELSE 1 END', ["{$matched}%"])
            ->orderByDesc('bookings_count')
            ->limit(8)
            ->get()
            ->map(fn (Service $service) => [
                'type' => 'service',
                'label' => $service->title,
                'hint' => $service->category?->name,
                // Selecting a service jumps straight to its page.
                'slug' => $service->slug,
                'query' => $service->title,
            ]);

        $categories = Category::query()
            ->active()
            ->where($this->startsWith('name', $matched))
            ->withCount(['services' => fn ($q) => $q->where('is_active', true)])
            ->orderByRaw('CASE WHEN name LIKE ? THEN 0 ELSE 1 END', ["{$matched}%"])
            ->limit(4)
            ->get()
            ->map(fn (Category $category) => [
                'type' => 'category',
                'label' => $category->name,
                'hint' => $category->services_count.' service'.($category->services_count === 1 ? '' : 's'),
                'slug' => $category->slug,
                'query' => $category->name,
            ]);

        $cities = ProviderProfile::query()
            ->where('is_published', true)
            ->whereNotNull('city')
            ->where($this->startsWith('city', $matched))
            ->distinct()
            ->limit(4)
            ->pluck('city')
            ->map(fn (string $city) => [
                'type' => 'city',
                'label' => $city,
                'hint' => 'City',
                'slug' => $city,
                'query' => $city,
            ]);

        $providers = ProviderProfile::query()
            ->where('is_published', true)
            ->where($this->startsWith('business_name', $matched))
            ->limit(4)
            ->get()
            ->map(fn (ProviderProfile $profile) => [
                'type' => 'provider',
                'label' => $profile->business_name,
                'hint' => $profile->city ?? 'Provider',
                'slug' => $profile->slug,
                'query' => $profile->business_name,
            ]);

        return $this->ok([
            // Echoed back so the UI can say "showing results for …" when the
            // fallback kicked in and the term was shortened.
            'matched_term' => $matched === $term ? null : $matched,
            'suggestions' => $services
                ->concat($categories)
                ->concat($cities)
                ->concat($providers)
                ->values()
                ->all(),
        ]);
    }

}
