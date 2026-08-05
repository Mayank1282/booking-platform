<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AvailabilityBlockRequest;
use App\Http\Requests\AvailabilityRuleRequest;
use App\Http\Resources\AvailabilityBlockResource;
use App\Http\Resources\AvailabilityRuleResource;
use App\Models\AvailabilityBlock;
use App\Models\Service;
use App\Services\AvailabilityService;
use App\Traits\ApiResponse;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AvailabilityController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly AvailabilityService $availability) {}

    /** Public: bookable start times for a service on one day. */
    public function slots(Request $request, Service $service): JsonResponse
    {
        $request->validate(['date' => ['required', 'date']]);

        $slots = $this->availability->slotsFor(
            $service->load('provider'),
            CarbonImmutable::parse($request->string('date'))
        );

        return $this->ok([
            'date' => CarbonImmutable::parse($request->string('date'))->toDateString(),
            'slots' => $slots,
            'available_count' => collect($slots)->where('available', true)->count(),
        ]);
    }

    /** Public: which days in a month have at least one open slot. */
    public function month(Request $request, Service $service): JsonResponse
    {
        $validated = $request->validate([
            'year' => ['required', 'integer', 'min:2020', 'max:2100'],
            'month' => ['required', 'integer', 'between:1,12'],
        ]);

        return $this->ok([
            'days' => $this->availability->monthOverview(
                $service->load('provider'),
                (int) $validated['year'],
                (int) $validated['month'],
            ),
        ]);
    }

    // --- Provider-managed working hours ----------------------------------

    public function rules(Request $request): JsonResponse
    {
        $rules = $request->user()->availabilityRules()
            ->orderBy('day_of_week')->orderBy('start_time')->get();

        return $this->ok(AvailabilityRuleResource::collection($rules)->resolve());
    }

    /**
     * The weekly schedule is saved as a whole rather than row by row — the UI
     * edits it as one grid, so replacing the set keeps the two in step.
     */
    public function saveRules(AvailabilityRuleRequest $request): JsonResponse
    {
        $provider = $request->user();

        DB::transaction(function () use ($request, $provider) {
            $provider->availabilityRules()->delete();

            foreach ($request->validated('rules') as $rule) {
                $provider->availabilityRules()->create([
                    'day_of_week' => $rule['day_of_week'],
                    'start_time' => $rule['start_time'],
                    'end_time' => $rule['end_time'],
                    'is_active' => $rule['is_active'] ?? true,
                ]);
            }
        });

        $rules = $provider->availabilityRules()->orderBy('day_of_week')->orderBy('start_time')->get();

        return $this->ok(AvailabilityRuleResource::collection($rules)->resolve(), 'Working hours saved.');
    }

    // --- Provider-managed blocked dates ----------------------------------

    public function blocks(Request $request): JsonResponse
    {
        $blocks = $request->user()->availabilityBlocks()
            ->where('ends_at', '>=', now()->subMonth())
            ->orderBy('starts_at')
            ->get();

        return $this->ok(AvailabilityBlockResource::collection($blocks)->resolve());
    }

    public function storeBlock(AvailabilityBlockRequest $request): JsonResponse
    {
        $block = $request->user()->availabilityBlocks()->create($request->validated());

        return $this->created(new AvailabilityBlockResource($block), 'Dates blocked.');
    }

    public function destroyBlock(Request $request, AvailabilityBlock $block): JsonResponse
    {
        abort_unless($block->provider_id === $request->user()->id, 403, 'This block does not belong to you.');

        $block->delete();

        return $this->ok(null, 'Block removed.');
    }
}
