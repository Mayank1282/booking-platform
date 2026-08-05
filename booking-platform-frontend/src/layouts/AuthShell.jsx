import { Link } from 'react-router-dom'
import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'

/**
 * Asymmetric editorial split: the form sits on the left, an oversized serif
 * pull-quote on a terracotta field fills the right. The panel is hidden below
 * `lg`, so mobile gets the form alone with nothing to scroll past.
 */
export default function AuthShell({ eyebrow, title, subtitle, quote, children, footer }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1fr_minmax(0,32rem)] xl:grid-cols-[1fr_36rem]">
      {/* Editorial panel — desktop only */}
      <aside className="grain relative hidden overflow-hidden bg-accent p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo className="[&_span:last-child]:text-white [&_span:first-child]:bg-white/15" />

        <div className="relative max-w-lg">
          <p className="font-mono text-[0.6875rem] font-medium tracking-[0.16em] uppercase text-white/60">
            {quote?.eyebrow ?? 'Slotwise'}
          </p>
          <blockquote className="mt-5 font-display text-4xl leading-[1.15] font-medium xl:text-5xl">
            {quote?.text ?? 'Booking should feel like a recommendation from a friend, not a form.'}
          </blockquote>
          {quote?.attribution && (
            <p className="mt-6 text-sm text-white/70">{quote.attribution}</p>
          )}
        </div>

        <div className="relative grid grid-cols-3 gap-6 border-t border-white/20 pt-6">
          {[
            ['2.4k', 'Bookings placed'],
            ['180+', 'Providers listed'],
            ['4.8', 'Average rating'],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-white/60">{label}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* Form column */}
      <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-8 lg:order-first lg:px-14 lg:py-10">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-3 text-sm leading-relaxed text-muted">{subtitle}</p>}

            <div className="mt-8">{children}</div>

            {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
          </div>
        </div>

        <p className="text-center text-xs text-muted">
          <Link to="/" className="hover:text-accent">
            ← Back to Slotwise
          </Link>
        </p>
      </div>
    </div>
  )
}
