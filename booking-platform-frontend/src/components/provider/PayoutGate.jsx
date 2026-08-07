import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowUpRight, BadgeCheck, Banknote, RefreshCw, ShieldCheck } from 'lucide-react'
import api, { errorMessage } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/ui/Button'
import { money } from '@/lib/format'

/**
 * Blocks the provider dashboard until Stripe payouts are live.
 *
 * A provider who has not finished onboarding has no bank details on file and
 * no verified identity, so there is nowhere for their share of a booking to
 * go. Letting them list services and take money in that state would mean
 * accepting a client's card for an appointment we could not pay them for —
 * so the whole dashboard waits behind this.
 *
 * Deliberately not dismissible: no close button, no escape key, no backdrop
 * click. This is a hard requirement, not a suggestion, and a nag banner would
 * simply be ignored.
 */
export default function PayoutGate() {
  const { user, refresh } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  // Separate from `loading`, which is only ever true on first mount — so the
  // Recheck button had nothing to spin on.
  const [rechecking, setRechecking] = useState(false)
  const returnedRef = useRef(false)

  const isProvider = user?.role === 'provider'

  const load = useCallback(
    async ({ refreshRemote = false, announce = false } = {}) => {
      if (!isProvider) return

      if (announce) setRechecking(true)

      try {
        const { data } = await api.get('/provider/payouts', {
          params: refreshRemote ? { refresh: 1 } : undefined,
        })
        setStatus(data.data)

        // Keep the cached user in step, so the gate closes everywhere at once.
        if (data.data?.payouts_enabled && !user?.payouts_ready) await refresh?.()

        /*
          Say something either way. A button that silently redraws the same
          screen reads as broken — the provider cannot tell whether it checked
          and found nothing, or never checked at all.
        */
        if (announce) {
          data.data?.payouts_enabled
            ? toast.success('Payouts are live — unlocking your dashboard.')
            : toast('Checked with Stripe — still waiting on your details.', { icon: '↻' })
        }
      } catch {
        setStatus(null)
        if (announce) toast.error('Could not reach Stripe. Try again in a moment.')
      } finally {
        setLoading(false)
        if (announce) setRechecking(false)
      }
    },
    [isProvider, refresh, user?.payouts_ready],
  )

  useEffect(() => {
    load()
  }, [load])

  /*
    Stripe returns the provider with `?payouts=return`.

    That redirect is a full page load, so the in-memory "they went to Stripe"
    flag is gone by the time they land — which is why the gate used to sit
    there still asking them to verify. The query flag survives the reload and
    is what triggers the re-check.
  */
  useEffect(() => {
    const params = new URLSearchParams(location.search)

    if (!params.get('payouts')) return

    load({ refreshRemote: true, announce: true })

    // Strip it so a later refresh does not re-announce.
    params.delete('payouts')
    navigate(
      { pathname: location.pathname, search: params.toString() },
      { replace: true },
    )
  }, [location.search, location.pathname, load, navigate])

  /*
    Stripe sends the provider back to the app in this same tab. Re-checking on
    focus is what makes the gate lift the moment they return, without them
    having to reload.
  */
  useEffect(() => {
    if (!isProvider) return

    const onFocus = () => {
      if (returnedRef.current) load({ refreshRemote: true })
    }

    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [isProvider, load])

  const startOnboarding = async () => {
    setStarting(true)

    try {
      const { data } = await api.post('/provider/payouts/onboarding')
      returnedRef.current = true
      // Same tab: Stripe's flow expects to own the window and returns here.
      window.location.href = data.data.url
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Could not open Stripe right now.'))
      setStarting(false)
    }
  }

  if (!isProvider || loading || status?.payouts_enabled) return null

  const commission = status?.commission
  const example = commission?.example
  const resuming = status?.details_submitted

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payout-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4 sm:p-6"
    >
      {/* Opaque rather than translucent: the dashboard behind this is not
          usable yet, so showing it half-visible only invites clicking at it. */}
      <div className="fixed inset-0 bg-canvas/95 backdrop-blur-sm" aria-hidden="true" />

      <div className="animate-rise relative my-auto w-full max-w-lg rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-pop)] sm:p-8">
        <span className="flex size-11 items-center justify-center rounded-[var(--radius-inner)] bg-accent-soft text-accent">
          <Banknote size={20} aria-hidden="true" />
        </span>

        <p className="eyebrow mt-5">One last step</p>
        <h2 id="payout-gate-title" className="mt-1 text-2xl text-ink sm:text-3xl">
          Set up how you get paid
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-muted">
          {resuming
            ? 'Stripe still needs a little more from you before money can reach your account. Pick up where you left off.'
            : 'Your account is ready — we just need somewhere to send your earnings. Stripe verifies your identity and collects your bank details directly; we never see or store them.'}
        </p>

        {example && (
          <div className="mt-5 rounded-[var(--radius-inner)] border border-line bg-surface-sunk p-4">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              How the money splits
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">You list a service at</dt>
                <dd className="tabular text-ink">{money(example.provider_amount, example.currency)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Client pays</dt>
                <dd className="tabular text-ink">
                  {money(example.refundable ?? example.total, example.currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-2">
                <dt className="text-muted">
                  Our commission ({commission.percent}%, added on top)
                </dt>
                <dd className="tabular text-ink-soft">
                  {money(example.platform_fee, example.currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-ink">You receive</dt>
                <dd className="tabular font-semibold text-accent">
                  {money(example.provider_amount, example.currency)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              Our fee is added to the client's total, never taken out of your price — you always
              receive exactly what you listed.
            </p>
          </div>
        )}

        {status?.requirements?.currently_due?.length > 0 && (
          <p className="mt-4 text-xs text-muted">
            Stripe still needs: {formatRequirements(status.requirements.currently_due)}.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={startOnboarding}
            loading={starting}
            iconRight={ArrowUpRight}
            className="flex-1"
          >
            {resuming ? 'Finish setting up payouts' : 'Set up payouts with Stripe'}
          </Button>
          <Button
            variant="ghost"
            icon={RefreshCw}
            loading={rechecking}
            disabled={rechecking}
            onClick={() => load({ refreshRemote: true, announce: true })}
          >
            {rechecking ? 'Checking…' : 'Recheck'}
          </Button>
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs text-muted">
          <ShieldCheck size={13} className="mt-0.5 shrink-0 text-sage" aria-hidden="true" />
          Handled entirely by Stripe. Bank details and identity documents go straight to them and
          never touch our servers.
        </p>

        <p className="mt-2 flex items-start gap-2 text-xs text-muted">
          <BadgeCheck size={13} className="mt-0.5 shrink-0 text-sage" aria-hidden="true" />
          Takes a couple of minutes. Once it is done this closes and your dashboard unlocks.
        </p>
      </div>
    </div>
  )
}

/* Stripe's requirement keys are machine-readable; make them a sentence. */
function formatRequirements(keys) {
  return keys
    .slice(0, 4)
    .map((key) =>
      key
        .replace(/^individual\./, '')
        .replace(/^business_profile\./, '')
        .replace(/_/g, ' ')
        .replace(/\./g, ' '),
    )
    .join(', ')
}
