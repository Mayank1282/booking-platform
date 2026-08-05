import { AlertTriangle, Loader2 } from 'lucide-react'
import Button from './Button'

/** Skeleton block — warm sunk surface, never a grey pulse. */
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-[var(--radius-inner)] bg-surface-sunk ${className}`} />
}

export function LoadingState({ label = 'Loading', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 text-muted ${className}`} role="status">
      <Loader2 size={22} className="animate-spin text-accent" aria-hidden="true" />
      <p className="text-sm">{label}…</p>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      {Icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-line bg-surface-sunk text-muted">
          <Icon size={20} aria-hidden="true" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'That did not load', message, onRetry, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`} role="alert">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-rose/25 bg-rose-soft text-rose">
        <AlertTriangle size={20} aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
