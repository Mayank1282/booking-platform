<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\Service;
use App\Services\BookingService;
use App\Services\PaymentService;
use App\Traits\ApiResponse;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BookingController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly BookingService $bookings,
        private readonly PaymentService $payments,
    ) {}

    /**
     * Bookings for the signed-in user — as client or as provider, depending on
     * which role they hold.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = $user->isProvider()
            ? $user->bookingsAsProvider()
            : $user->bookingsAsClient();

        $bookings = $query
            ->with(['service.category', 'client', 'provider.providerProfile', 'payment', 'review', 'canceller:id,name'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->string('range')->toString() === 'upcoming', fn ($q) => $q->upcoming())
            ->when($request->string('range')->toString() === 'past', fn ($q) => $q->past())
            ->orderByDesc('starts_at')
            ->paginate(min((int) $request->integer('per_page', 10), 50));

        return $this->paginated(BookingResource::collection($bookings));
    }

    public function show(Request $request, Booking $booking): JsonResponse
    {
        $this->authorizeParticipant($request, $booking);

        return $this->ok(new BookingResource(
            $booking->load(['service.category', 'client', 'provider.providerProfile', 'payment', 'review', 'canceller:id,name'])
        ));
    }

    public function store(StoreBookingRequest $request): JsonResponse
    {
        $service = Service::with('provider')->findOrFail($request->integer('service_id'));

        $booking = $this->bookings->create(
            $request->user(),
            $service,
            CarbonImmutable::parse($request->string('starts_at')),
            $request->input('notes'),
        );

        return $this->created(
            new BookingResource($booking->load(['service.category', 'client', 'provider.providerProfile', 'payment'])),
            'Booking placed. Complete the payment to confirm it.'
        );
    }

    /** Provider accepts a pending booking without waiting for payment. */
    public function confirm(Request $request, Booking $booking): JsonResponse
    {
        abort_unless($booking->provider_id === $request->user()->id, 403, 'Only the provider can confirm this booking.');

        $booking = $this->bookings->confirm($booking);

        return $this->ok(
            new BookingResource($booking->load(['service.category', 'client', 'provider', 'payment', 'canceller:id,name'])),
            'Booking confirmed.'
        );
    }

    public function complete(Request $request, Booking $booking): JsonResponse
    {
        abort_unless($booking->provider_id === $request->user()->id, 403, 'Only the provider can complete this booking.');

        $booking = $this->bookings->complete($booking);

        return $this->ok(
            new BookingResource($booking->load(['service.category', 'client', 'provider', 'payment', 'canceller:id,name'])),
            'Booking marked as completed.'
        );
    }

    /**
     * Either party may cancel. A settled payment is refunded automatically so
     * a cancelled booking never leaves the client out of pocket.
     */
    public function cancel(Request $request, Booking $booking): JsonResponse
    {
        $this->authorizeParticipant($request, $booking);

        $request->validate(['reason' => ['nullable', 'string', 'max:300']]);

        /*
         * Cancelling and refunding must succeed or fail together.
         *
         * They used to run in sequence: the booking was cancelled, then the
         * refund attempted. When the gateway rejected the refund, the
         * cancellation had already been committed — leaving a booking marked
         * Cancelled with the client's money still taken. The client loses both
         * the appointment and the payment, and nothing in the system flags it.
         *
         * The transaction rolls the cancellation back if the money cannot be
         * returned, so the booking stays live and the client can retry rather
         * than being quietly left out of pocket.
         */
        $booking = DB::transaction(function () use ($booking, $request) {
            $booking = $this->bookings->cancel($booking, $request->user(), $request->input('reason'));

            $payment = $booking->payment;

            if ($payment) {
                if ($payment->status === PaymentStatus::Succeeded) {
                    // Money actually changed hands — give it back. A failure
                    // here throws, and the cancellation above is undone.
                    $this->payments->refund($payment);
                } else {
                    // Nothing was charged. Void the open intent so it cannot be
                    // paid later, and stop the record sitting at "pending" forever.
                    $this->payments->voidUnpaidIntent($payment);
                }
            }

            return $booking;
        });

        return $this->ok(
            new BookingResource($booking->fresh(['service.category', 'client', 'provider', 'payment', 'canceller:id,name'])),
            'Booking cancelled.'
        );
    }

    private function authorizeParticipant(Request $request, Booking $booking): void
    {
        $userId = $request->user()->id;

        abort_unless(
            $booking->client_id === $userId || $booking->provider_id === $userId,
            403,
            'This booking does not belong to you.'
        );
    }
}
