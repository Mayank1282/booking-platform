import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarSearch, Search } from 'lucide-react'
import api from '@/lib/api'
import Card from '@/components/ui/Card'
import Badge, { bookingTone, paymentTone } from '@/components/ui/Badge'
import { Pagination, SectionTitle } from '@/components/ui/Misc'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { dateShort, money, time } from '@/lib/format'

const statuses = [
  { value: '', label: 'Any status' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function AdminBookings() {
  const [bookings, setBookings] = useState([])
  const [meta, setMeta] = useState(null)
  const [filters, setFilters] = useState({ q: '', status: '' })
  const [draft, setDraft] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)

    api
      .get('/admin/bookings', {
        params: { q: filters.q || undefined, status: filters.status || undefined, page },
      })
      .then(({ data }) => {
        setBookings(data.data)
        setMeta(data.meta)
      })
      .catch(() => setError('Bookings could not be loaded.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [filters, page])

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Administration"
        title="All bookings"
        description="Every booking on the platform, across every provider and client."
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setFilters((prev) => ({ ...prev, q: draft.trim() }))
            setPage(1)
          }}
          className="relative flex-1"
        >
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search by booking reference…"
            aria-label="Search bookings"
            className="h-11 w-full rounded-[var(--radius-inner)] border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
          />
        </form>

        <select
          value={filters.status}
          onChange={(event) => {
            setFilters((prev) => ({ ...prev, status: event.target.value }))
            setPage(1)
          }}
          aria-label="Filter by status"
          className="h-11 cursor-pointer rounded-[var(--radius-inner)] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none sm:w-48"
        >
          {statuses.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingState label="Loading bookings" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={CalendarSearch}
          title="No bookings match"
          description="Try a different reference or status."
          className="rounded-[var(--radius-card)] border border-line bg-surface"
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="scroll-rail">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    {['Reference', 'Service', 'Client', 'Provider', 'When', 'Amount', 'Status', 'Payment'].map(
                      (heading) => (
                        <th key={heading} className="eyebrow px-4 py-3 font-medium">
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="transition-colors hover:bg-surface-sunk">
                      <td className="tabular px-4 py-3">
                        <Link to={`/app/bookings/${booking.id}`} className="text-accent hover:underline">
                          {booking.code}
                        </Link>
                      </td>
                      <td className="max-w-[14rem] truncate px-4 py-3 text-ink">{booking.service?.title}</td>
                      <td className="max-w-[10rem] truncate px-4 py-3 text-muted">{booking.client?.name}</td>
                      <td className="max-w-[10rem] truncate px-4 py-3 text-muted">
                        {booking.provider?.provider_profile?.business_name ?? booking.provider?.name}
                      </td>
                      <td className="tabular px-4 py-3 text-muted">
                        {dateShort(booking.starts_at)}
                        <span className="block text-xs">{time(booking.starts_at)}</span>
                      </td>
                      <td className="tabular px-4 py-3 font-semibold text-ink">
                        {money(booking.price_amount, booking.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={bookingTone[booking.status]} size="sm">
                          {booking.status_label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {booking.payment ? (
                          <Badge tone={paymentTone[booking.payment.status]} size="sm">
                            {booking.payment.status_label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <ul className="space-y-3 lg:hidden">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <Link to={`/app/bookings/${booking.id}`} className="block">
                  <Card className="p-4" hover>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="eyebrow mb-1">{booking.code}</p>
                        <p className="truncate text-sm font-medium text-ink">{booking.service?.title}</p>
                      </div>
                      <Badge tone={bookingTone[booking.status]} size="sm">
                        {booking.status_label}
                      </Badge>
                    </div>

                    <p className="mt-2 truncate text-xs text-muted">
                      {booking.client?.name} →{' '}
                      {booking.provider?.provider_profile?.business_name ?? booking.provider?.name}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                      <span className="tabular text-xs text-muted">
                        {dateShort(booking.starts_at)} · {time(booking.starts_at)}
                      </span>
                      <span className="tabular text-sm font-semibold text-ink">
                        {money(booking.price_amount, booking.currency)}
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination meta={meta} onPage={setPage} />
        </>
      )}
    </div>
  )
}
