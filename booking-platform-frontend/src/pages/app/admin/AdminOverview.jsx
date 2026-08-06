import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Ban, CalendarClock, IndianRupee, Store, UserPlus, Users } from 'lucide-react'
import api from '@/lib/api'
import Card, { CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge, { bookingTone } from '@/components/ui/Badge'
import { Avatar, StatTile } from '@/components/ui/Misc'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { compactMoney, dateShort, money, relative } from '@/lib/format'
import { useChartColors } from '@/lib/chartColors'


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

export default function AdminOverview() {
  const chart = useChartColors()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)

    api
      .get('/admin/overview')
      .then(({ data: response }) => setData(response.data))
      .catch(() => setError('The platform overview could not be loaded.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <LoadingState label="Loading the platform overview" />
  if (error) return <ErrorState message={error} onRetry={load} />

  const { stats } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Administration</p>
          <h1 className="text-3xl text-ink sm:text-4xl">Platform overview</h1>
          <p className="mt-2 text-sm text-muted">Everything happening across Slotwise, at a glance.</p>
        </div>
        <Button to="/app/admin/users" icon={Users}>
          Manage users
        </Button>
      </div>

      {/* --- Headline figures ------------------------------------------- */}
      <div className="bento">
        <StatTile
          label="Gross bookings value"
          value={compactMoney(stats.gmv)}
          note={`${money(stats.gmv_this_month)} this month`}
          icon={IndianRupee}
          tone="accent"
        />
        <StatTile
          label="Users"
          value={stats.users_total}
          note={`${stats.clients} clients · ${stats.providers} providers`}
          icon={Users}
        />
        <StatTile
          label="Listings"
          value={stats.services_total}
          note={`${stats.services_active} live`}
          icon={Store}
          tone="sage"
        />
        <StatTile
          label="Bookings"
          value={stats.bookings_total}
          note={`${stats.bookings_upcoming} upcoming`}
          icon={CalendarClock}
        />
      </div>

      <div className="bento">
        <StatTile
          label="New this month"
          value={stats.new_this_month}
          note="signups"
          icon={UserPlus}
          tone="sage"
        />
        <StatTile
          label="Suspended"
          value={stats.suspended}
          note="accounts blocked"
          icon={Ban}
          tone={stats.suspended > 0 ? 'gold' : 'default'}
        />
        <StatTile
          label="Refunded"
          value={compactMoney(stats.refunded_total)}
          note="returned to clients"
          icon={IndianRupee}
        />
        <StatTile
          label="Live listings"
          value={`${stats.services_active}/${stats.services_total}`}
          note="published vs total"
          icon={Store}
        />
      </div>

      {/* --- Charts ------------------------------------------------------ */}
      <div className="bento">
        <Card className="bento-2 overflow-hidden">
          <CardHeader eyebrow="Last six months" title="Revenue" />
          <div className="p-4 sm:p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.revenue_by_month} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-muted)', fontSize: 12 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                  tickFormatter={(value) => compactMoney(value)}
                  width={56}
                />
                <Tooltip cursor={{ fill: 'var(--color-surface-sunk)' }} content={<ChartTooltip formatter={(v) => money(v)} />} />
                <Bar dataKey="total" fill={chart.accent} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bento-2 overflow-hidden">
          <CardHeader eyebrow="Last six months" title="Signups" />
          <div className="p-4 sm:p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.signups_by_month} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-muted)', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--color-muted)', fontSize: 11 }} width={36} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'var(--color-surface-sunk)' }} content={<ChartTooltip />} />
                <Bar dataKey="total" fill={chart.sage} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* --- Recent activity --------------------------------------------- */}
      <div className="bento">
        <Card className="bento-2">
          <CardHeader
            eyebrow="Newest accounts"
            title="Recent signups"
            action={
              <Button to="/app/admin/users" variant="ghost" size="sm">
                All users
              </Button>
            }
          />
          <ul className="divide-y divide-line">
            {data.recent_users.map((user) => (
              <li key={user.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={user.name} src={user.avatar_url} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={user.role === 'provider' ? 'sage' : user.role === 'admin' ? 'accent' : 'neutral'} size="sm">
                    {user.role_label}
                  </Badge>
                  <span className="tabular hidden text-xs text-muted sm:inline">{dateShort(user.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="bento-2">
          <CardHeader
            eyebrow="Latest activity"
            title="Recent bookings"
            action={
              <Button to="/app/admin/bookings" variant="ghost" size="sm">
                All bookings
              </Button>
            }
          />
          <ul className="divide-y divide-line">
            {data.recent_bookings.map((booking) => (
              <li key={booking.id} className="px-5 py-3">
                <Link to={`/app/bookings/${booking.id}`} className="group flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink group-hover:text-accent">
                      {booking.service?.title}
                    </p>
                    <p className="tabular truncate text-xs text-muted">
                      {booking.code} · {relative(booking.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={bookingTone[booking.status]} size="sm">
                      {booking.status_label}
                    </Badge>
                    <span className="tabular hidden text-sm font-semibold text-ink sm:inline">
                      {money(booking.price_amount, booking.currency)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
