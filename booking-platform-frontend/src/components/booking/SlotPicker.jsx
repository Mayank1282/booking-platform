import { useEffect, useMemo, useState } from 'react'
import { isSameDay, startOfDay } from 'date-fns'
import { CalendarX2, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { dateLong, isoDay } from '@/lib/format'
import AvailabilityCalendar from './AvailabilityCalendar'

// Must match config('booking.max_advance_days') on the backend.
const HORIZON_DAYS = 60

/**
 * Date rail + slot grid. Availability is fetched per day from the backend,
 * which is the only thing that knows about working hours, buffers, blocked
 * dates and slots other people have already taken.
 */
export default function SlotPicker({ serviceSlug, value, onChange }) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [selectedDay, setSelectedDay] = useState(today)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .get(`/services/${serviceSlug}/availability`, { params: { date: isoDay(selectedDay) } })
      .then(({ data }) => !cancelled && setSlots(data.data.slots))
      .catch(() => !cancelled && setError('Could not load times for that day.'))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [serviceSlug, selectedDay])

  // Changing day invalidates whatever slot was picked on the previous one.
  useEffect(() => {
    if (value && !isSameDay(new Date(value), selectedDay)) onChange(null)
  }, [selectedDay, value, onChange])

  const available = slots.filter((slot) => slot.available)

  return (
    <div className="space-y-4">
      <AvailabilityCalendar
        serviceSlug={serviceSlug}
        value={selectedDay}
        onChange={setSelectedDay}
        horizonDays={HORIZON_DAYS}
      />

      {/* Slot grid */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow">Pick a time</p>
            {/* Naming the chosen day keeps the times unambiguous once the
                calendar has scrolled to another month. */}
            <p className="tabular mt-0.5 text-xs text-ink-soft">{dateLong(selectedDay)}</p>
          </div>
          {!loading && !error && (
            <p className="tabular text-xs text-muted">
              {available.length} slot{available.length === 1 ? '' : 's'} open
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-[var(--radius-inner)] border border-line bg-surface-sunk py-10 text-sm text-muted">
            <Loader2 size={15} className="animate-spin text-accent" />
            Checking availability…
          </div>
        ) : error ? (
          <p className="rounded-[var(--radius-inner)] border border-rose/25 bg-rose-soft px-3 py-4 text-center text-sm text-rose">
            {error}
          </p>
        ) : available.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius-inner)] border border-line bg-surface-sunk py-10 text-center">
            <CalendarX2 size={20} className="text-muted" aria-hidden="true" />
            <p className="text-sm text-muted">Nothing free on this day. Try another date.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {available.map((slot) => {
              const selected = value === slot.starts_at

              return (
                <button
                  key={slot.starts_at}
                  type="button"
                  onClick={() => onChange(slot.starts_at)}
                  aria-pressed={selected}
                  className={[
                    'tabular min-h-11 rounded-[var(--radius-inner)] border px-2 text-sm transition-colors',
                    selected
                      ? 'border-accent bg-accent text-white'
                      : 'border-line-strong bg-surface text-ink hover:border-accent hover:text-accent',
                  ].join(' ')}
                >
                  {slot.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
