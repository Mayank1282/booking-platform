import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CreditCard, Info, Lock, ShieldCheck } from 'lucide-react'
import api, { errorMessage } from '@/lib/api'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { dateTime, money } from '@/lib/format'

/**
 * Checkout for a placed booking.
 *
 * With Stripe keys configured the backend returns a real PaymentIntent secret
 * and this hands off to Stripe. Without them it returns a simulated intent,
 * and the same UI settles the payment through the simulate endpoint — so the
 * booking lifecycle is fully demonstrable with no keys and no billing account.
 */
export default function PaymentModal({ open, booking, onClose, onPaid }) {
  const [intent, setIntent] = useState(null)
  const [preparing, setPreparing] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !booking) return

    let cancelled = false
    setPreparing(true)
    setError(null)

    api
      .post(`/bookings/${booking.id}/pay`)
      .then(({ data }) => !cancelled && setIntent(data.data))
      .catch((requestError) => !cancelled && setError(errorMessage(requestError, 'Could not start the payment.')))
      .finally(() => !cancelled && setPreparing(false))

    return () => {
      cancelled = true
    }
  }, [open, booking])

  const settle = async (outcome) => {
    setPaying(true)

    try {
      const { data } = await api.post(`/bookings/${booking.id}/pay/simulate`, { outcome })

      if (data.data.payment.status === 'succeeded') {
        toast.success('Payment received — your booking is confirmed.')
        onPaid?.(data.data.booking)
        onClose()
      } else {
        toast.error(data.data.payment.failure_reason ?? 'The payment failed.')
        setError(data.data.payment.failure_reason ?? 'The payment failed.')
      }
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'The payment could not be completed.'))
    } finally {
      setPaying(false)
    }
  }

  if (!booking) return null

  const isStripe = intent?.gateway === 'stripe'

  return (
    <Modal
      open={open}
      onClose={paying ? undefined : onClose}
      eyebrow={`Booking ${booking.code}`}
      title="Complete your payment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={paying}>
            Pay later
          </Button>
          {!isStripe && (
            <Button
              onClick={() => settle('success')}
              loading={paying}
              disabled={preparing || !intent}
              icon={Lock}
            >
              Pay {money(booking.price_amount, booking.currency)}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {/* Order summary */}
        <div className="rounded-[var(--radius-card)] border border-line bg-surface-sunk p-4">
          <p className="font-medium text-ink">{booking.service?.title}</p>
          <p className="mt-1 text-sm text-muted">
            with {booking.provider?.provider_profile?.business_name ?? booking.provider?.name}
          </p>
          <dl className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">When</dt>
              <dd className="tabular text-right text-ink">{dateTime(booking.starts_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Duration</dt>
              <dd className="tabular text-ink">{booking.duration_minutes} min</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-2">
              <dt className="font-medium text-ink">Total</dt>
              <dd className="tabular text-base font-semibold text-accent">
                {money(booking.price_amount, booking.currency)}
              </dd>
            </div>
          </dl>
        </div>

        {error && (
          <p className="rounded-[var(--radius-inner)] border border-rose/25 bg-rose-soft px-3 py-2.5 text-sm text-rose">
            {error}
          </p>
        )}

        {preparing ? (
          <p className="text-sm text-muted">Preparing a secure payment…</p>
        ) : isStripe ? (
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-[var(--radius-inner)] border border-line bg-surface-sunk px-3 py-2.5 text-sm text-ink-soft">
              <CreditCard size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              Stripe is configured. Card details are collected by Stripe and never touch this
              server; the booking is confirmed by the webhook once the charge settles.
            </p>
            <Button
              href={`https://checkout.stripe.com/c/pay/${intent.client_secret}`}
              target="_blank"
              rel="noreferrer"
              size="lg"
              icon={Lock}
              className="w-full"
            >
              Continue to Stripe
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-[var(--radius-inner)] border border-gold/25 bg-gold-soft px-3 py-2.5 text-sm text-gold">
              <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Demo mode — no Stripe keys are configured, so this uses a simulated gateway. The
                booking, payment record and confirmation email are all real.
              </span>
            </p>

            <button
              type="button"
              onClick={() => settle('failure')}
              disabled={paying}
              className="text-xs text-muted underline-offset-2 hover:text-rose hover:underline disabled:opacity-50"
            >
              Simulate a declined card instead
            </button>
          </div>
        )}

        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck size={13} className="text-sage" aria-hidden="true" />
          Free cancellation up to 24 hours before your appointment.
        </p>
      </div>
    </Modal>
  )
}
