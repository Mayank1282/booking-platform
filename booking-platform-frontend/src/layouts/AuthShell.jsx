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
      {/* Editorial panel — desktop only. Sculptural 3D on a bone field rather
          than a flat colour block; the type sits on paper, not on the scene. */}
      <aside className="relative hidden overflow-hidden border-l border-line bg-surface-sunk p-14 lg:flex lg:flex-col lg:justify-between">
        <Logo className="relative" />

        <div className="relative max-w-lg">
          <p className="eyebrow">{quote?.eyebrow ?? 'Slotwise'}</p>
          <blockquote className="mt-6 font-display text-4xl leading-[1.1] text-ink xl:text-5xl">
            {quote?.text ?? 'Booking should feel like a recommendation from a friend, not a form.'}
          </blockquote>
          {quote?.attribution && <p className="mt-8 text-sm text-muted">{quote.attribution}</p>}
        </div>

        <div className="relative grid grid-cols-3 gap-6 border-t border-line pt-8">
          {[
            ['2.4k', 'Bookings placed'],
            ['180+', 'Providers listed'],
            ['4.8', 'Average rating'],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="tabular text-2xl text-ink">{value}</p>
              <p className="mt-1.5 text-[0.625rem] tracking-[0.18em] text-muted uppercase">{label}</p>
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
            {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
            <h1 className="text-4xl text-ink sm:text-5xl">{title}</h1>
            {subtitle && <p className="mt-5 text-sm leading-[1.7] text-muted">{subtitle}</p>}

            <div className="mt-10">{children}</div>

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
