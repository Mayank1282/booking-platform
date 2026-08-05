<?php

namespace App\Http\Controllers\Api;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Http\Resources\ReviewResource;
use App\Models\Booking;
use App\Models\Payment;
use App\Traits\ApiResponse;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        return $request->user()->isProvider()
            ? $this->providerDashboard($request)
            : $this->clientDashboard($request);
    }

    private function providerDashboard(Request $request): JsonResponse
    {
        $provider = $request->user();
        $bookings = Booking::where('provider_id', $provider->id);

        $earnings = Payment::where('provider_id', $provider->id)->succeeded();

        return $this->ok([
            'role' => 'provider',
            'stats' => [
                'total_bookings' => (clone $bookings)->count(),
                'pending_bookings' => (clone $bookings)->where('status', BookingStatus::Pending)->count(),
                'upcoming_bookings' => (clone $bookings)->upcoming()->count(),
                'completed_bookings' => (clone $bookings)->where('status', BookingStatus::Completed)->count(),
                'total_earnings' => round((float) (clone $earnings)->sum('amount'), 2),
                'earnings_this_month' => round((float) (clone $earnings)
                    ->where('paid_at', '>=', now()->startOfMonth())->sum('amount'), 2),
                'active_services' => $provider->services()->active()->count(),
                'rating_avg' => (float) ($provider->providerProfile?->rating_avg ?? 0),
                'rating_count' => (int) ($provider->providerProfile?->rating_count ?? 0),
            ],
            'revenue_by_month' => $this->revenueByMonth($provider->id),
            'bookings_by_status' => $this->bookingsByStatus($provider->id, 'provider_id'),
            'upcoming' => BookingResource::collection(
                (clone $bookings)->upcoming()
                    ->with(['service.category', 'client', 'payment'])
                    ->orderBy('starts_at')
                    ->limit(5)
                    ->get()
            )->resolve(),
            'recent_reviews' => ReviewResource::collection(
                $provider->reviewsReceived()
                    ->with(['client:id,name,avatar_path', 'service:id,title,slug'])
                    ->latest()->limit(4)->get()
            )->resolve(),
        ]);
    }

    private function clientDashboard(Request $request): JsonResponse
    {
        $client = $request->user();
        $bookings = Booking::where('client_id', $client->id);

        $spend = Payment::where('client_id', $client->id)->succeeded();

        return $this->ok([
            'role' => 'client',
            'stats' => [
                'total_bookings' => (clone $bookings)->count(),
                'upcoming_bookings' => (clone $bookings)->upcoming()->count(),
                'completed_bookings' => (clone $bookings)->where('status', BookingStatus::Completed)->count(),
                'cancelled_bookings' => (clone $bookings)->where('status', BookingStatus::Cancelled)->count(),
                'total_spent' => round((float) (clone $spend)->sum('amount'), 2),
                'spent_this_month' => round((float) (clone $spend)
                    ->where('paid_at', '>=', now()->startOfMonth())->sum('amount'), 2),
                'pending_payment' => (clone $bookings)
                    ->whereHas('payment', fn ($q) => $q->whereIn('status', [PaymentStatus::Pending, PaymentStatus::Failed]))
                    ->count(),
                'awaiting_review' => (clone $bookings)
                    ->where('status', BookingStatus::Completed)
                    ->whereDoesntHave('review')
                    ->count(),
            ],
            'spend_by_month' => $this->spendByMonth($client->id),
            'bookings_by_status' => $this->bookingsByStatus($client->id, 'client_id'),
            'upcoming' => BookingResource::collection(
                (clone $bookings)->upcoming()
                    ->with(['service.category', 'provider.providerProfile', 'payment'])
                    ->orderBy('starts_at')
                    ->limit(5)
                    ->get()
            )->resolve(),
            'to_review' => BookingResource::collection(
                (clone $bookings)
                    ->where('status', BookingStatus::Completed)
                    ->whereDoesntHave('review')
                    ->with(['service.category', 'provider', 'review'])
                    ->latest('completed_at')->limit(4)->get()
            )->resolve(),
        ]);
    }

    /**
     * Six-month series for the dashboard chart. Grouping is done in PHP so the
     * query stays identical on SQLite and MySQL (their date functions differ).
     */
    private function revenueByMonth(int $providerId): array
    {
        return $this->monthlyTotals(
            Payment::where('provider_id', $providerId)->succeeded()
        );
    }

    private function spendByMonth(int $clientId): array
    {
        return $this->monthlyTotals(
            Payment::where('client_id', $clientId)->succeeded()
        );
    }

    private function monthlyTotals($query): array
    {
        $since = CarbonImmutable::now()->startOfMonth()->subMonths(5);

        $rows = (clone $query)
            ->where('paid_at', '>=', $since)
            ->get(['amount', 'paid_at'])
            ->groupBy(fn ($p) => CarbonImmutable::parse($p->paid_at)->format('Y-m'))
            ->map(fn ($group) => round((float) $group->sum('amount'), 2));

        $series = [];

        for ($month = $since; $month->lessThanOrEqualTo(CarbonImmutable::now()); $month = $month->addMonth()) {
            $key = $month->format('Y-m');
            $series[] = [
                'month' => $month->format('M'),
                'key' => $key,
                'total' => $rows[$key] ?? 0,
            ];
        }

        return $series;
    }

    private function bookingsByStatus(int $userId, string $column): array
    {
        $counts = Booking::where($column, $userId)
            ->get(['status'])
            ->countBy(fn ($b) => $b->status->value);

        return collect(BookingStatus::cases())
            ->map(fn (BookingStatus $status) => [
                'status' => $status->value,
                'label' => $status->label(),
                'count' => (int) ($counts[$status->value] ?? 0),
            ])
            ->all();
    }
}
