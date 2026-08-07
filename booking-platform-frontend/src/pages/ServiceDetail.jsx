import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Clock, MapPin, MessageSquareQuote, ShieldCheck, Timer, Video } from 'lucide-react'
import api, { errorMessage } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Field'
import { Avatar, Rating } from '@/components/ui/Misc'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import SlotPicker from '@/components/booking/SlotPicker'
import PaymentModal from '@/components/booking/PaymentModal'
import ServiceMap from '@/components/map/ServiceMap'
import ServiceArtwork from '@/components/ServiceArtwork'
import { dateLong, duration, money, relative, time } from '@/lib/format'

export default function ServiceDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isProvider, user } = useAuth()

  const [service, setService] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [slot, setSlot] = useState(null)
  const [notes, setNotes] = useState('')
  const [booking, setBooking] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [payOpen, setPayOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSlot(null)

    api
      .get(`/services/${slug}`)
      .then(({ data }) => {
        if (cancelled) return
        setService(data.data)

        return api.get(`/services/${slug}/reviews`, { params: { per_page: 6 } })
      })
      .then((response) => {
        if (!cancelled && response) setReviews(response.data.data)
      })
      .catch(() => !cancelled && setError('We could not find that service.'))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [slug])

  const placeBooking = async () => {
    if (!isAuthenticated) {
      toast('Sign in to book this service.', { icon: '🔒' })
      navigate('/login', { state: { from: { pathname: `/services/${slug}` } } })
      return
    }

    if (!slot) {
      toast.error('Pick a time first.')
      return
    }

    setPlacing(true)

    try {
      const { data } = await api.post('/bookings', {
        service_id: service.id,
        starts_at: slot,
        notes: notes.trim() || undefined,
      })

      setBooking(data.data)
      setPayOpen(true)
      toast.success('Slot held — complete the payment to confirm.')
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'That booking could not be placed.'))
      // The slot may have gone while the page was open — force a re-fetch.
      setSlot(null)
    } finally {
      setPlacing(false)
    }
  }

  if (loading) return <LoadingState label="Loading service" className="min-h-[60vh]" />

  if (error || !service) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <ErrorState title="Service not found" message={error} />
        <div className="mt-4 text-center">
          <Button to="/services" variant="secondary" icon={ArrowLeft}>
            Back to all services
          </Button>
        </div>
      </div>
    )
  }

  const profile = service.provider?.provider_profile
  const isRemote = service.location_type === 'remote'
  const isOwnService = user?.id === service.provider?.id
  const canBook = !isProvider && !isOwnService

  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <Link
          to="/services"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent"
        >
          <ArrowLeft size={15} />
          All services
        </Link>

        <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10 xl:gap-14">
          {/* --- Main column ------------------------------------------- */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{service.category?.name}</Badge>
              <Badge tone="neutral">{service.location_label}</Badge>
            </div>

            <h1 className="mt-6 text-4xl text-ink sm:text-5xl lg:text-6xl">{service.title}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
              <Rating value={service.rating_avg} count={service.rating_count} size={15} />
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} aria-hidden="true" />
                <span className="tabular">{duration(service.duration_minutes)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                {isRemote ? <Video size={14} aria-hidden="true" /> : <MapPin size={14} aria-hidden="true" />}
                {isRemote ? 'Online session' : (service.location?.city ?? 'On location')}
              </span>
              {service.bookings_count > 0 && (
                <span className="tabular">{service.bookings_count} booked</span>
              )}
            </div>

            {service.image_url ? (
              <img
                src={service.image_url}
                alt=""
                className="mt-8 aspect-[16/9] w-full rounded-[var(--radius-card)] border border-line object-cover"
              />
            ) : (
              <ServiceArtwork
                service={service}
                showTitle
                className="mt-10 aspect-[16/8] w-full rounded-[var(--radius-card)] border border-line"
              />
            )}

            <div className="mt-10">
              <p className="eyebrow mb-3">About this service</p>
              <p className="text-base leading-relaxed whitespace-pre-line text-ink-soft">
                {service.description}
              </p>
            </div>

            {/* Provider */}
            <Card className="mt-10 p-5 sm:p-6">
              <p className="eyebrow mb-4">Your provider</p>
              <div className="flex flex-wrap items-start gap-4">
                <Avatar
                  name={profile?.business_name ?? service.provider?.name}
                  src={service.provider?.avatar_url}
                  size={56}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-ink">
                    {profile?.business_name ?? service.provider?.name}
                  </p>
                  {profile?.headline && <p className="mt-1 text-sm text-muted">{profile.headline}</p>}
                  {profile?.rating_count > 0 && (
                    <Rating value={profile.rating_avg} count={profile.rating_count} size={13} className="mt-2" />
                  )}
                </div>
              </div>
              {profile?.bio && (
                <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink-soft">
                  {profile.bio}
                </p>
              )}
            </Card>

            {/* Location */}
            {service.is_mappable && service.location?.latitude != null && (
              <div className="mt-10">
                <p className="eyebrow mb-3">Where it happens</p>
                <p className="mb-3 text-sm text-ink-soft">{service.location.formatted_address}</p>
                <ServiceMap services={[service]} height={320} />
              </div>
            )}

            {/* Reviews */}
            <div className="mt-12">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow mb-2">What clients said</p>
                  <h2 className="text-2xl font-semibold text-ink">Reviews</h2>
                </div>
                {service.rating_count > 0 && (
                  <div className="text-right">
                    <p className="tabular text-3xl font-semibold text-ink">
                      {Number(service.rating_avg).toFixed(1)}
                    </p>
                    <p className="tabular text-xs text-muted">{service.rating_count} reviews</p>
                  </div>
                )}
              </div>

              {reviews.length === 0 ? (
                <EmptyState
                  icon={MessageSquareQuote}
                  title="No reviews yet"
                  description="Reviews can only be left after a completed booking, so this one is simply new."
                  className="mt-4 rounded-[var(--radius-card)] border border-line bg-surface"
                />
              ) : (
                <ul className="mt-6 space-y-4">
                  {reviews.map((review) => (
                    <li key={review.id}>
                      <Card className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar name={review.client?.name} src={review.client?.avatar_url} size={38} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-ink">{review.client?.name}</p>
                              <p className="text-xs text-muted">{relative(review.created_at)}</p>
                            </div>
                          </div>
                          <Rating value={review.rating} showCount={false} size={13} />
                        </div>
                        {review.comment && (
                          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{review.comment}</p>
                        )}
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* --- Booking panel ------------------------------------------
              Sticky beside the content on desktop; on mobile it simply
              follows the content in the normal flow. */}
          <aside className="mt-12 lg:mt-0">
            {/*
              The panel scrolls within itself rather than pushing the page.
              `overscroll-contain` stops the scroll chaining onto the document
              once this reaches its end, so the wheel stays where the cursor is.
              Height is capped to the viewport minus the sticky header.
            */}
            <div className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain">
              <Card className="overflow-hidden">
                <div className="border-b border-line p-5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="eyebrow mb-1">Price</p>
                      {/* The total, including the booking fee. Quoting the
                          provider's own price here would mean the number on
                          the checkout screen went up without explanation. */}
                      <p className="tabular text-3xl font-semibold text-accent">
                        {money(service.pricing?.total ?? service.price, service.currency)}
                      </p>
                      {service.pricing?.platform_fee > 0 && (
                        <p className="tabular mt-1 text-xs text-muted">
                          {money(service.pricing.provider_amount, service.currency)} + {' '}
                          {money(service.pricing.platform_fee, service.currency)} booking fee
                        </p>
                      )}
                    </div>
                    <p className="tabular flex items-center gap-1.5 text-sm text-muted">
                      <Timer size={14} aria-hidden="true" />
                      {duration(service.duration_minutes)}
                    </p>
                  </div>
                </div>

                {canBook ? (
                  <div className="space-y-5 p-5">
                    <SlotPicker serviceSlug={service.slug} value={slot} onChange={setSlot} />

                    <Textarea
                      label="Anything they should know?"
                      rows={3}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Optional — allergies, access instructions, what you'd like to focus on…"
                    />

                    {slot && (
                      <div className="rounded-[var(--radius-inner)] border border-sage/25 bg-sage-soft px-3 py-2.5 text-sm">
                        <p className="font-medium text-sage">You are booking</p>
                        <p className="tabular mt-0.5 text-ink-soft">
                          {dateLong(slot)} at {time(slot)}
                        </p>
                      </div>
                    )}

                    <Button
                      size="lg"
                      className="w-full"
                      loading={placing}
                      disabled={!slot}
                      onClick={placeBooking}
                    >
                      {isAuthenticated ? 'Book this slot' : 'Sign in to book'}
                    </Button>

                    <p className="flex items-start gap-1.5 text-xs text-muted">
                      <ShieldCheck size={13} className="mt-0.5 shrink-0 text-sage" aria-hidden="true" />
                      Free cancellation up to 24 hours before. You are not charged until you confirm.
                    </p>
                  </div>
                ) : (
                  <div className="p-5">
                    <p className="text-sm text-muted">
                      {isOwnService
                        ? 'This is your own service — switch to a client account to try the booking flow.'
                        : 'Provider accounts cannot place bookings. Sign in with a client account to book.'}
                    </p>
                    <Button to="/app/services" variant="secondary" className="mt-4 w-full">
                      Go to my services
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </aside>
        </div>
      </div>

      <PaymentModal
        open={payOpen}
        booking={booking}
        onClose={() => {
          setPayOpen(false)
          navigate('/app/bookings')
        }}
        onPaid={() => navigate('/app/bookings')}
      />
    </>
  )
}
