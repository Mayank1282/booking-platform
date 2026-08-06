import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CalendarClock,
  CalendarPlus,
  CreditCard,
  IndianRupee,
  Search,
  Star,
  Store,
  TrendingUp,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import BookingRow from '@/components/BookingRow'
import { Avatar, Rating, StatTile } from '@/components/ui/Misc'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { compactMoney, money, relative } from '@/lib/format'
import { statusColors, useChartColors } from '@/lib/chartColors'


function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-[var(--radius-inner)] border border-line bg-surface px-3 py-2 shadow-[var(--shadow-pop)]">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular text-sm font-semibold text-ink">
        {formatter ? formatter(payload[0].value) : payload[0].value}
      </p>
    </div>
  )
}

export default function Dashboard() {
  const { user, isProvider } = useAuth()
  const chart = useChartColors()
  const statusColour = statusColors(chart)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)

    api
      .get('/dashboard')
      .then(({ data: response }) => setData(response.data))
      .catch(() => setError('Your dashboard could not be loaded.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <LoadingState label="Loading your dashboard" />
  if (error) return <ErrorState message={error} onRetry={load} />

  const { stats } = data
  const series = isProvider ? data.revenue_by_month : data.spend_by_month
  const firstName = user?.name?.split(' ')[0]

  return (
    <div className="space-y-6">
      {/* --- Header ------------------------------------------------------ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-3xl text-ink sm:text-4xl">
            {isProvider ? `Good to see you, ${firstName}.` : `Welcome back, ${firstName}.`}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {isProvider
              ? 'Here is how your calendar and earnings are looking.'
              : 'Your upcoming appointments and spending at a glance.'}
          </p>
        </div>

        <Button to={isProvider ? '/app/services' : '/services'} icon={isProvider ? Store : Search}>
          {isProvider ? 'Manage services' : 'Book something'}
        </Button>
      </div>

      {/* --- Bento stat grid --------------------------------------------- */}
      <div className="bento">
        {isProvider ? (
          <>
            <StatTile
              label="Total earnings"
              value={compactMoney(stats.total_earnings)}
              note={`${money(stats.earnings_this_month)} this month`}
              icon={IndianRupee}
              tone="accent"
            />
            <StatTile
              label="Upcoming"
              value={stats.upcoming_bookings}
              note={`${stats.pending_bookings} awaiting confirmation`}
              icon={CalendarClock}
            />
            <StatTile
              label="Completed"
              value={stats.completed_bookings}
              note={`${stats.total_bookings} bookings all time`}
              icon={TrendingUp}
              tone="sage"
            />
            <StatTile
              label="Rating"
              value={stats.rating_avg > 0 ? Number(stats.rating_avg).toFixed(1) : '—'}
              note={`${stats.rating_count} review${stats.rating_count === 1 ? '' : 's'}`}
              icon={Star}
              tone="gold"
            />
          </>
        ) : (
          <>
            <StatTile
              label="Total spent"
              value={compactMoney(stats.total_spent)}
              note={`${money(stats.spent_this_month)} this month`}
              icon={IndianRupee}
              tone="accent"
            />
            <StatTile
              label="Upcoming"
              value={stats.upcoming_bookings}
              note={`${stats.total_bookings} bookings all time`}
              icon={CalendarClock}
            />
            <StatTile
              label="Completed"
              value={stats.completed_bookings}
              note={`${stats.cancelled_bookings} cancelled`}
              icon={TrendingUp}
              tone="sage"
            />
            <StatTile
              label="Needs attention"
              value={stats.pending_payment + stats.awaiting_review}
              note={`${stats.pending_payment} unpaid · ${stats.awaiting_review} to review`}
              icon={CreditCard}
              tone="gold"
            />
          </>
        )}
      </div>

      {/* --- Charts ------------------------------------------------------- */}
      <div className="bento">
        <Card className="bento-2 overflow-hidden lg:col-span-3">
          <CardHeader
            eyebrow="Last six months"
            title={isProvider ? 'Revenue' : 'Spending'}
          />
          <div className="p-4 sm:p-5">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--color-line)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                  tickFormatter={(value) => compactMoney(value)}
                  width={56}
                />
                <Tooltip
                  cursor={{ fill: 'var(--color-surface-sunk)' }}
                  content={<ChartTooltip formatter={(value) => money(value)} />}
                />
                <Bar dataKey="total" fill={chart.accent} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bento-2 overflow-hidden lg:col-span-1">
          <CardHeader eyebrow="All time" title="By status" />
          <ul className="divide-y divide-line">
            {data.bookings_by_status.map((row) => (
              <li key={row.status} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <span className="flex items-center gap-2.5 text-sm text-ink-soft">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: statusColour[row.status] }}
                    aria-hidden="true"
                  />
                  {row.label}
                </span>
                <span className="tabular text-sm font-semibold text-ink">{row.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* --- Upcoming + secondary panel ----------------------------------- */}
      <div className="bento">
        <Card className="bento-2 lg:col-span-3">
          <CardHeader
            eyebrow="Next up"
            title="Upcoming bookings"
            action={
              <Button to="/app/bookings" variant="ghost" size="sm">
                View all
              </Button>
            }
          />
          <div className="p-4 sm:p-5">
            {data.upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarPlus}
                title="Nothing scheduled"
                description={
                  isProvider
                    ? 'New bookings will appear here as clients place them.'
                    : 'Browse the directory and book your next appointment.'
                }
                action={
                  !isProvider && (
                    <Button to="/services" size="sm">
                      Browse services
                    </Button>
                  )
                }
              />
            ) : (
              <ul className="space-y-3">
                {data.upcoming.map((booking) => (
                  <li key={booking.id}>
                    <BookingRow booking={booking} perspective={isProvider ? 'provider' : 'client'} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="bento-2 lg:col-span-1">
          <CardHeader
            eyebrow={isProvider ? 'Feedback' : 'Your turn'}
            title={isProvider ? 'Recent reviews' : 'Awaiting review'}
          />
          <div className="p-4 sm:p-5">
            {isProvider ? (
              data.recent_reviews.length === 0 ? (
                <EmptyState icon={Star} title="No reviews yet" description="They arrive once a booking is completed." />
              ) : (
                <ul className="space-y-4">
                  {data.recent_reviews.map((review) => (
                    <li key={review.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar name={review.client?.name} src={review.client?.avatar_url} size={28} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">{review.client?.name}</p>
                            <p className="text-xs text-muted">{relative(review.created_at)}</p>
                          </div>
                        </div>
                        <Rating value={review.rating} showCount={false} size={12} />
                      </div>
                      {review.comment && (
                        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted">{review.comment}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )
            ) : data.to_review.length === 0 ? (
              <EmptyState icon={Star} title="All caught up" description="No completed bookings are waiting on a review." />
            ) : (
              <ul className="space-y-3">
                {data.to_review.map((booking) => (
                  <li key={booking.id}>
                    <Link
                      to={`/app/bookings/${booking.id}`}
                      className="block rounded-[var(--radius-inner)] border border-line p-3 transition-colors hover:border-accent"
                    >
                      <p className="truncate text-sm font-medium text-ink">{booking.service?.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {booking.provider?.provider_profile?.business_name ?? booking.provider?.name}
                      </p>
                      <p className="mt-2 text-xs font-medium text-accent">Leave a review →</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
