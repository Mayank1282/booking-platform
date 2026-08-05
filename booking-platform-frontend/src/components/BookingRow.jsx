import { Link } from 'react-router-dom'
import { Calendar, ChevronRight, Clock, MapPin, Video } from 'lucide-react'
import Badge, { bookingTone } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Misc'
import { duration, friendlyDay, money, time } from '@/lib/format'

/**
 * One booking, as a card. Cards rather than table rows on every breakpoint —
 * the portfolio-wide rule is that tables collapse to cards on mobile, and this
 * list is dense enough that cards read better on desktop too.
 */
export default function BookingRow({ booking, perspective = 'client' }) {
  const counterparty = perspective === 'provider' ? booking.client : booking.provider
  const counterpartyName =
    perspective === 'provider'
      ? booking.client?.name
      : (booking.provider?.provider_profile?.business_name ?? booking.provider?.name)

  const isRemote = booking.service?.location_type === 'remote'

  return (
    <Link
      to={`/app/bookings/${booking.id}`}
      className="group block rounded-[var(--radius-card)] border border-line bg-surface p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-lift)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">{booking.code}</p>
          <h3 className="truncate text-base font-semibold text-ink group-hover:text-accent">
            {booking.service?.title}
          </h3>
        </div>
        <Badge tone={bookingTone[booking.status]} size="sm">
          {booking.status_label}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={13} aria-hidden="true" />
          <span className="tabular">{friendlyDay(booking.starts_at)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock size={13} aria-hidden="true" />
          <span className="tabular">
            {time(booking.starts_at)} · {duration(booking.duration_minutes)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          {isRemote ? <Video size={13} aria-hidden="true" /> : <MapPin size={13} aria-hidden="true" />}
          {isRemote ? 'Online' : (booking.service?.location?.city ?? 'In person')}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={counterpartyName} src={counterparty?.avatar_url} size={26} />
          <span className="truncate text-xs text-ink-soft">{counterpartyName}</span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {booking.payment && booking.payment.status !== 'succeeded' && booking.status !== 'cancelled' && (
            <Badge tone="gold" size="sm">
              {booking.payment.status === 'failed' ? 'Payment failed' : 'Unpaid'}
            </Badge>
          )}
          <span className="tabular text-sm font-semibold text-ink">
            {money(booking.price_amount, booking.currency)}
          </span>
          <ChevronRight size={15} className="text-muted transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  )
}
