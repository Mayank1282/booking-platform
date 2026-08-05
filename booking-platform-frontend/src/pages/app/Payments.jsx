import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Receipt } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Card from '@/components/ui/Card'
import Badge, { paymentTone } from '@/components/ui/Badge'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { Pagination, SectionTitle } from '@/components/ui/Misc'
import { dateShort, money, time } from '@/lib/format'

const statuses = [
  { value: '', label: 'All payments' },
  { value: 'succeeded', label: 'Settled' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
]

export default function Payments() {
  const { isProvider } = useAuth()
  const [payments, setPayments] = useState([])
  const [meta, setMeta] = useState(null)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .get('/payments', { params: { status: status || undefined, page } })
      .then(({ data }) => {
        if (cancelled) return
        setPayments(data.data)
        setMeta(data.meta)
      })
      .catch(() => !cancelled && setError('Your payments could not be loaded.'))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [status, page])

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow={isProvider ? 'Money in' : 'Money out'}
        title={isProvider ? 'Earnings' : 'Payments'}
        description={
          isProvider
            ? 'Every payment a client has made against your bookings.'
            : 'A record of everything you have paid for on Slotwise.'
        }
        action={
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            aria-label="Filter payments by status"
            className="h-11 cursor-pointer rounded-[var(--radius-inner)] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
          >
            {statuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        }
      />

      {loading ? (
        <LoadingState label="Loading payments" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setPage(1)} />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No payments yet"
          description={
            isProvider
              ? 'Payments appear here as clients settle their bookings.'
              : 'Book something and your receipts will show up here.'
          }
          className="rounded-[var(--radius-card)] border border-line bg-surface"
        />
      ) : (
        <>
          {/* Desktop: table. Mobile: the same rows as cards — the shared
              portfolio rule for dense data. */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="scroll-rail">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    {['Booking', 'Service', 'Date', 'Amount', 'Status', ''].map((heading) => (
                      <th key={heading} className="eyebrow px-5 py-3 font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="transition-colors hover:bg-surface-sunk">
                      <td className="tabular px-5 py-3.5 text-ink">{payment.booking?.code ?? '—'}</td>
                      <td className="max-w-xs truncate px-5 py-3.5 text-ink-soft">
                        {payment.booking?.service_title ?? '—'}
                      </td>
                      <td className="tabular px-5 py-3.5 text-muted">
                        {payment.paid_at ? dateShort(payment.paid_at) : dateShort(payment.created_at)}
                      </td>
                      <td className="tabular px-5 py-3.5 font-semibold text-ink">
                        {money(payment.amount, payment.currency)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={paymentTone[payment.status]} size="sm">
                          {payment.status_label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {payment.booking?.id && (
                          <Link
                            to={`/app/bookings/${payment.booking.id}`}
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                          >
                            View
                            <ExternalLink size={12} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <ul className="space-y-3 lg:hidden">
            {payments.map((payment) => (
              <li key={payment.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="eyebrow mb-1">{payment.booking?.code ?? 'Payment'}</p>
                      <p className="truncate text-sm font-medium text-ink">
                        {payment.booking?.service_title ?? '—'}
                      </p>
                    </div>
                    <Badge tone={paymentTone[payment.status]} size="sm">
                      {payment.status_label}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                    <p className="tabular text-xs text-muted">
                      {payment.paid_at
                        ? `${dateShort(payment.paid_at)} · ${time(payment.paid_at)}`
                        : dateShort(payment.created_at)}
                    </p>
                    <p className="tabular text-sm font-semibold text-ink">
                      {money(payment.amount, payment.currency)}
                    </p>
                  </div>

                  {payment.booking?.id && (
                    <Link
                      to={`/app/bookings/${payment.booking.id}`}
                      className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      View booking
                      <ExternalLink size={12} />
                    </Link>
                  )}
                </Card>
              </li>
            ))}
          </ul>

          <Pagination meta={meta} onPage={setPage} />
        </>
      )}
    </div>
  )
}
