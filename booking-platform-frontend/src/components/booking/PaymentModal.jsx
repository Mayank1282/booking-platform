import { useEffect, useMemo, useState } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import toast from 'react-hot-toast'
import { CheckCircle2, Info, Lock, RotateCcw, ShieldCheck, XCircle } from 'lucide-react'
import api, { errorMessage } from '@/lib/api'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StripeCheckout from './StripeCheckout'
import RazorpayCheckout from './RazorpayCheckout'
import { useAuth } from '@/context/AuthContext'
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
  const { user } = useAuth()
  const [intent, setIntent] = useState(null)
  const [gateways, setGateways] = useState([])
  // Null until the client picks; the intent is only created once they have,
  // because the amount depends on the answer.
  const [gateway, setGateway] = useState(null)
  const [preparing, setPreparing] = useState(false)
  const [settling, setSettling] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const payment = booking?.payment
  const alreadySettled = payment?.status === 'succeeded'
  const refunded = payment?.status === 'refunded'
  // Nothing more can be charged on this booking. Covers the case where the
  // webhook settles the payment while this modal is still open.
  const closed = alreadySettled || refunded

  // Offer the methods this booking can actually be paid with, and what each
  // costs — the totals differ, so the choice has to come before the intent.
  useEffect(() => {
    if (!open || !booking || closed) return

    let cancelled = false

    api
      .get(`/bookings/${booking.id}/pay/gateways`)
      .then(({ data }) => {
        if (cancelled) return
        setGateways(data.data)
        // Skip the picker entirely when there is nothing to pick.
        if (data.data.length === 1) setGateway(data.data[0].gateway)
      })
      .catch(() => !cancelled && setGateways([]))

    return () => {
      cancelled = true
    }
  }, [open, booking, closed])

  useEffect(() => {
    // Never open a payment against a booking that is already settled or
    // refunded — there is nothing to collect, and asking for one would leave
    // a stray intent or order behind.
    if (!open || !booking || closed || !gateway) return

    let cancelled = false
    setPreparing(true)
    setError(null)
    setDone(null)

    api
      .post(`/bookings/${booking.id}/pay`, { gateway })
      .then(({ data }) => !cancelled && setIntent(data.data))
      .catch((requestError) => !cancelled && setError(errorMessage(requestError, 'Could not start the payment.')))
      .finally(() => !cancelled && setPreparing(false))

    return () => {
      cancelled = true
    }
  }, [open, booking, closed, gateway])

  // Reopening for a different booking must not inherit the last choice.
  useEffect(() => {
    if (!open) {
      setGateway(null)
      setIntent(null)
    }
  }, [open, booking?.id])

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

  /*
    Price the summary from the payment, not from the booking.

    The booking prop was fetched before checkout began, and the processing
    charge is only added once a gateway is chosen — so `booking.pricing` is a
    booking-time figure that no longer matches what the card will be debited.
    Quoting it here would show one number and charge another.
  */
  const charge = intent?.payment

  /*
    Priority matters here. The chosen gateway's quote wins, because the client
    is looking at it right now; the created payment is next; the booking row is
    the last resort, since it holds whatever gateway priced it *last* and goes
    stale the instant they switch method.
  */
  const selected = gateways.find((option) => option.gateway === gateway)

  const lines =
    selected?.pricing ??
    (charge
      ? {
          provider_amount: charge.provider_amount - charge.processing_fee_amount,
          platform_fee: charge.application_fee_amount,
          processing_fee: charge.processing_fee_amount,
          total: charge.amount,
        }
      : booking.pricing)

  const payableTotal = lines?.total ?? booking.price_amount

  return (
    <Modal
      open={open}
      onClose={settling ? undefined : onClose}
      eyebrow={`Booking ${booking.code}`}
      title={
        done || alreadySettled
          ? 'Payment complete'
          : refunded
            ? 'Payment refunded'
            : 'Complete your payment'
      }
      footer={
        /*
          "Pay later" only makes sense while something is still owed. Once the
          charge has settled or been refunded the single action is to close —
          offering to defer a payment that has already happened reads as though
          the money did not go through.
        */
        done || closed ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={settling}>
              Pay later
            </Button>
            {/* Only the simulated gateway pays from the footer. Stripe and
                Razorpay each render their own control in the body, and a
                second button here would quote a stale total. */}
            {intent?.gateway === 'simulated' && (
              <Button
                onClick={() => settleSimulated('success')}
                loading={settling}
                disabled={preparing || !intent}
                icon={Lock}
              >
                Pay {money(payableTotal, booking.currency)}
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
            {/* The split, itemised. A total that silently exceeds the listed
                price is the fastest way to lose someone at checkout. */}
            {lines?.platform_fee > 0 && (
              <>
                <div className="flex justify-between gap-4 border-t border-line pt-2">
                  <dt className="text-muted">Service</dt>
                  <dd className="tabular text-ink">
                    {money(lines.provider_amount, booking.currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Booking fee</dt>
                  <dd className="tabular text-ink">
                    {money(lines.platform_fee, booking.currency)}
                  </dd>
                </div>
                {/* Only appears for gateways that pass their cost on. Stripe
                    settles this platform in USD, so an INR booking carries a
                    card fee and a conversion; an Indian gateway carries
                    neither and this line is simply absent. */}
                {lines.processing_fee > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Payment processing &amp; conversion</dt>
                    <dd className="tabular text-ink">
                      {money(lines.processing_fee, booking.currency)}
                    </dd>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-between gap-4 border-t border-line pt-2">
              <dt className="font-medium text-ink">Total</dt>
              <dd className="tabular text-base font-semibold text-accent">
                {money(payableTotal, booking.currency)}
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

            {/* One card, one price each. The totals genuinely differ — an
                international card carries a conversion an Indian method does
                not — so the difference is shown rather than hidden. */}
            {gateways.length > 1 && (
              <div className="space-y-2">
                <p className="eyebrow">How would you like to pay?</p>
                {gateways.map((option) => (
                  <label
                    key={option.gateway}
                    className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-inner)] border p-3 transition-colors ${
                      gateway === option.gateway
                        ? 'border-accent bg-accent-soft'
                        : 'border-line hover:border-accent/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="gateway"
                      value={option.gateway}
                      checked={gateway === option.gateway}
                      onChange={() => setGateway(option.gateway)}
                      className="size-4 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{option.label}</span>
                      {option.pricing.processing_fee > 0 ? (
                        <span className="block text-xs text-muted">
                          includes {money(option.pricing.processing_fee, booking.currency)}{' '}
                          processing &amp; conversion
                        </span>
                      ) : (
                        <span className="block text-xs text-muted">no processing fee</span>
                      )}
                    </span>
                    <span className="tabular shrink-0 text-sm font-semibold text-ink">
                      {money(option.pricing.total, booking.currency)}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {!gateway ? null : preparing ? (
              <p className="text-sm text-muted">Preparing a secure payment…</p>
            ) : intent?.gateway === 'razorpay' && intent?.order_id ? (
              <RazorpayCheckout
                booking={booking}
                order={intent}
                user={user}
                onPaid={(updated) => {
                  setDone('Payment received — your booking is confirmed.')
                  toast.success('Payment received — your booking is confirmed.')
                  onPaid?.(updated)
                }}
                onError={setError}
              />
            ) : isStripe && stripePromise && intent?.client_secret ? (
              <Elements
                stripe={stripePromise}
                options={{ clientSecret: intent.client_secret, appearance }}
              >
                <StripeCheckout
                  booking={booking}
                  amount={payableTotal}
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

        {!done && !closed && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck size={13} className="text-sage" aria-hidden="true" />
            Free cancellation up to 24 hours before your appointment.
          </p>
        )}
      </div>
    </Modal>
  )
}
