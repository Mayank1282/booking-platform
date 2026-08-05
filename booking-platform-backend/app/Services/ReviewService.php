<?php

namespace App\Services;

use App\Exceptions\BookingException;
use App\Models\Booking;
use App\Models\Review;
use App\Models\Service;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ReviewService
{
    /**
     * Reviews are only possible once, and only for a completed booking the
     * reviewer actually placed.
     */
    public function create(User $client, Booking $booking, int $rating, ?string $comment): Review
    {
        if ($booking->client_id !== $client->id) {
            throw new BookingException('You can only review your own bookings.', 403);
        }

        if (! $booking->isReviewable()) {
            throw new BookingException(
                $booking->review
                    ? 'You have already reviewed this booking.'
                    : 'You can only review a booking once it has been completed.'
            );
        }

        return DB::transaction(function () use ($client, $booking, $rating, $comment) {
            $review = Review::create([
                'booking_id' => $booking->id,
                'service_id' => $booking->service_id,
                'client_id' => $client->id,
                'provider_id' => $booking->provider_id,
                'rating' => $rating,
                'comment' => $comment,
            ]);

            $this->recalculateAggregates($booking->service, $booking->provider);

            return $review->load('client:id,name,avatar_path');
        });
    }

    /**
     * Ratings are denormalised onto services and provider profiles so list
     * views can sort and filter on them without an aggregate join.
     */
    public function recalculateAggregates(Service $service, User $provider): void
    {
        $serviceStats = Review::where('service_id', $service->id)
            ->selectRaw('COUNT(*) as count, AVG(rating) as average')
            ->first();

        $service->update([
            'rating_count' => (int) $serviceStats->count,
            'rating_avg' => round((float) $serviceStats->average, 2),
        ]);

        $providerStats = Review::where('provider_id', $provider->id)
            ->selectRaw('COUNT(*) as count, AVG(rating) as average')
            ->first();

        $provider->providerProfile?->update([
            'rating_count' => (int) $providerStats->count,
            'rating_avg' => round((float) $providerStats->average, 2),
        ]);
    }
}
