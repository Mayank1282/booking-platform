import { useState } from 'react'
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Lock } from 'lucide-react'
import Button from '@/components/ui/Button'
import { money } from '@/lib/format'

/*
  The real Stripe card form.

  An earlier version linked to `https://checkout.stripe.com/c/pay/<client_secret>`,
  which 404s — that URL shape belongs to Stripe Checkout Sessions, a different
  product. A PaymentIntent is confirmed client-side with Stripe.js instead, which
  is what this does.

  Card details are entered inside Stripe's own iframe, so they never touch this
  application or its server.
*/
export default function StripeCheckout({ booking, amount, onPaid, onError }) {
  const stripe = useStripe()
  const elements = useElements()

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()

    // Stripe.js has to finish loading before the intent can be confirmed.
    if (!stripe || !elements) return

    setSubmitting(true)
    setMessage(null)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Only used when the payment method forces a redirect (3-D Secure,
        // UPI, wallets). Cards usually complete without leaving the page.
        return_url: `${window.location.origin}/app/bookings/${booking.id}`,
      },
      redirect: 'if_required',
    })

    if (error) {
      // card_error and validation_error are safe to show verbatim; anything
      // else is an internal Stripe problem and gets a generic message.
      const text =
        error.type === 'card_error' || error.type === 'validation_error'
          ? error.message
          : 'Something went wrong taking that payment. Please try again.'

      setMessage(text)
      onError?.(text)
      setSubmitting(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      onPaid?.(paymentIntent)
      return
    }

    if (paymentIntent?.status === 'processing') {
      setMessage('Your payment is processing. This booking will confirm as soon as it settles.')
      onPaid?.(paymentIntent)
      return
    }

    setMessage('That payment did not complete. Please try another card.')
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />

      {message && (
        <p className="rounded-[var(--radius-inner)] border border-rose/25 bg-rose-soft px-3 py-2.5 text-sm text-rose">
          {message}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        icon={Lock}
        loading={submitting}
        disabled={!stripe || !elements}
        className="w-full"
      >
        {/* Quote the amount this gateway will actually charge. The booking
            row holds whatever gateway priced it last, so it reads ₹880 the
            moment the client has looked at Razorpay — while Stripe charges
            ₹953.12. */}
        Pay {money(amount ?? booking.price_amount, booking.currency)}
      </Button>

      <p className="text-center text-xs text-muted">
        Payments are processed securely by Stripe. Your card details are never stored on our
        servers.
      </p>
    </form>
  )
}
