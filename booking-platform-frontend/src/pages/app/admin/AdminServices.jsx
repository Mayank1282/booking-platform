import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Search, Store } from 'lucide-react'
import api, { errorMessage } from '@/lib/api'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Pagination, Rating, SectionTitle } from '@/components/ui/Misc'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import ServiceArtwork from '@/components/ServiceArtwork'
import { duration, money } from '@/lib/format'

export default function AdminServices() {
  const [services, setServices] = useState([])
  const [meta, setMeta] = useState(null)
  const [filters, setFilters] = useState({ q: '', status: '' })
  const [draft, setDraft] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)

    api
      .get('/admin/services', {
        params: { q: filters.q || undefined, status: filters.status || undefined, page },
      })
      .then(({ data }) => {
        setServices(data.data)
        setMeta(data.meta)
      })
      .catch(() => setError('Listings could not be loaded.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [filters, page])

  const toggle = async (service) => {
    try {
      const { data } = await api.post(`/admin/services/${service.slug}/toggle`)
      toast.success(data.message)
      setServices((prev) => prev.map((item) => (item.id === service.id ? data.data : item)))
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Moderation"
        title="Listings"
        description="Every service on the platform. Unpublish anything that breaches the rules — the provider keeps it, but clients cannot see or book it."
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setFilters((prev) => ({ ...prev, q: draft.trim() }))
            setPage(1)
          }}
          className="relative flex-1"
        >
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search listings…"
            aria-label="Search listings"
            className="h-11 w-full rounded-[var(--radius-inner)] border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
          />
        </form>

        <select
          value={filters.status}
          onChange={(event) => {
            setFilters((prev) => ({ ...prev, status: event.target.value }))
            setPage(1)
          }}
          aria-label="Filter by status"
          className="h-11 cursor-pointer rounded-[var(--radius-inner)] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none sm:w-48"
        >
          <option value="">All listings</option>
          <option value="active">Live</option>
          <option value="hidden">Unpublished</option>
        </select>
      </div>

      {loading ? (
        <LoadingState label="Loading listings" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : services.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No listings match"
          description="Try a different search or clear the filter."
          className="rounded-[var(--radius-card)] border border-line bg-surface"
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => (
              <li key={service.id}>
                <Card className="flex h-full flex-col overflow-hidden">
                  <div className="relative aspect-[16/9]">
                    {service.image_url ? (
                      <img src={service.image_url} alt="" className="size-full object-cover" />
                    ) : (
                      <ServiceArtwork service={service} className="size-full" />
                    )}
                    {!service.is_active && (
                      <span className="absolute top-3 right-3">
                        <Badge tone="rose" size="sm">
                          Unpublished
                        </Badge>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 text-base font-semibold text-ink">
                        <Link to={`/services/${service.slug}`} className="hover:text-accent">
                          {service.title}
                        </Link>
                      </h3>
                      <span className="tabular shrink-0 font-semibold text-accent">
                        {money(service.price, service.currency)}
                      </span>
                    </div>

                    <p className="mt-1.5 truncate text-xs text-muted">
                      {service.provider?.provider_profile?.business_name ?? service.provider?.name}
                      {' · '}
                      <span className="tabular">{duration(service.duration_minutes)}</span>
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge tone="neutral" size="sm">
                        {service.category?.name}
                      </Badge>
                      <Badge tone="neutral" size="sm">
                        {service.location_label}
                      </Badge>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3.5">
                      <Rating value={service.rating_avg} count={service.rating_count} size={12} />
                      <button
                        type="button"
                        onClick={() => toggle(service)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-inner)] border border-line-strong px-3 text-xs text-ink transition-colors hover:border-accent hover:text-accent"
                      >
                        {service.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                        {service.is_active ? 'Unpublish' : 'Restore'}
                      </button>
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
  )
}
