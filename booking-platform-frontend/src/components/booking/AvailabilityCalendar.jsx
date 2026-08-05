import { useEffect, useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { isoDay } from '@/lib/format'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * Month calendar for picking a booking date.
 *
 * The backend reports, per day, whether that day has at least one bookable
 * slot — so days the provider does not work, has blocked, or has fully booked
 * are visibly dead rather than something you discover by clicking. That check
 * is the whole point of using a calendar here instead of a plain date input.
 */
export default function AvailabilityCalendar({ serviceSlug, value, onChange, horizonDays = 60 }) {
  const today = useMemo(() => startOfDay(new Date()), [])
  // The furthest date the backend will accept a booking for.
  const horizon = useMemo(() => addDays(today, horizonDays), [today, horizonDays])

  const [cursor, setCursor] = useState(() => startOfMonth(value ? new Date(value) : today))
  const [days, setDays] = useState({})
  const [loading, setLoading] = useState(true)

  // Fetch availability for the visible month.
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    api
      .get(`/services/${serviceSlug}/availability/month`, {
        params: { year: cursor.getFullYear(), month: cursor.getMonth() + 1 },
      })
      .then(({ data }) => !cancelled && setDays(data.data.days))
      .catch(() => !cancelled && setDays({}))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [serviceSlug, cursor])

  // A full 6-week grid so the calendar does not change height between months.
  const grid = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(cursor)),
        end: endOfWeek(endOfMonth(cursor)),
      }),
    [cursor],
  )

  const canGoBack = isAfter(startOfMonth(cursor), startOfMonth(today))
  const canGoForward = isBefore(startOfMonth(cursor), startOfMonth(horizon))

  const selected = value ? startOfDay(new Date(value)) : null

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">Pick a date</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor(addMonths(cursor, -1))}
            disabled={!canGoBack}
            aria-label="Previous month"
            className="flex size-8 items-center justify-center rounded-[var(--radius-inner)] border border-line text-ink-soft transition-colors hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => setCursor(addMonths(cursor, 1))}
            disabled={!canGoForward}
            aria-label="Next month"
            className="flex size-8 items-center justify-center rounded-[var(--radius-inner)] border border-line text-ink-soft transition-colors hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-sm font-medium text-ink">{format(cursor, 'MMMM yyyy')}</p>
          {loading && <Loader2 size={13} className="animate-spin text-accent" aria-hidden="true" />}
        </div>

        <div className="grid grid-cols-7 gap-1" role="grid">
          {WEEKDAYS.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="flex h-7 items-center justify-center text-[0.625rem] font-medium tracking-wide text-muted uppercase"
              aria-hidden="true"
            >
              {label}
            </div>
          ))}

          {grid.map((day) => {
            const key = isoDay(day)
            const inMonth = isSameMonth(day, cursor)
            const outOfRange = isBefore(day, today) || isAfter(day, horizon)
            // Unknown (still loading) is treated as available so the grid does
            // not flash every day as disabled on each month change.
            const hasSlots = days[key] ?? true
            const disabled = !inMonth || outOfRange || (!loading && !hasSlots)
            const isSelected = selected && isSameDay(day, selected)

            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => onChange(day)}
                aria-label={format(day, 'EEEE d MMMM yyyy')}
                aria-pressed={Boolean(isSelected)}
                aria-current={isToday(day) ? 'date' : undefined}
                className={[
                  'tabular relative flex h-9 items-center justify-center rounded-[var(--radius-inner)] text-sm transition-colors',
                  isSelected
                    ? 'bg-accent font-semibold text-white'
                    : disabled
                      ? 'cursor-not-allowed text-muted/35'
                      : 'text-ink hover:bg-accent-soft hover:text-accent-ink',
                  !isSelected && isToday(day) && !disabled ? 'ring-1 ring-accent/40' : '',
                ].join(' ')}
              >
                {inMonth ? format(day, 'd') : ''}

                {/* A dot marks a day with open slots, so availability is
                    readable at a glance without opening each one. */}
                {inMonth && !outOfRange && !isSelected && hasSlots && !loading && (
                  <span
                    className="absolute bottom-1 size-1 rounded-full bg-sage"
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex items-center gap-3 border-t border-line pt-2.5 text-[0.6875rem] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-sage" aria-hidden="true" />
            Slots open
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-line-strong" aria-hidden="true" />
            Fully booked or closed
          </span>
        </div>
      </div>
    </div>
  )
}
