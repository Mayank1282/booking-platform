/*
  The core surface of the design system: a hairline-bordered panel with a
  large radius. Elevation is opt-in and deliberately subtle — structure comes
  from the border, not a shadow.
*/
export default function Card({ as: Component = 'div', className = '', hover = false, children, ...props }) {
  return (
    <Component
      className={[
        'rounded-[var(--radius-card)] border border-line bg-surface',
        hover && 'transition-all duration-150 hover:border-line-strong hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </Component>
  )
}

/** Header row with an eyebrow label and optional trailing action. */
export function CardHeader({ eyebrow, title, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 border-b border-line px-5 py-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        {title && <h2 className="truncate text-lg font-semibold text-ink">{title}</h2>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
