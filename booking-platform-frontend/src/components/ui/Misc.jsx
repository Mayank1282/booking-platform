import { Star } from 'lucide-react'
import { initials } from '@/lib/format'

/** Star rating. Half-stars are approximated with a clipped overlay. */
export function Rating({ value = 0, count, size = 14, showCount = true, className = '' }) {
  const rating = Number(value) || 0

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = Math.max(0, Math.min(1, rating - star + 1))

          return (
            <span key={star} className="relative inline-block" style={{ width: size, height: size }}>
              <Star size={size} className="absolute inset-0 text-line-strong" />
              {fill > 0 && (
                <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                  <Star size={size} className="text-gold" fill="currentColor" />
                </span>
              )}
            </span>
          )
        })}
      </span>

      <span className="tabular text-xs text-muted">
        {rating > 0 ? rating.toFixed(1) : 'New'}
        {showCount && count > 0 && ` (${count})`}
      </span>
      <span className="sr-only">
        {rating > 0 ? `Rated ${rating.toFixed(1)} out of 5` : 'Not yet rated'}
        {count > 0 && ` from ${count} reviews`}
      </span>
    </span>
  )
}

/** Avatar with a warm initials fallback. */
export function Avatar({ name = '', src, size = 40, className = '' }) {
  return src ? (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`shrink-0 rounded-full border border-line object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent-soft font-medium text-accent-ink ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  )
}

/** Editorial section heading: mono eyebrow above a serif title. */
export function SectionTitle({ eyebrow, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/** Bento stat tile — mono figure, small label, optional trend note. */
export function StatTile({ label, value, note, icon: Icon, tone = 'default' }) {
  const accents = {
    default: 'text-ink',
    accent: 'text-accent',
    sage: 'text-sage',
    gold: 'text-gold',
  }

  return (
    <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {Icon && <Icon size={16} className="shrink-0 text-muted" aria-hidden="true" />}
      </div>
      <p className={`tabular mt-4 text-2xl font-semibold sm:text-[1.75rem] ${accents[tone] ?? accents.default}`}>
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  )
}

/** Pagination bar shared by every paginated list. */
export function Pagination({ meta, onPage, className = '' }) {
  if (!meta || meta.last_page <= 1) return null

  return (
    <div className={`flex items-center justify-between gap-4 border-t border-line pt-4 ${className}`}>
      <p className="tabular text-xs text-muted">
        {meta.from ?? 0}–{meta.to ?? 0} of {meta.total}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(meta.current_page - 1)}
          disabled={meta.current_page <= 1}
          className="h-9 rounded-[var(--radius-inner)] border border-line-strong px-3 text-sm text-ink transition-colors hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-40"
        >
          Previous
        </button>
        <span className="tabular text-xs text-muted">
          {meta.current_page} / {meta.last_page}
        </span>
        <button
          type="button"
          onClick={() => onPage(meta.current_page + 1)}
          disabled={meta.current_page >= meta.last_page}
          className="h-9 rounded-[var(--radius-inner)] border border-line-strong px-3 text-sm text-ink transition-colors hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
