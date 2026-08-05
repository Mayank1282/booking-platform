import { useEffect, useState } from 'react'
import { CalendarSearch } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/ui/Button'
import BookingRow from '@/components/BookingRow'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { Pagination, SectionTitle } from '@/components/ui/Misc'

const ranges = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: '', label: 'All' },
]

const statuses = [
  { value: '', label: 'Any status' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function Bookings() {
  const { isProvider } = useAuth()
  const [range, setRange] = useState('upcoming')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const [bookings, setBookings] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .get('/bookings', { params: { range: range || undefined, status: status || undefined, page } })
      .then(({ data }) => {
        if (cancelled) return
        setBookings(data.data)
        setMeta(data.meta)
      })
      .catch(() => !cancelled && setError('Your bookings could not be loaded.'))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [range, status, page])

  // Any filter change starts over at the first page.
  const changeRange = (value) => {
    setRange(value)
    setPage(1)
  }

  const changeStatus = (value) => {
    setStatus(value)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow={isProvider ? 'Your calendar' : 'Your appointments'}
        title={isProvider ? 'Bookings' : 'My bookings'}
        description={
          isProvider
            ? 'Everything clients have booked with you, newest first.'
            : 'Everything you have booked, newest first.'
        }
      />

      {/* Segmented range control + status select */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Filter by time"
          className="inline-flex rounded-[var(--radius-inner)] border border-line bg-surface p-1"
        >
          {ranges.map((option) => (
            <button
              key={option.value}
              role="tab"
              aria-selected={range === option.value}
              onClick={() => changeRange(option.value)}
              className={[
                'min-h-9 rounded-[calc(var(--radius-inner)-2px)] px-4 text-sm transition-colors',
                range === option.value
                  ? 'bg-accent font-medium text-white'
                  : 'text-ink-soft hover:text-ink',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>

        <select
          value={status}
          onChange={(event) => changeStatus(event.target.value)}
          aria-label="Filter by status"
          className="h-11 cursor-pointer rounded-[var(--radius-inner)] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none sm:w-48"
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
        <ErrorState message={error} onRetry={() => setPage(1)} />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={CalendarSearch}
          title="No bookings here"
          description={
            range === 'upcoming'
              ? 'Nothing scheduled ahead. Try the "All" tab to see your history.'
              : 'Nothing matches those filters.'
          }
          action={
            !isProvider && (
              <Button to="/services" size="sm">
                Browse services
              </Button>
            )
          }
          className="rounded-[var(--radius-card)] border border-line bg-surface"
        />
      ) : (
        <>
          <ul className="grid gap-3 lg:grid-cols-2">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <BookingRow booking={booking} perspective={isProvider ? 'provider' : 'client'} />
              </li>
            ))}
          </ul>

          <Pagination
            meta={meta}
            onPage={(next) => {
              setPage(next)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        </>
      )}
    </div>
  )
}
