import { Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

/*
  Buttons in this system are flat — solid terracotta for primary, hairline
  outline for secondary. No gradients, no heavy shadows. Every variant meets
  the 44px minimum touch target at `md` and above.
*/
const variants = {
  primary:
    'bg-accent text-white hover:bg-accent-hover border border-transparent shadow-none',
  secondary:
    'bg-surface text-ink border border-line-strong hover:border-accent hover:text-accent',
  ghost: 'bg-transparent text-ink-soft border border-transparent hover:bg-surface-sunk hover:text-ink',
  soft: 'bg-accent-soft text-accent-ink border border-transparent hover:bg-accent hover:text-white',
  danger: 'bg-transparent text-rose border border-rose/40 hover:bg-rose hover:text-white',
}

const sizes = {
  sm: 'h-9 px-3 text-[0.8125rem] gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[0.9375rem] gap-2',
}

export default function Button({
  as,
  to,
  href,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  className = '',
  children,
  ...props
}) {
  const classes = [
    'inline-flex items-center justify-center rounded-[var(--radius-inner)] font-medium',
    'transition-colors duration-150 select-none',
    'disabled:opacity-50 disabled:pointer-events-none',
    variants[variant] ?? variants.primary,
    sizes[size] ?? sizes.md,
    className,
  ].join(' ')

  const content = (
    <>
      {loading ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon size={16} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight size={16} aria-hidden="true" />}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {content}
      </a>
    )
  }

  const Component = as ?? 'button'

  return (
    <Component
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </Component>
  )
}
