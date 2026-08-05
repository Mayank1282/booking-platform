import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Receipt } from 'lucide-react'
import api from '@/lib/api'
import Card from '@/components/ui/Card'
import Badge, { paymentTone } from '@/components/ui/Badge'
import { Pagination, SectionTitle } from '@/components/ui/Misc'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { dateShort, money, time } from '@/lib/format'

const statuses = [
  { value: '', label: 'All payments' },
  { value: 'succeeded', label: 'Settled' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
]

export default function AdminPayments() {
  const [payments, setPayments] = useState([])
  const [meta, setMeta] = useState(null)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)

    api
      .get('/admin/payments', { params: { status: status || undefined, page } })
      .then(({ data }) => {
        setPayments(data.data)
        setMeta(data.meta)
      })
      .catch(() => setError('Payments could not be loaded.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [status, page])

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Administration"
        title="All payments"
        description="The full platform ledger — every intent, settlement and refund."
        action={
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            aria-label="Filter payments by status"
            className="h-11 cursor-pointer rounded-[var(--radius-inner)] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none"
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
        <ErrorState message={error} onRetry={load} />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No payments match"
          description="Try a different status filter."
          className="rounded-[var(--radius-card)] border border-line bg-surface"
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden lg:block">
            <div className="scroll-rail">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    {['Booking', 'Service', 'Gateway', 'Reference', 'Date', 'Amount', 'Status'].map((heading) => (
                      <th key={heading} className="eyebrow px-4 py-3 font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="transition-colors hover:bg-surface-sunk">
                      <td className="tabular px-4 py-3">
                        {payment.booking?.id ? (
                          <Link to={`/app/bookings/${payment.booking.id}`} className="text-accent hover:underline">
                            {payment.booking.code}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="max-w-[14rem] truncate px-4 py-3 text-ink">
                        {payment.booking?.service_title ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted capitalize">{payment.gateway}</td>
                      <td className="tabular max-w-[12rem] truncate px-4 py-3 text-xs text-muted">
                        {payment.reference ?? '—'}
                      </td>
                      <td className="tabular px-4 py-3 text-muted">
                        {payment.paid_at ? dateShort(payment.paid_at) : dateShort(payment.created_at)}
                      </td>
                      <td className="tabular px-4 py-3 font-semibold text-ink">
                        {money(payment.amount, payment.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={paymentTone[payment.status]} size="sm">
                          {payment.status_label}
                        </Badge>
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
                    <span className="tabular text-xs text-muted">
                      {payment.paid_at
                        ? `${dateShort(payment.paid_at)} · ${time(payment.paid_at)}`
                        : dateShort(payment.created_at)}
                    </span>
                    <span className="tabular text-sm font-semibold text-ink">
                      {money(payment.amount, payment.currency)}
                    </span>
                  </div>
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
