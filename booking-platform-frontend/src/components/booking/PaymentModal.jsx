import { useEffect, useMemo, useState } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import toast from 'react-hot-toast'
import { CheckCircle2, Info, Lock, RotateCcw, ShieldCheck, XCircle } from 'lucide-react'
import api, { errorMessage } from '@/lib/api'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StripeCheckout from './StripeCheckout'
import { dateTime, money } from '@/lib/format'

/*
  Checkout for a placed booking.

  With Stripe keys configured this renders Stripe's own card form (Elements)
  against the booking's PaymentIntent. Without keys the backend returns a
  simulated intent and the same modal settles it through the simulate endpoint,
  so the whole lifecycle stays demonstrable with no keys and no billing account.

  Stripe.js is loaded once per publishable key and cached — calling loadStripe
  on every render would refetch the script and remount the card iframe.
*/
const stripeCache = new Map()

function getStripe(publishableKey) {
  if (!publishableKey) return null
  if (!stripeCache.has(publishableKey)) stripeCache.set(publishableKey, loadStripe(publishableKey))

  return stripeCache.get(publishableKey)
}

export default function PaymentModal({ open, booking, onClose, onPaid }) {
  const [intent, setIntent] = useState(null)
  const [preparing, setPreparing] = useState(false)
  const [settling, setSettling] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  useEffect(() => {
    if (!open || !booking) return

    let cancelled = false
    setPreparing(true)
    setError(null)
    setDone(null)

    api
      .post(`/bookings/${booking.id}/pay`)
      .then(({ data }) => !cancelled && setIntent(data.data))
      .catch((requestError) => !cancelled && setError(errorMessage(requestError, 'Could not start the payment.')))
      .finally(() => !cancelled && setPreparing(false))

    return () => {
      cancelled = true
    }
  }, [open, booking])

  /** Re-reads the booking from the API so the page reflects the settled state. */
  const syncAndFinish = async (message) => {
    try {
      const { data } = await api.get(`/bookings/${booking.id}/pay/status`)
      const updated = data.data?.booking

      setDone(message)
      toast.success(message)
      if (updated) onPaid?.(updated)
    } catch {
      // The payment itself succeeded; only the refresh failed.
      setDone(message)
      toast.success(message)
      onPaid?.(null)
    }
  }

  /** Simulated gateway — only reachable when Stripe is not configured. */
  const settleSimulated = async (outcome) => {
    setSettling(true)

    try {
      const { data } = await api.post(`/bookings/${booking.id}/pay/simulate`, { outcome })

      if (data.data.payment.status === 'succeeded') {
        setDone('Payment received — your booking is confirmed.')
        toast.success('Payment received — your booking is confirmed.')
        onPaid?.(data.data.booking)
      } else {
        const reason = data.data.payment.failure_reason ?? 'The payment failed.'
        setError(reason)
        toast.error(reason)
      }
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'The payment could not be completed.'))
    } finally {
      setSettling(false)
    }
  }

  const stripePromise = useMemo(() => getStripe(intent?.publishable_key), [intent?.publishable_key])

  // Match Stripe's iframe to the app's own surfaces so it does not look bolted on.
  const appearance = useMemo(() => {
    if (typeof window === 'undefined') return undefined
    const styles = getComputedStyle(document.documentElement)
    const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback

    return {
      theme: document.documentElement.classList.contains('dark') ? 'night' : 'stripe',
      variables: {
        colorPrimary: read('--color-accent', '#a63d2a'),
        colorBackground: read('--color-surface', '#ffffff'),
        colorText: read('--color-ink', '#17150f'),
        colorDanger: read('--color-rose', '#8f3040'),
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        borderRadius: '5px',
      },
    }
  }, [open])

  if (!booking) return null

  const isStripe = intent?.gateway === 'stripe'
  const payment = booking.payment
  const alreadySettled = payment?.status === 'succeeded'
  const refunded = payment?.status === 'refunded'

  return (
    <Modal
      open={open}
      onClose={settling ? undefined : onClose}
      eyebrow={`Booking ${booking.code}`}
      title={done ? 'Payment complete' : 'Complete your payment'}
      footer={
        done ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={settling}>
              Pay later
            </Button>
            {!isStripe && !alreadySettled && !refunded && (
              <Button
                onClick={() => settleSimulated('success')}
                loading={settling}
                disabled={preparing || !intent}
                icon={Lock}
              >
                Pay {money(booking.price_amount, booking.currency)}
              </Button>
            )}
          </>
        )
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

        {/* ---- Terminal states, so the modal never offers to charge twice ---- */}
        {done ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-inner)] border border-sage/25 bg-sage-soft px-3 py-2.5 text-sm text-sage">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {done}
          </p>
        ) : refunded ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-inner)] border border-line bg-surface-sunk px-3 py-2.5 text-sm text-ink-soft">
            <RotateCcw size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            This payment was refunded
            {payment?.refunded_at ? ` on ${dateTime(payment.refunded_at)}` : ''}. Nothing further is
            owed.
          </p>
        ) : alreadySettled ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-inner)] border border-sage/25 bg-sage-soft px-3 py-2.5 text-sm text-sage">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            This booking is already paid
            {payment?.paid_at ? ` — settled ${dateTime(payment.paid_at)}` : ''}.
          </p>
        ) : (
          <>
            {error && (
              <p className="flex items-start gap-2 rounded-[var(--radius-inner)] border border-rose/25 bg-rose-soft px-3 py-2.5 text-sm text-rose">
                <XCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}

            {payment?.status === 'failed' && !error && (
              <p className="flex items-start gap-2 rounded-[var(--radius-inner)] border border-rose/25 bg-rose-soft px-3 py-2.5 text-sm text-rose">
                <XCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {payment.failure_reason ?? 'The last attempt was declined.'} Try another card.
              </p>
            )}

            {preparing ? (
              <p className="text-sm text-muted">Preparing a secure payment…</p>
            ) : isStripe && stripePromise && intent?.client_secret ? (
              <Elements
                stripe={stripePromise}
                options={{ clientSecret: intent.client_secret, appearance }}
              >
                <StripeCheckout
                  booking={booking}
                  onPaid={() => syncAndFinish('Payment received — your booking is confirmed.')}
                  onError={setError}
                />
              </Elements>
            ) : !isStripe ? (
              <div className="space-y-3">
                <p className="flex items-start gap-2 rounded-[var(--radius-inner)] border border-gold/25 bg-gold-soft px-3 py-2.5 text-sm text-gold">
                  <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    Demo mode — no card is required. The booking, payment record and confirmation
                    email are all real.
                  </span>
                </p>

                <button
                  type="button"
                  onClick={() => settleSimulated('failure')}
                  disabled={settling}
                  className="text-xs text-muted underline-offset-2 hover:text-rose hover:underline disabled:opacity-50"
                >
                  Simulate a declined card instead
                </button>
              </div>
            ) : null}
          </>
        )}

        {!done && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck size={13} className="text-sage" aria-hidden="true" />
            Free cancellation up to 24 hours before your appointment.
          </p>
        )}
      </div>
    </Modal>
  )
}
