<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ServiceRequest;
use App\Http\Resources\ReviewResource;
use App\Http\Resources\ServiceResource;
use App\Models\Review;
use App\Models\Service;
use App\Services\SearchTermResolver;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ServiceController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly SearchTermResolver $terms) {}

    /** Public marketplace listing with search, filters and sorting. */
    public function index(Request $request): JsonResponse
    {
        $requested = $request->string('q')->toString() ?: null;

        // Widened so a compound term the catalogue does not use ("hairstyle")
        // still returns the listings a visitor meant. Uses the same resolver
        // as the typeahead, so a chosen suggestion always has results behind it.
        //
        // When nothing can be widened to, fall back to the original term rather
        // than to null: null means "no search at all", which would answer a
        // query for gibberish with the entire catalogue.
        $term = $requested ? ($this->terms->resolve($requested) ?? $requested) : null;

        $services = Service::query()
            ->active()
            ->with(['category', 'provider.providerProfile'])
            ->search($term)
            ->priceBetween(
                $request->filled('min_price') ? (float) $request->input('min_price') : null,
                $request->filled('max_price') ? (float) $request->input('max_price') : null,
            )
            ->minRating($request->filled('min_rating') ? (float) $request->input('min_rating') : null)
            ->when($request->filled('category'), fn ($q) => $q->whereHas(
                'category',
                fn ($c) => $c->where('slug', $request->string('category'))
            ))
            ->when($request->filled('location_type'), fn ($q) => $q->where('location_type', $request->string('location_type')))
            ->when($request->filled('city'), fn ($q) => $q->whereHas(
                'provider.providerProfile',
                fn ($p) => $p->where('city', 'like', '%'.$request->string('city').'%')
            ))
            // "Near this place", used by the map search. A bounding box rather
            // than a haversine distance: SQLite has no guaranteed trigonometric
            // functions, and a box is accurate enough to answer "roughly here"
            // while staying identical across both databases.
            ->when(
                $request->filled('near_lat') && $request->filled('near_lng'),
                function ($q) use ($request) {
                    $lat = (float) $request->input('near_lat');
                    $lng = (float) $request->input('near_lng');
                    $radius = min(max((float) $request->input('radius_km', 25), 1), 500);

                    // ~111 km per degree of latitude; longitude narrows toward
                    // the poles, so scale it by the cosine of the latitude.
                    $latDelta = $radius / 111;
                    $lngDelta = $radius / max(111 * cos(deg2rad($lat)), 0.000001);

                    $q->whereHas('provider.providerProfile', fn ($p) => $p
                        ->whereBetween('latitude', [$lat - $latDelta, $lat + $latDelta])
                        ->whereBetween('longitude', [$lng - $lngDelta, $lng + $lngDelta]));
                }
            )
            ->tap(fn ($q) => $this->applySort($q, $request->string('sort')->toString()))
            ->paginate(min((int) $request->integer('per_page', 12), 48))
            ->withQueryString();

        return $this->paginated(
            ServiceResource::collection($services),
            // Surfaced so the UI can say "showing results for …" when the
            // term had to be widened to find anything.
            $term && $term !== $requested ? "Showing results for \"{$term}\"" : 'OK'
        );
    }

    public function show(Service $service): JsonResponse
    {
        abort_unless($service->is_active, 404);

        return $this->ok(new ServiceResource(
            $service->load(['category', 'provider.providerProfile'])
        ));
    }

    /** Reviews for one service, newest first. */
    public function reviews(Service $service, Request $request): JsonResponse
    {
        $reviews = Review::query()
            ->where('service_id', $service->id)
            ->with('client:id,name,avatar_path')
            ->latest()
            ->paginate(min((int) $request->integer('per_page', 10), 50));

        return $this->paginated(ReviewResource::collection($reviews));
    }

    /** Services owned by the signed-in provider, including inactive ones. */
    public function mine(Request $request): JsonResponse
    {
        $services = $request->user()
            ->services()
            ->with(['category', 'provider.providerProfile'])
            ->when($request->filled('q'), fn ($q) => $q->search($request->string('q')->toString()))
            ->latest()
            ->paginate(min((int) $request->integer('per_page', 12), 48));

        return $this->paginated(ServiceResource::collection($services));
    }

    public function store(ServiceRequest $request): JsonResponse
    {
        $data = $request->safe()->except('image');
        $data['provider_id'] = $request->user()->id;
        $data['slug'] = $this->uniqueSlug($data['title']);
        $data['currency'] = 'INR';

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('services', 'public');
        }

        $service = Service::create($data);

        return $this->created(
            new ServiceResource($service->load(['category', 'provider.providerProfile'])),
            'Service created.'
        );
    }

    public function update(ServiceRequest $request, Service $service): JsonResponse
    {
        $this->authorizeOwnership($request, $service);

        $data = $request->safe()->except('image');

        if ($request->hasFile('image')) {
            if ($service->image_path) {
                Storage::disk('public')->delete($service->image_path);
            }
            $data['image_path'] = $request->file('image')->store('services', 'public');
        }

        $service->update($data);

        return $this->ok(
            new ServiceResource($service->fresh(['category', 'provider.providerProfile'])),
            'Service updated.'
        );
    }

    /**
     * Services with live bookings are deactivated rather than deleted, so the
     * booking history keeps pointing at something real.
     */
    public function destroy(Request $request, Service $service): JsonResponse
    {
        $this->authorizeOwnership($request, $service);

        if ($service->upcomingBookingsCount() > 0) {
            return $this->fail('This service has upcoming bookings. Deactivate it instead of deleting it.', 422);
        }

        if ($service->bookings()->exists()) {
            $service->update(['is_active' => false]);

            return $this->ok(null, 'Service archived — it has past bookings, so its history is kept.');
        }

        if ($service->image_path) {
            Storage::disk('public')->delete($service->image_path);
        }

        $service->delete();

        return $this->ok(null, 'Service deleted.');
    }

    private function authorizeOwnership(Request $request, Service $service): void
    {
        abort_unless($service->provider_id === $request->user()->id, 403, 'This is not your service.');
    }

    private function applySort($query, ?string $sort): void
    {
        match ($sort) {
            'price_asc' => $query->orderBy('price'),
            'price_desc' => $query->orderByDesc('price'),
            'rating' => $query->orderByDesc('rating_avg')->orderByDesc('rating_count'),
            'popular' => $query->orderByDesc('bookings_count'),
            default => $query->latest(),
        };
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'service';
        $slug = $base;
        $i = 2;

        while (Service::where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }
}
