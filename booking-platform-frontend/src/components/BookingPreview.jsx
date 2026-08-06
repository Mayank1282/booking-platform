import { useEffect, useMemo, useState } from 'react'
import { Check, Clock } from 'lucide-react'

/*
  ============================================================================
  BookingPreview — the hero artwork
  ----------------------------------------------------------------------------
  Earlier attempts were abstract: a sculpture, then a colour field, then a grid
  of tiles that read as brickwork. All of them looked like *something*, but none
  of them looked like this product.

  So this is the product. A miniature of the real booking panel — day strip,
  time slots, a live confirmation — tilted in 3D and animating as slots get
  taken. It is recognisably a booking interface at a glance, because it is one.

  Deliberately CSS 3D rather than WebGL: the content is type and UI, and real
  DOM text stays crisp at any zoom, scales to any screen, inherits the theme
  tokens for free, and costs nothing to render.
  ============================================================================
*/

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/*
  Shown when the catalogue has not loaded (or is empty), so the hero is never
  blank on a first paint or an API failure.
*/
export const FALLBACK_BOOKINGS = [
  { title: 'Deep Tissue Massage', provider: 'Stillpoint Wellness Studio', price: '₹2,400' },
  { title: 'Signature Haircut & Style', provider: 'The Cutting Room', price: '₹1,500' },
  { title: '1:1 Strength Session', provider: 'Groundwork Strength', price: '₹1,800' },
  { title: 'Portrait Session', provider: 'Sheikh & Frame', price: '₹6,500' },
]

const SLOTS = [
  '9:00 AM',
  '9:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '2:00 PM',
  '2:30 PM',
  '3:00 PM',
  '3:30 PM',
  '4:00 PM',
  '4:30 PM',
]

// Slots already taken when the loop starts.
const INITIALLY_BOOKED = new Set([1, 4, 5, 9])

// The order the remaining ones fill in, one step at a time.
const FILL_ORDER = [2, 7, 10, 0, 6, 11, 3, 8]

export default function BookingPreview({ bookings, className = '' }) {
  const reduced = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const items = bookings?.length ? bookings.slice(0, 4) : FALLBACK_BOOKINGS

  // Which of the four bookings is on screen, and the card animating away.
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(null)

  // Which way the cards travel, so a card always leaves on the side it was
  // pushed toward rather than always sliding left.
  const [direction, setDirection] = useState('next')

  // Bumping this restarts the auto-advance timer, so a booking the visitor
  // chose gets a full interval rather than being snatched away a moment later.
  const [tick, setTick] = useState(0)

  // Live pointer drag: { startX, dx } while held, null otherwise.
  const [drag, setDrag] = useState(null)
  const dragging = drag !== null

  // How many of FILL_ORDER have been taken so far.
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState(7)

  useEffect(() => {
    if (reduced) return

    const timer = setInterval(() => {
      setStep((current) => {
        const next = current + 1
        // Reset once the board fills, so the loop never dead-ends full.
        return next > FILL_ORDER.length ? 0 : next
      })
    }, 1600)

    return () => clearInterval(timer)
  }, [reduced])

  useEffect(() => {
    // Held cards do not advance underneath the cursor.
    if (reduced || items.length < 2 || dragging) return

    const timer = setInterval(() => {
      setDirection('next')
      setIndex((current) => {
        setLeaving(current)
        // Each booking starts from a different fill state, so the panels are
        // visibly distinct rather than the same board with a new title.
        setStep(0)
        return (current + 1) % items.length
      })
    }, 5000)

    return () => clearInterval(timer)
  }, [reduced, items.length, tick, dragging])

  const goTo = (next, dir = 'next') => {
    if (next === index) return

    setDirection(dir)
    setLeaving(index)
    setStep(0)
    setIndex(next)
    setTick((t) => t + 1)
  }

  const advance = (dir) => {
    const offset = dir === 'prev' ? -1 : 1
    goTo((index + offset + items.length) % items.length, dir)
  }

  /*
    Pointer drag. The card follows the cursor while held, and a drag past a
    threshold commits to the next or previous booking; anything shorter springs
    back. Pointer events cover mouse, touch and pen in one path.
  */
  const onPointerDown = (event) => {
    if (items.length < 2 || event.button > 0) return

    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag({ startX: event.clientX, dx: 0 })
  }

  const onPointerMove = (event) => {
    if (!drag) return
    setDrag((current) => ({ ...current, dx: event.clientX - current.startX }))
  }

  const onPointerUp = () => {
    if (!drag) return

    const THRESHOLD = 60

    if (drag.dx <= -THRESHOLD) advance('next')
    else if (drag.dx >= THRESHOLD) advance('prev')

    setDrag(null)
  }

  // Clear the outgoing card once its animation has finished.
  useEffect(() => {
    if (leaving === null) return

    const timer = setTimeout(() => setLeaving(null), 700)
    return () => clearTimeout(timer)
  }, [leaving])

  // Keep the highlighted slot on something still free.
  useEffect(() => {
    const taken = new Set([...INITIALLY_BOOKED, ...FILL_ORDER.slice(0, step)])
    if (taken.has(selected)) {
      const free = SLOTS.map((_, i) => i).find((i) => !taken.has(i))
      if (free !== undefined) setSelected(free)
    }
  }, [step, selected])

  const bookedNow = useMemo(
    () => new Set([...INITIALLY_BOOKED, ...FILL_ORDER.slice(0, step)]),
    [step],
  )

  const active = items[index]

  return (
    /*
      A column rather than absolute positioning, so the gap between the card
      and its dots is real spacing that cannot collapse or overlap at any size.
    */
    <div
      className={`flex flex-col items-center justify-center gap-7 ${className}`}
      style={{ perspective: '1400px' }}
    >
      <div
        className={`relative flex w-full flex-1 touch-pan-y items-center justify-center select-none ${
          items.length > 1 ? (drag ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* The outgoing card, leaving on whichever side it was pushed. */}
        {leaving !== null && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`w-full max-w-[23.5rem] ${
                direction === 'prev' ? 'animate-card-out-right' : 'animate-card-out'
              }`}
            >
              <PreviewCard booking={items[leaving]} bookedNow={bookedNow} selected={selected} />
            </div>
          </div>
        )}

        {/* The incoming card. Keying on the index restarts its entry animation.
            While dragging, the animation is dropped so the card can track the
            cursor directly instead of fighting a running keyframe. */}
        <div
          key={index}
          className={
            drag
              ? 'w-full max-w-[23.5rem]'
              : `w-full max-w-[23.5rem] ${
                  direction === 'prev' ? 'animate-card-in-left' : 'animate-card-in'
                }`
          }
          style={{
            transform: `rotateY(-14deg) rotateX(7deg) rotateZ(1.5deg) translateX(${
              drag ? drag.dx * 0.55 : 0
            }px)`,
            transition: drag ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          aria-hidden="true"
        >
          <PreviewCard booking={active} bookedNow={bookedNow} selected={selected} step={step} />
        </div>
      </div>

      {/* Jump straight to a booking. Real buttons with labels, so this is
          reachable by keyboard and screen reader rather than decoration. */}
      {items.length > 1 && (
        <div className="flex shrink-0 gap-2" role="tablist" aria-label="Featured bookings">
          {items.map((item, i) => (
            <button
              key={item.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show ${item.title}`}
              onClick={() => goTo(i, i > index ? 'next' : 'prev')}
              // Generous hit area around a small visual mark.
              className="group flex h-6 items-center px-0.5"
            >
              <span
                className={`block h-1 rounded-full transition-all duration-500 ${
                  i === index
                    ? 'w-6 bg-accent'
                    : 'w-2 bg-line-strong group-hover:w-4 group-hover:bg-muted'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** One booking panel. Extracted so the outgoing and incoming cards share it. */
function PreviewCard({ booking, bookedNow, selected, step }) {
  return (
    <div className="overflow-hidden rounded-[0.875rem] border border-line bg-surface shadow-[0_40px_80px_-32px_rgb(23_21_15_/_0.45)]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-[0.9375rem] font-medium text-ink">{booking.title}</p>
          <p className="mt-1 truncate text-[0.75rem] text-muted">{booking.provider}</p>
        </div>
        <span className="tabular shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[0.75rem] font-medium text-accent-ink">
          {booking.price}
        </span>
      </div>

      <div className="flex gap-1 border-b border-line px-4 py-3">
        {DAYS.map((day, i) => (
          <div
            key={day}
            className={`flex-1 rounded-md py-2 text-center text-[0.6875rem] font-medium transition-colors ${
              i === 2 ? 'bg-ink text-canvas' : 'text-muted'
            }`}
          >
            {day.slice(0, 1)}
            <span className="tabular mt-0.5 block text-[0.8125rem]">{10 + i}</span>
          </div>
        ))}
      </div>

      <div className="px-4 py-4">
        <p className="eyebrow mb-2 flex items-center gap-1.5">
          <Clock size={10} aria-hidden="true" />
          Available times
        </p>

        <div className="grid grid-cols-3 gap-2">
          {SLOTS.map((slot, i) => {
            const isBooked = bookedNow.has(i)
            const isSelected = !isBooked && i === selected

            return (
              <div
                key={slot}
                className={[
                  'tabular rounded-md border py-2 text-center text-[0.75rem] transition-all duration-500',
                  isBooked
                    ? 'border-transparent bg-surface-sunk text-muted/45 line-through'
                    : isSelected
                      ? 'border-accent bg-accent text-white shadow-sm'
                      : 'border-line-strong text-ink',
                ].join(' ')}
              >
                {slot}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-2.5 border-t border-line bg-sage-soft px-5 py-3">
        <span className="flex size-5 items-center justify-center rounded-full bg-sage text-white">
          <Check size={10} strokeWidth={3} aria-hidden="true" />
        </span>
        <p className="text-[0.75rem] text-sage">
          Confirmed · <span className="tabular">BKG-000{842 + step}</span>
        </p>
      </div>
    </div>
  )
}
