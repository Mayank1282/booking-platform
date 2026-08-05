<?php

namespace App\Services;

use App\Models\AvailabilityBlock;
use App\Models\Booking;
use App\Models\Service;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Turns a provider's weekly rules, one-off blocks and existing bookings into a
 * concrete list of bookable start times for a given service on a given day.
 */
class AvailabilityService
{
    /**
     * @return array<int, array{starts_at: string, ends_at: string, label: string, available: bool, reason: string|null}>
     */
    public function slotsFor(Service $service, CarbonImmutable $date): array
    {
        $date = $date->startOfDay();

        if ($this->isOutsideBookingHorizon($date)) {
            return [];
        }

        $windows = $this->workingWindowsFor($service, $date);

        if ($windows->isEmpty()) {
            return [];
        }

        $blocks = $this->blocksFor($service->provider_id, $date);
        $booked = $this->bookedRangesFor($service->provider_id, $date);

        $interval = (int) config('booking.slot_interval');
        $blockMinutes = $service->totalBlockMinutes();
        $earliest = CarbonImmutable::now()->addMinutes((int) config('booking.min_notice_minutes'));

        $slots = [];

        foreach ($windows as [$windowStart, $windowEnd]) {
            $cursor = $windowStart;

            while ($cursor->addMinutes($blockMinutes)->lessThanOrEqualTo($windowEnd)) {
                $slotStart = $cursor;
                // The client-facing end time excludes the buffer; the buffer is
                // private padding the provider keeps between appointments.
                $slotEnd = $slotStart->addMinutes($service->duration_minutes);
                $reservedUntil = $slotStart->addMinutes($blockMinutes);

                $reason = match (true) {
                    $slotStart->lessThan($earliest) => 'too_soon',
                    $this->intersects($slotStart, $reservedUntil, $blocks) => 'blocked',
                    $this->intersects($slotStart, $reservedUntil, $booked) => 'booked',
                    default => null,
                };

                $slots[] = [
                    'starts_at' => $slotStart->toIso8601String(),
                    'ends_at' => $slotEnd->toIso8601String(),
                    'label' => $slotStart->format('g:i A'),
                    'available' => $reason === null,
                    'reason' => $reason,
                ];

                $cursor = $cursor->addMinutes($interval);
            }
        }

        return $slots;
    }

    /**
     * Re-checks a specific slot at booking time. Slot lists can go stale between
     * the client loading the page and pressing confirm, so this runs again
     * inside the booking transaction.
     */
    public function isSlotBookable(Service $service, CarbonImmutable $startsAt, ?int $ignoreBookingId = null): bool
    {
        if ($this->isOutsideBookingHorizon($startsAt->startOfDay())) {
            return false;
        }

        if ($startsAt->lessThan(CarbonImmutable::now()->addMinutes((int) config('booking.min_notice_minutes')))) {
            return false;
        }

        $reservedUntil = $startsAt->addMinutes($service->totalBlockMinutes());

        $withinWindow = $this->workingWindowsFor($service, $startsAt->startOfDay())
            ->contains(fn (array $w) => $startsAt->greaterThanOrEqualTo($w[0]) && $reservedUntil->lessThanOrEqualTo($w[1]));

        if (! $withinWindow) {
            return false;
        }

        if ($this->intersects($startsAt, $reservedUntil, $this->blocksFor($service->provider_id, $startsAt->startOfDay()))) {
            return false;
        }

        $conflicts = Booking::query()
            ->where('provider_id', $service->provider_id)
            ->blocking()
            ->overlapping($startsAt, $reservedUntil)
            ->when($ignoreBookingId, fn ($q) => $q->whereKeyNot($ignoreBookingId))
            ->exists();

        return ! $conflicts;
    }

    /**
     * Bookable days across a month, for calendar rendering.
     *
     * @return array<string, bool> keyed by Y-m-d
     */
    public function monthOverview(Service $service, int $year, int $month): array
    {
        $start = CarbonImmutable::create($year, $month, 1)->startOfDay();
        $days = [];

        for ($day = $start; $day->month === $start->month; $day = $day->addDay()) {
            $days[$day->toDateString()] = collect($this->slotsFor($service, $day))
                ->contains(fn (array $slot) => $slot['available']);
        }

        return $days;
    }

    // --- Internals --------------------------------------------------------

    /**
     * @return Collection<int, array{0: CarbonImmutable, 1: CarbonImmutable}>
     */
    private function workingWindowsFor(Service $service, CarbonImmutable $date): Collection
    {
        return $service->provider
            ->availabilityRules()
            ->active()
            ->where('day_of_week', $date->dayOfWeek)
            ->orderBy('start_time')
            ->get()
            ->map(fn ($rule) => [
                $this->applyTime($date, $rule->startTimeShort()),
                $this->applyTime($date, $rule->endTimeShort()),
            ])
            ->filter(fn (array $w) => $w[1]->greaterThan($w[0]))
            ->values();
    }

    /**
     * @return Collection<int, array{0: CarbonImmutable, 1: CarbonImmutable}>
     */
    private function blocksFor(int $providerId, CarbonImmutable $date): Collection
    {
        $dayStart = $date->startOfDay();
        $dayEnd = $date->endOfDay();

        return AvailabilityBlock::query()
            ->where('provider_id', $providerId)
            ->where('starts_at', '<', $dayEnd)
            ->where('ends_at', '>', $dayStart)
            ->get()
            ->map(fn ($block) => [
                CarbonImmutable::parse($block->starts_at),
                CarbonImmutable::parse($block->ends_at),
            ]);
    }

    /**
     * @return Collection<int, array{0: CarbonImmutable, 1: CarbonImmutable}>
     */
    private function bookedRangesFor(int $providerId, CarbonImmutable $date): Collection
    {
        $dayStart = $date->startOfDay();
        $dayEnd = $date->endOfDay();

        return Booking::query()
            ->with('service:id,buffer_minutes')
            ->where('provider_id', $providerId)
            ->blocking()
            ->where('starts_at', '<', $dayEnd)
            ->where('ends_at', '>', $dayStart)
            ->get()
            ->map(fn (Booking $booking) => [
                CarbonImmutable::parse($booking->starts_at),
                // Extend by the buffer so back-to-back bookings keep their gap.
                CarbonImmutable::parse($booking->ends_at)
                    ->addMinutes($booking->service?->buffer_minutes ?? 0),
            ]);
    }

    private function applyTime(CarbonImmutable $date, string $time): CarbonImmutable
    {
        [$hour, $minute] = array_map('intval', explode(':', $time));

        return $date->setTime($hour, $minute);
    }

    /**
     * @param  Collection<int, array{0: CarbonImmutable, 1: CarbonImmutable}>  $ranges
     */
    private function intersects(CarbonImmutable $start, CarbonImmutable $end, Collection $ranges): bool
    {
        return $ranges->contains(fn (array $range) => $start->lessThan($range[1]) && $end->greaterThan($range[0]));
    }

    private function isOutsideBookingHorizon(CarbonImmutable $date): bool
    {
        $today = CarbonImmutable::now()->startOfDay();
        $horizon = $today->addDays((int) config('booking.max_advance_days'));

        return $date->lessThan($today) || $date->greaterThan($horizon);
    }
}
