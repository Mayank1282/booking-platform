import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Lock, MapPin, Pencil, Plus, Store, Trash2 } from 'lucide-react'
import api, { errorMessage } from '@/lib/api'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { Pagination, Rating, SectionTitle } from '@/components/ui/Misc'
import ServiceArtwork from '@/components/ServiceArtwork'
import { duration, money } from '@/lib/format'

export default function ProviderServices() {
  const [services, setServices] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [deleting, setDeleting] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)

    api
      .get('/provider/services', { params: { page } })
      .then(({ data }) => {
        setServices(data.data)
        setMeta(data.meta)
      })
      .catch(() => setError('Your services could not be loaded.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [page])

  const remove = async () => {
    try {
      const { data } = await api.delete(`/provider/services/${deleting.slug}`)
      toast.success(data.message)
      setDeleting(null)
      load()
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    }
  }

  const toggleActive = async (service) => {
    const payload = new FormData()
    payload.append('is_active', service.is_active ? '0' : '1')

    try {
      await api.post(`/provider/services/${service.slug}`, payload)
      toast.success(service.is_active ? 'Service hidden from the directory.' : 'Service is live again.')
      load()
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    }
  }

  return (
    <>
      <div className="space-y-6">
        <SectionTitle
          eyebrow="Your listings"
          title="My services"
          description="What clients can book, how long it takes and what it costs."
          action={
            <Button icon={Plus} to="/app/services/new">
              New service
            </Button>
          }
        />

        {loading ? (
          <LoadingState label="Loading your services" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : services.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No services yet"
            description="Add your first service and it will appear in the directory straight away."
            action={
              <Button icon={Plus} to="/app/services/new">
                Add a service
              </Button>
            }
            className="rounded-[var(--radius-card)] border border-line bg-surface"
          />
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {services.map((service) => (
                <li key={service.id}>
                  <Card className="flex h-full flex-col overflow-hidden">
                    <div className="relative aspect-[16/9] bg-surface-sunk">
                      {service.image_url ? (
                        <img src={service.image_url} alt="" className="size-full object-cover" />
                      ) : (
                        <ServiceArtwork service={service} className="size-full" />
                      )}
                      {!service.is_active && (
                        <span className="absolute top-3 right-3">
                          <Badge tone="rose" size="sm">
                            Hidden
                          </Badge>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 text-base font-semibold text-ink">{service.title}</h3>
                        <span className="tabular shrink-0 font-semibold text-accent">
                          {money(service.price, service.currency)}
                        </span>
                      </div>

                      <p className="tabular mt-1.5 text-xs text-muted">
                        {duration(service.duration_minutes)}
                        {service.buffer_minutes > 0 && ` · +${service.buffer_minutes} min buffer`}
                      </p>

                      <p className="mt-2 line-clamp-2 text-sm text-muted">{service.description}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge tone="neutral" size="sm">
                          {service.category?.name}
                        </Badge>
                        <Badge tone="neutral" size="sm">
                          {service.location_label}
                        </Badge>
                        {service.location_locked && (
                          <Badge tone="neutral" size="sm">
                            <Lock size={11} aria-hidden="true" />
                            Address locked
                          </Badge>
                        )}
                      </div>

                      {service.is_mappable && service.location?.formatted_address && (
                        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
                          <MapPin size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                          <span className="line-clamp-1">{service.location.formatted_address}</span>
                        </p>
                      )}

                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3.5">
                        <Rating value={service.rating_avg} count={service.rating_count} size={12} />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleActive(service)}
                            aria-label={service.is_active ? 'Hide service' : 'Show service'}
                            className="flex size-9 items-center justify-center rounded-[var(--radius-inner)] text-muted transition-colors hover:bg-surface-sunk hover:text-ink"
                          >
                            {service.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                          </button>
                          <Link
                            to={`/app/services/${service.slug}/edit`}
                            aria-label="Edit service"
                            className="flex size-9 items-center justify-center rounded-[var(--radius-inner)] text-muted transition-colors hover:bg-surface-sunk hover:text-accent"
                          >
                            <Pencil size={15} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleting(service)}
                            aria-label="Delete service"
                            className="flex size-9 items-center justify-center rounded-[var(--radius-inner)] text-muted transition-colors hover:bg-rose-soft hover:text-rose"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>

            <Pagination meta={meta} onPage={setPage} />
          </>
        )}
      </div>

      {/* --- Delete confirmation --------------------------------------- */}
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        eyebrow="Careful"
        title="Delete this service?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">{deleting?.title}</span> will be removed. If it has
          past bookings it is archived instead, so your history stays intact — and a service with
          upcoming bookings cannot be deleted at all.
        </p>
      </Modal>
    </>
  )
}
