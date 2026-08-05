<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreReviewRequest;
use App\Http\Resources\ReviewResource;
use App\Models\Booking;
use App\Services\ReviewService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly ReviewService $reviews) {}

    public function store(StoreReviewRequest $request, Booking $booking): JsonResponse
    {
        $review = $this->reviews->create(
            $request->user(),
            $booking->load(['review', 'service', 'provider']),
            $request->integer('rating'),
            $request->input('comment'),
        );

        return $this->created(new ReviewResource($review), 'Thanks for the review.');
    }

    /** Reviews received by the signed-in provider. */
    public function received(Request $request): JsonResponse
    {
        $reviews = $request->user()
            ->reviewsReceived()
            ->with(['client:id,name,avatar_path', 'service:id,title,slug', 'booking:id,code'])
            ->latest()
            ->paginate(min((int) $request->integer('per_page', 10), 50));

        return $this->paginated(ReviewResource::collection($reviews));
    }
}
