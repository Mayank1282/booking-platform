<?php

namespace App\Http\Controllers\Api;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminUserResource;
use App\Http\Resources\BookingResource;
use App\Http\Resources\PaymentResource;
use App\Http\Resources\ServiceResource;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use App\Services\AdminService;
use App\Traits\ApiResponse;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly AdminService $admin) {}

    /** Platform-wide overview: totals, signup trend and recent activity. */
    public function overview(): JsonResponse
    {
        return $this->ok([
            'stats' => $this->admin->platformStats(),
            'revenue_by_month' => $this->revenueByMonth(),
            'signups_by_month' => $this->signupsByMonth(),
            'bookings_by_status' => $this->bookingsByStatus(),
            'recent_users' => AdminUserResource::collection(
                User::with('providerProfile')->latest()->limit(6)->get()
            )->resolve(),
            'recent_bookings' => BookingResource::collection(
                Booking::with(['service.category', 'client', 'provider', 'payment'])
                    ->latest()->limit(6)->get()
            )->resolve(),
        ]);
    }

    // --- Users ------------------------------------------------------------

    public function users(Request $request): JsonResponse
    {
        $users = User::query()
            ->with('providerProfile')
            ->withCount(['services', 'bookingsAsClient', 'bookingsAsProvider'])
            ->when($request->filled('q'), function ($query) use ($request) {
                $term = $request->string('q')->toString();

                $query->where(function ($q) use ($term) {
                    $q->where('name', 'like', "%{$term}%")
                        ->orWhere('email', 'like', "%{$term}%")
                        ->orWhereHas('providerProfile', fn ($p) => $p->where('business_name', 'like', "%{$term}%"));
                });
            })
            ->when($request->filled('role'), fn ($q) => $q->where('role', $request->string('role')))
            ->when($request->string('status')->toString() === 'suspended', fn ($q) => $q->whereNotNull('suspended_at'))
            ->when($request->string('status')->toString() === 'active', fn ($q) => $q->whereNull('suspended_at'))
            ->latest()
            ->paginate(min((int) $request->integer('per_page', 15), 50))
            ->withQueryString();

        return $this->paginated(AdminUserResource::collection($users));
    }

    public function suspend(Request $request, User $user): JsonResponse
    {
        $request->validate(['reason' => ['nullable', 'string', 'max:200']]);

        $user = $this->admin->suspend($user, $request->input('reason'));

        return $this->ok(new AdminUserResource($user->load('providerProfile')), 'Account suspended.');
    }

    public function reinstate(User $user): JsonResponse
    {
        $user = $this->admin->reinstate($user);

        return $this->ok(new AdminUserResource($user->load('providerProfile')), 'Account reinstated.');
    }

    /**
     * Erases an account and releases its email. See AdminService::eraseUser
     * for why this anonymises rather than hard-deletes.
     */
    public function erase(Request $request, User $user): JsonResponse
    {
        $summary = $this->admin->eraseUser($user, $request->user());

        $message = "Account erased — {$summary['email_released']} is free to register again.";

        if ($summary['cancelled'] > 0) {
            $message .= " {$summary['cancelled']} upcoming booking(s) cancelled";
            $message .= $summary['refunded'] > 0 ? ", {$summary['refunded']} refunded." : '.';
        }

        return $this->ok($summary, $message);
    }

    // --- Moderation -------------------------------------------------------

    public function services(Request $request): JsonResponse
    {
        $services = Service::query()
            ->with(['category', 'provider.providerProfile'])
            ->when($request->filled('q'), fn ($q) => $q->search($request->string('q')->toString()))
            ->when($request->string('status')->toString() === 'active', fn ($q) => $q->where('is_active', true))
            ->when($request->string('status')->toString() === 'hidden', fn ($q) => $q->where('is_active', false))
            ->latest()
            ->paginate(min((int) $request->integer('per_page', 15), 50))
            ->withQueryString();

        return $this->paginated(ServiceResource::collection($services));
    }

    /** Unpublish (or restore) any listing on the platform. */
    public function toggleService(Service $service): JsonResponse
    {
        $service->update(['is_active' => ! $service->is_active]);

        return $this->ok(
            new ServiceResource($service->fresh(['category', 'provider.providerProfile'])),
            $service->is_active ? 'Listing restored.' : 'Listing unpublished.'
        );
    }

    public function bookings(Request $request): JsonResponse
    {
        $bookings = Booking::query()
            ->with(['service.category', 'client', 'provider.providerProfile', 'payment'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('q'), fn ($q) => $q->where('code', 'like', '%'.$request->string('q').'%'))
            ->orderByDesc('starts_at')
            ->paginate(min((int) $request->integer('per_page', 15), 50))
            ->withQueryString();

        return $this->paginated(BookingResource::collection($bookings));
    }

    public function payments(Request $request): JsonResponse
    {
        $payments = Payment::query()
            ->with('booking.service')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->latest()
            ->paginate(min((int) $request->integer('per_page', 15), 50))
            ->withQueryString();

        return $this->paginated(PaymentResource::collection($payments));
    }

    // --- Chart series -----------------------------------------------------

    private function revenueByMonth(): array
    {
        $since = CarbonImmutable::now()->startOfMonth()->subMonths(5);

        $rows = Payment::where('status', PaymentStatus::Succeeded)
            ->where('paid_at', '>=', $since)
            ->get(['amount', 'paid_at'])
            ->groupBy(fn ($p) => CarbonImmutable::parse($p->paid_at)->format('Y-m'))
            ->map(fn ($group) => round((float) $group->sum('amount'), 2));

        return $this->series($since, $rows);
    }

    private function signupsByMonth(): array
    {
        $since = CarbonImmutable::now()->startOfMonth()->subMonths(5);

        $rows = User::where('created_at', '>=', $since)
            ->get(['created_at'])
            ->groupBy(fn ($u) => CarbonImmutable::parse($u->created_at)->format('Y-m'))
            ->map(fn ($group) => $group->count());

        return $this->series($since, $rows);
    }

    /** Fills the gaps so a quiet month renders as zero rather than vanishing. */
    private function series(CarbonImmutable $since, $rows): array
    {
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

    private function bookingsByStatus(): array
    {
        $counts = Booking::get(['status'])->countBy(fn ($b) => $b->status->value);

        return collect(BookingStatus::cases())
            ->map(fn (BookingStatus $status) => [
                'status' => $status->value,
                'label' => $status->label(),
                'count' => (int) ($counts[$status->value] ?? 0),
            ])
            ->all();
    }
}
