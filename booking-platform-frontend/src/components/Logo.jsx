import { Link } from 'react-router-dom'

/**
 * The mark is a clock face drawn as a filled quadrant — a booked slot. Set in
 * the display serif so the brand carries the same editorial voice as headings.
 */
export default function Logo({ to = '/', className = '' }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Slotwise home">
      <span className="flex size-8 items-center justify-center rounded-[var(--radius-inner)] bg-accent text-white">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 12V5a7 7 0 0 1 7 7h-7Z" fill="currentColor" />
        </svg>
      </span>
      <span className="font-display text-xl font-semibold tracking-tight text-ink">Slotwise</span>
    </Link>
  )
}
