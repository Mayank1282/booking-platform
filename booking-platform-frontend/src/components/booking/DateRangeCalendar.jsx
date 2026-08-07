import { useMemo, useState } from 'react'
import {
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
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { isoDay } from '@/lib/format'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * Month calendar for picking a range of days, drawn with the same grammar as
 * the booking calendar so time off is chosen the way an appointment is.
 *
 * The first tap sets the start, the second the end; tapping again starts over.
 * Days already covered by an existing block are marked so a provider does not
 * block the same week twice.
 */
export default function DateRangeCalendar({ start, end, onChange, blockedDays = new Set() }) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [cursor, setCursor] = useState(() => startOfMonth(start ?? today))
  // Previewed while the range is half-picked, so dragging the pointer across
  // the grid shows what the second tap would select.
  const [hovered, setHovered] = useState(null)

  const grid = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(cursor)),
        end: endOfWeek(endOfMonth(cursor)),
      }),
    [cursor],
  )

  const canGoBack = isAfter(startOfMonth(cursor), startOfMonth(today))

  // While only the start is set, the hovered day stands in for the end.
  const provisionalEnd = end ?? (start && hovered && !isBefore(hovered, start) ? hovered : null)

  const inRange = (day) =>
    start && provisionalEnd && !isBefore(day, start) && !isAfter(day, provisionalEnd)

  const choose = (day) => {
    // A complete range, or a second tap before the start, begins a new one.
    if (!start || end || isBefore(day, start)) {
      onChange(day, null)
      return
    }

    onChange(start, day)
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{format(cursor, 'MMMM yyyy')}</p>
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
            aria-label="Next month"
            className="flex size-8 items-center justify-center rounded-[var(--radius-inner)] border border-line text-ink-soft transition-colors hover:border-accent hover:text-accent"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" onPointerLeave={() => setHovered(null)}>
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
          const past = isBefore(day, today)
          const disabled = !inMonth || past

          const isStart = start && isSameDay(day, start)
          const isEnd = provisionalEnd && isSameDay(day, provisionalEnd)
          const isEdge = isStart || isEnd
          const covered = !isEdge && inRange(day)
          const alreadyBlocked = blockedDays.has(key)

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => choose(day)}
              onPointerEnter={() => !disabled && setHovered(day)}
              aria-label={format(day, 'EEEE d MMMM yyyy')}
              aria-pressed={Boolean(isEdge || covered)}
              aria-current={isToday(day) ? 'date' : undefined}
              className={[
                'tabular relative flex h-9 items-center justify-center rounded-[var(--radius-inner)] text-sm transition-colors',
                isEdge
                  ? 'bg-accent font-semibold text-white'
                  : covered
                    ? 'bg-accent-soft text-accent-ink'
                    : disabled
                      ? 'cursor-not-allowed text-muted/35'
                      : 'text-ink hover:bg-accent-soft hover:text-accent-ink',
                !isEdge && isToday(day) && !disabled ? 'ring-1 ring-accent/40' : '',
              ].join(' ')}
            >
              {inMonth ? format(day, 'd') : ''}

              {/* Marks a day an existing block already covers. */}
              {inMonth && !past && !isEdge && alreadyBlocked && (
                <span className="absolute bottom-1 size-1 rounded-full bg-rose" aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-2.5 text-[0.6875rem] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
          Selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-rose" aria-hidden="true" />
          Already blocked
        </span>
      </div>
    </div>
  )
}
