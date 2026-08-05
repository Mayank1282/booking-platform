import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  MapPin,
  MessageSquareQuote,
  Star,
  Video,
} from 'lucide-react'
import api, { errorMessage } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import Badge, { bookingTone, paymentTone } from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Field'
import { Avatar, Rating } from '@/components/ui/Misc'
import { ErrorState, LoadingState } from '@/components/ui/States'
import PaymentModal from '@/components/booking/PaymentModal'
import ServiceMap from '@/components/map/ServiceMap'
import { dateLong, dateTime, duration, money, time } from '@/lib/format'

const timeline = [
  { key: 'created_at', label: 'Booking placed', icon: CalendarClock },
  { key: 'confirmed_at', label: 'Confirmed', icon: BadgeCheck },
  { key: 'completed_at', label: 'Completed', icon: CheckCircle2 },
]

export default function BookingDetail() {
  const { id } = useParams()
  const { isProvider } = useAuth()

  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)

  const [payOpen, setPayOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [review, setReview] = useState({ rating: 5, comment: '' })

  const load = () => {
    setLoading(true)
    setError(null)

    api
      .get(`/bookings/${id}`)
      .then(({ data }) => setBooking(data.data))
      .catch(() => setError('That booking could not be found.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  const act = async (action, request) => {
    setBusy(action)

    try {
      const { data } = await request()
      setBooking(data.data)
      toast.success(data.message)
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setBusy(null)
    }
  }

  const cancel = async () => {
    setBusy('cancel')

    try {
      const { data } = await api.post(`/bookings/${booking.id}/cancel`, {
        reason: cancelReason.trim() || undefined,
      })
      setBooking(data.data)
      setCancelOpen(false)
      setCancelReason('')
      toast.success(data.message)
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setBusy(null)
    }
  }

  const submitReview = async () => {
    setBusy('review')

    try {
      await api.post(`/bookings/${booking.id}/review`, review)
      setReviewOpen(false)
      toast.success('Thanks for the review.')
      load()
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <LoadingState label="Loading booking" />

  if (error || !booking) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <ErrorState title="Booking not found" message={error} />
        <div className="mt-4 text-center">
          <Button to="/app/bookings" variant="secondary" icon={ArrowLeft}>
            Back to bookings
          </Button>
        </div>
      </div>
    )
  }

  const counterparty = isProvider ? booking.client : booking.provider
  const counterpartyName = isProvider
    ? booking.client?.name
    : (booking.provider?.provider_profile?.business_name ?? booking.provider?.name)

  const isRemote = booking.service?.location_type === 'remote'
  const isActive = booking.status !== 'cancelled' && booking.status !== 'completed'
  const needsPayment = !isProvider && booking.payment && booking.payment.status !== 'succeeded' && isActive

  return (
    <>
      <div className="space-y-6">
        <Link
          to="/app/bookings"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent"
        >
          <ArrowLeft size={15} />
          All bookings
        </Link>

        {/* --- Header --------------------------------------------------- */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow mb-2">{booking.code}</p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{booking.service?.title}</h1>
            <p className="tabular mt-3 text-sm text-muted">
              {dateLong(booking.starts_at)} · {time(booking.starts_at)}–{time(booking.ends_at)}
            </p>
          </div>
          <Badge tone={bookingTone[booking.status]}>{booking.status_label}</Badge>
        </div>

        {/* --- Actions --------------------------------------------------- */}
        <div className="flex flex-wrap gap-2">
          {needsPayment && (
            <Button icon={CreditCard} onClick={() => setPayOpen(true)}>
              {booking.payment.status === 'failed' ? 'Retry payment' : 'Complete payment'}
            </Button>
          )}

          {isProvider && booking.status === 'pending' && (
            <Button
              icon={BadgeCheck}
              loading={busy === 'confirm'}
              onClick={() => act('confirm', () => api.post(`/provider/bookings/${booking.id}/confirm`))}
            >
              Confirm booking
            </Button>
          )}

          {isProvider && booking.is_completable && (
            <Button
              icon={CheckCircle2}
              loading={busy === 'complete'}
              onClick={() => act('complete', () => api.post(`/provider/bookings/${booking.id}/complete`))}
            >
              Mark completed
            </Button>
          )}

          {!isProvider && booking.status === 'completed' && !booking.review && (
            <Button icon={Star} onClick={() => setReviewOpen(true)}>
              Leave a review
            </Button>
          )}

          {isActive && (
            <Button variant="danger" icon={Ban} onClick={() => setCancelOpen(true)}>
              Cancel booking
            </Button>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* --- Details -------------------------------------------------- */}
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader eyebrow="The appointment" title="Details" />
              <dl className="divide-y divide-line">
                {[
                  ['Service', booking.service?.title],
                  ['Category', booking.service?.category?.name],
                  ['When', dateTime(booking.starts_at)],
                  ['Duration', duration(booking.duration_minutes)],
                  ['Where', booking.service?.location_label],
                  ['Amount', money(booking.price_amount, booking.currency)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 px-5 py-3.5">
                    <dt className="text-sm text-muted">{label}</dt>
                    <dd className="tabular text-right text-sm font-medium text-ink">{value ?? '—'}</dd>
                  </div>
                ))}
              </dl>

              {booking.notes && (
                <div className="border-t border-line px-5 py-4">
                  <p className="eyebrow mb-2">Notes from the client</p>
                  <p className="text-sm leading-relaxed text-ink-soft">{booking.notes}</p>
                </div>
              )}

              {booking.cancellation_reason && (
                <div className="border-t border-line bg-rose-soft px-5 py-4">
                  <p className="eyebrow mb-2 text-rose">Cancellation reason</p>
                  <p className="text-sm text-rose">{booking.cancellation_reason}</p>
                </div>
              )}
            </Card>

            {/* Status timeline */}
            <Card>
              <CardHeader eyebrow="History" title="Progress" />
              <ol className="space-y-0 px-5 py-4">
                {timeline.map((step) => {
                  const at = booking[step.key]
                  const done = Boolean(at)

                  return (
                    <li key={step.key} className="flex gap-3 pb-5 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span
                          className={[
                            'flex size-8 shrink-0 items-center justify-center rounded-full border',
                            done
                              ? 'border-sage/30 bg-sage-soft text-sage'
                              : 'border-line bg-surface-sunk text-muted',
                          ].join(' ')}
                        >
                          <step.icon size={15} aria-hidden="true" />
                        </span>
                      </div>
                      <div className="min-w-0 pt-1">
                        <p className={`text-sm font-medium ${done ? 'text-ink' : 'text-muted'}`}>
                          {step.label}
                        </p>
                        <p className="tabular mt-0.5 text-xs text-muted">
                          {done ? dateTime(at) : 'Not yet'}
                        </p>
                      </div>
                    </li>
                  )
                })}

                {booking.cancelled_at && (
                  <li className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-rose/30 bg-rose-soft text-rose">
                      <Ban size={15} aria-hidden="true" />
                    </span>
                    <div className="pt-1">
                      <p className="text-sm font-medium text-rose">Cancelled</p>
                      <p className="tabular mt-0.5 text-xs text-muted">{dateTime(booking.cancelled_at)}</p>
                    </div>
                  </li>
                )}
              </ol>
            </Card>

            {/* Review, once it exists */}
            {booking.review && (
              <Card>
                <CardHeader eyebrow="Feedback" title="Review" />
                <div className="px-5 py-4">
                  <Rating value={booking.review.rating} showCount={false} size={15} />
                  {booking.review.comment && (
                    <p className="mt-3 text-sm leading-relaxed text-ink-soft">{booking.review.comment}</p>
                  )}
                </div>
              </Card>
            )}

            {/* Location map */}
            {booking.service?.is_mappable && booking.service.location?.latitude != null && (
              <Card className="overflow-hidden">
                <CardHeader eyebrow="Getting there" title="Location" />
                <div className="px-5 py-4">
                  <p className="mb-3 flex items-start gap-1.5 text-sm text-ink-soft">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
                    {booking.service.location.formatted_address}
                  </p>
                  <ServiceMap services={[booking.service]} height={260} />
                </div>
              </Card>
            )}
          </div>

          {/* --- Side column --------------------------------------------- */}
          <div className="space-y-4">
            <Card>
              <CardHeader eyebrow={isProvider ? 'Client' : 'Provider'} title="Who" />
              <div className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <Avatar name={counterpartyName} src={counterparty?.avatar_url} size={44} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{counterpartyName}</p>
                    {!isProvider && booking.provider?.provider_profile?.rating_count > 0 && (
                      <Rating
                        value={booking.provider.provider_profile.rating_avg}
                        count={booking.provider.provider_profile.rating_count}
                        size={12}
                      />
                    )}
                  </div>
                </div>

                {!isProvider && booking.service?.slug && (
                  <Button
                    to={`/services/${booking.service.slug}`}
                    variant="secondary"
                    size="sm"
                    className="mt-4 w-full"
                  >
                    View the listing
                  </Button>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader eyebrow="Payment" title="Status" />
              <div className="px-5 py-4">
                {booking.payment ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <Badge tone={paymentTone[booking.payment.status]}>
                        {booking.payment.status_label}
                      </Badge>
                      <span className="tabular text-lg font-semibold text-ink">
                        {money(booking.payment.amount, booking.payment.currency)}
                      </span>
                    </div>

                    <dl className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Method</dt>
                        <dd className="text-ink-soft capitalize">{booking.payment.gateway}</dd>
                      </div>
                      {booking.payment.paid_at && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted">Paid</dt>
                          <dd className="tabular text-ink-soft">{dateTime(booking.payment.paid_at)}</dd>
                        </div>
                      )}
                      {booking.payment.refunded_at && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted">Refunded</dt>
                          <dd className="tabular text-ink-soft">{dateTime(booking.payment.refunded_at)}</dd>
                        </div>
                      )}
                    </dl>

                    {booking.payment.failure_reason && (
                      <p className="mt-3 rounded-[var(--radius-inner)] border border-rose/25 bg-rose-soft px-3 py-2 text-xs text-rose">
                        {booking.payment.failure_reason}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted">No payment has been started for this booking.</p>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                {isRemote ? (
                  <Video size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                ) : (
                  <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                )}
                {isRemote
                  ? 'This is an online session. Joining details are arranged directly with the provider.'
                  : booking.service?.location_type === 'client_location'
                    ? 'The provider comes to you. They will confirm the address before the appointment.'
                    : 'This takes place at the provider’s location — see the map for directions.'}
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* --- Modals -------------------------------------------------------- */}
      <PaymentModal
        open={payOpen}
        booking={booking}
        onClose={() => setPayOpen(false)}
        onPaid={(updated) => setBooking(updated)}
      />

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        eyebrow={booking.code}
        title="Cancel this booking?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep it
            </Button>
            <Button variant="danger" loading={busy === 'cancel'} onClick={cancel}>
              Cancel booking
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {isProvider
            ? 'The client will be emailed, and any settled payment is refunded automatically.'
            : 'Free cancellation applies up to 24 hours before the start time. Any payment already taken is refunded.'}
        </p>
        <Textarea
          label="Reason (optional)"
          rows={3}
          className="mt-4"
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          placeholder="Let them know why, if you like."
        />
      </Modal>

      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        eyebrow={booking.service?.title}
        title="How did it go?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewOpen(false)}>
              Not now
            </Button>
            <Button loading={busy === 'review'} onClick={submitReview} icon={MessageSquareQuote}>
              Post review
            </Button>
          </>
        }
      >
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-ink-soft">Your rating</legend>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setReview((prev) => ({ ...prev, rating: star }))}
                aria-label={`${star} star${star === 1 ? '' : 's'}`}
                aria-pressed={review.rating === star}
                className="flex size-11 items-center justify-center rounded-[var(--radius-inner)] transition-colors hover:bg-surface-sunk"
              >
                <Star
                  size={24}
                  className={star <= review.rating ? 'text-gold' : 'text-line-strong'}
                  fill={star <= review.rating ? 'currentColor' : 'none'}
                />
              </button>
            ))}
          </div>
        </fieldset>

        <Textarea
          label="Anything to add?"
          rows={4}
          className="mt-4"
          value={review.comment}
          onChange={(event) => setReview((prev) => ({ ...prev, comment: event.target.value }))}
          placeholder="What stood out — good or bad?"
        />
      </Modal>
    </>
  )
}
