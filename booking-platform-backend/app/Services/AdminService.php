<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\BookingException;
use App\Mail\BookingCancelled;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AdminService
{
    public function __construct(private readonly PaymentService $payments) {}

    /**
     * Suspends an account. Reversible, and the preferred first response —
     * the user loses access immediately but their history is untouched.
     */
    public function suspend(User $user, ?string $reason = null): User
    {
        $this->assertNotLastAdmin($user, 'suspend');

        $user->update([
            'suspended_at' => now(),
            'suspension_reason' => $reason,
        ]);

        // Revoke every issued token so existing sessions die at once.
        $user->tokens()->delete();

        return $user->fresh();
    }

    public function reinstate(User $user): User
    {
        $user->update([
            'suspended_at' => null,
            'suspension_reason' => null,
        ]);

        return $user->fresh();
    }

    /**
     * Erases an account and releases its email address for re-registration.
     *
     * This anonymises rather than hard-deletes, deliberately. A booking is a
     * financial record shared by two people: dropping the user row would
     * cascade away the counterparty's history and the payment ledger with it.
     * So every personal field is scrubbed, the email is released, the account
     * is locked, and the immutable record of what happened survives.
     *
     * Live commitments are settled first — bookings still ahead are cancelled
     * and settled payments refunded, so erasing a provider never strands a
     * client who has already paid.
     */
    public function eraseUser(User $user, User $actor): array
    {
        $this->assertNotLastAdmin($user, 'erase');

        if ($user->id === $actor->id) {
            throw new BookingException('You cannot erase your own admin account.', 422);
        }

        if ($user->anonymised_at) {
            throw new BookingException('That account has already been erased.', 422);
        }

        return DB::transaction(function () use ($user, $actor) {
            $summary = ['cancelled' => 0, 'refunded' => 0];

            $upcoming = Booking::query()
                ->where(fn ($q) => $q->where('client_id', $user->id)->orWhere('provider_id', $user->id))
                ->whereIn('status', BookingStatus::blocking())
                ->where('starts_at', '>=', now())
                ->with('payment')
                ->get();

            foreach ($upcoming as $booking) {
                $booking->update([
                    'status' => BookingStatus::Cancelled,
                    'cancelled_at' => now(),
                    'cancelled_by' => $actor->id,
                    'cancellation_reason' => 'The account associated with this booking was closed.',
                ]);
                $summary['cancelled']++;

                // Only the counterparty is told. The erased account's address
                // is about to be released, so mail to it would bounce — and
                // they asked for this in the first place.
                $this->notifyCounterparty($booking, $user, $actor);

                if ($booking->payment?->status === PaymentStatus::Succeeded) {
                    $this->payments->refund($booking->payment);
                    $summary['refunded']++;
                }
            }

            // Uploaded files are not referenced by anything else — remove them.
            if ($user->avatar_path) {
                Storage::disk('public')->delete($user->avatar_path);
            }

            foreach ($user->services()->whereNotNull('image_path')->pluck('image_path') as $path) {
                Storage::disk('public')->delete($path);
            }

            $releasedEmail = $user->email;

            // Listings leave the directory but stay attached to their bookings.
            $user->services()->update(['is_active' => false, 'image_path' => null]);
            $user->providerProfile?->update(['is_published' => false]);

            $user->forceFill([
                'name' => 'Deleted user',
                // A reserved, non-routable domain, so the original address is
                // free immediately and this one can never receive mail.
                'email' => "deleted+{$user->id}@slotwise.invalid",
                'password' => Str::random(48),
                'phone' => null,
                'avatar_path' => null,
                'anonymised_at' => now(),
                'suspended_at' => now(),
                'suspension_reason' => 'Account closed.',
            ])->save();

            $user->tokens()->delete();

            return $summary + ['email_released' => $releasedEmail];
        });
    }

    /** Platform-wide figures for the admin overview. */
    public function platformStats(): array
    {
        $succeeded = Payment::query()->where('status', PaymentStatus::Succeeded);

        return [
            'users_total' => User::count(),
            'clients' => User::where('role', 'client')->count(),
            'providers' => User::where('role', 'provider')->count(),
            'suspended' => User::whereNotNull('suspended_at')->count(),
            'new_this_month' => User::where('created_at', '>=', now()->startOfMonth())->count(),

            'services_total' => Service::count(),
            'services_active' => Service::where('is_active', true)->count(),

            // Real bookings only — abandoned holds are not bookings.
            'bookings_total' => Booking::real()->count(),
            'bookings_upcoming' => Booking::whereIn('status', BookingStatus::blocking())
                ->where('starts_at', '>=', now())->count(),

            // Gross merchandise value — the total that has actually settled.
            'gmv' => round((float) (clone $succeeded)->sum('amount'), 2),
            'gmv_this_month' => round((float) (clone $succeeded)
                ->where('paid_at', '>=', now()->startOfMonth())->sum('amount'), 2),
            'refunded_total' => round((float) Payment::where('status', PaymentStatus::Refunded)->sum('amount'), 2),
        ];
    }

    /** Admin accounts must never be able to lock themselves out entirely. */
    /**
     * Tells the other side of a booking that an account closure cancelled it.
     * An outage here must not roll back the erasure — the user asked for it,
     * and it has to complete.
     */
    private function notifyCounterparty(Booking $booking, User $erased, User $actor): void
    {
        $booking->load(['service.provider.providerProfile', 'provider', 'client']);

        $isProvider = $booking->provider_id !== $erased->id;
        $recipient = $isProvider ? $booking->provider : $booking->client;

        if (! $recipient || $recipient->id === $erased->id) {
            return;
        }

        try {
            Mail::to($recipient->email)->send(new BookingCancelled($booking, $actor, forProvider: $isProvider));
        } catch (\Throwable $e) {
            Log::warning('Account-closure cancellation mail failed to send', [
                'booking_id' => $booking->id,
                'to' => $recipient->email,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function assertNotLastAdmin(User $user, string $action): void
    {
        if (! $user->isAdmin()) {
            return;
        }

        $remaining = User::where('role', 'admin')
            ->whereNull('suspended_at')
            ->whereKeyNot($user->id)
            ->count();

        if ($remaining === 0) {
            throw new BookingException("You cannot {$action} the only remaining administrator.", 422);
        }
    }
}
