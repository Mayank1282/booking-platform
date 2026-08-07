import { useState } from 'react'
import { Lock } from 'lucide-react'
import api, { errorMessage } from '@/lib/api'
import Button from '@/components/ui/Button'
import { money } from '@/lib/format'

/*
  Razorpay's widget is a hosted script rather than an embeddable form, so it
  is loaded on demand and opened as an overlay. Loaded once and cached — a
  second <script> tag would re-register the global and reopen the modal.
*/
let scriptPromise = null

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true)

  scriptPromise ??= new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => {
      scriptPromise = null
      resolve(false)
    }
    document.body.appendChild(script)
  })

  return scriptPromise
}

/**
 * Razorpay checkout for a booking.
 *
 * The handshake the widget returns is sent straight to the server, which
 * verifies its signature before confirming anything. Nothing here is trusted:
 * a browser could otherwise claim any payment id it liked.
 */
export default function RazorpayCheckout({ booking, order, user, onPaid, onError }) {
  const [busy, setBusy] = useState(false)

  const pay = async () => {
    setBusy(true)

    const ready = await loadRazorpay()

    if (!ready) {
      onError?.('Could not reach Razorpay. Check your connection and try again.')
      setBusy(false)
      return
    }

    const checkout = new window.Razorpay({
      key: order.key,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: 'Slotwise',
      description: booking.service?.title,
      prefill: {
        name: user?.name ?? '',
        email: user?.email ?? '',
        contact: user?.phone ?? '',
      },
      theme: {
        color:
          getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() ||
          '#a63d2a',
      },
      handler: async (response) => {
        try {
          const { data } = await api.post(`/bookings/${booking.id}/pay/razorpay`, response)
          onPaid?.(data.data.booking)
        } catch (requestError) {
          onError?.(errorMessage(requestError, 'That payment could not be verified.'))
        } finally {
          setBusy(false)
        }
      },
      modal: {
        // Closing the widget is not a failure — the hold is still live and
        // they can come back to it.
        ondismiss: () => setBusy(false),
      },
    })

    checkout.on('payment.failed', (event) => {
      onError?.(event?.error?.description ?? 'The payment was declined. Try another method.')
      setBusy(false)
    })

    checkout.open()
  }

  return (
    <div className="space-y-3">
      {/* Quote the order, never the booking. `booking.price_amount` is
          whatever the last gateway priced it at — switching from Stripe to
          Razorpay would otherwise leave the old, higher total on the button
          while Razorpay charges the lower one. */}
      <Button onClick={pay} loading={busy} icon={Lock} className="w-full">
        Pay {money(order.amount / 100, order.currency)}
      </Button>
      <p className="text-xs text-muted">
        UPI, cards, netbanking and wallets. Handled by Razorpay — card details never reach this
        server.
      </p>
    </div>
  )
}
