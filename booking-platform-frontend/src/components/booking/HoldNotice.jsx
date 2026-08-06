import { useEffect, useState } from 'react'
import { AlertTriangle, Timer } from 'lucide-react'

/*
  An unpaid booking is a *hold*, not a booking. This makes that visible: a
  live countdown of how long the slot stays reserved, and a clear statement
  once it has lapsed.

  Without it, "Awaiting payment" looks like a confirmed appointment that merely
  owes money — which is exactly the confusion that made an unpaid booking feel
  like a real one.
*/
export default function HoldNotice({ booking, className = '' }) {
  const initial = booking?.hold_seconds_remaining ?? null
  const [remaining, setRemaining] = useState(initial)

  useEffect(() => setRemaining(booking?.hold_seconds_remaining ?? null), [booking])

  useEffect(() => {
    if (remaining === null || remaining <= 0) return

    const timer = setInterval(() => setRemaining((s) => (s === null ? null : Math.max(0, s - 1))), 1000)
    return () => clearInterval(timer)
  }, [remaining])

  if (!booking || booking.status !== 'pending') return null

  const lapsed = booking.is_expired_hold || remaining === 0

  if (lapsed) {
    return (
      <div
        className={`flex items-start gap-2.5 rounded-[var(--radius-inner)] border border-line bg-surface-sunk px-3.5 py-3 text-sm text-ink-soft ${className}`}
      >
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
        <span>
          <span className="block font-medium text-ink">This reservation has expired</span>
          The slot was released and is bookable again. Nothing was charged.
        </span>
      </div>
    )
  }

  const minutes = Math.floor((remaining ?? 0) / 60)
  const seconds = String((remaining ?? 0) % 60).padStart(2, '0')

  return (
    <div
      className={`flex items-start gap-2.5 rounded-[var(--radius-inner)] border border-gold/25 bg-gold-soft px-3.5 py-3 text-sm text-gold ${className}`}
    >
      <Timer size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="block font-medium">
          Slot held for <span className="tabular">{minutes}:{seconds}</span>
        </span>
        This is not confirmed yet. Complete the payment to secure the booking — otherwise the time
        is released for someone else.
      </span>
    </div>
  )
}
