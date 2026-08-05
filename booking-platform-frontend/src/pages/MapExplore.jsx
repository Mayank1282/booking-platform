import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, X } from 'lucide-react'
import api from '@/lib/api'
import ServiceMap from '@/components/map/ServiceMap'
import PlaceSearch from '@/components/map/PlaceSearch'
import Button from '@/components/ui/Button'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { Rating, SectionTitle } from '@/components/ui/Misc'
import { money } from '@/lib/format'

const RADIUS_OPTIONS = [10, 25, 50, 100]

/**
 * Map-first browsing. Only on-site services carry coordinates, so the query
 * asks for those specifically rather than filtering a mixed page client-side.
 */
export default function MapExplore() {
  const [services, setServices] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // The place the visitor searched for, and how wide a net to cast around it.
  const [place, setPlace] = useState(null)
  const [radius, setRadius] = useState(25)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)

    api
      .get('/services', {
        params: {
          location_type: 'on_site',
          per_page: 48,
          near_lat: place?.lat,
          near_lng: place?.lng,
          radius_km: place ? radius : undefined,
        },
      })
      .then(({ data }) => setServices(data.data))
      .catch(() => setError('The map could not load right now.'))
      .finally(() => setLoading(false))
  }, [place, radius])

  useEffect(load, [load])

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <SectionTitle
        eyebrow="Map view"
        title="Who is nearby?"
        description="Search a city or area to jump there, then tap a pin to see the detail."
      />

      {/* Place search sits above the map, the way it does in Maps. */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <PlaceSearch
          className="flex-1"
          onSelect={(selected) => setPlace(selected)}
          onClear={() => setPlace(null)}
        />

        {place && (
          <div className="flex items-center gap-2">
            <label htmlFor="radius" className="text-xs whitespace-nowrap text-muted">
              Within
            </label>
            <select
              id="radius"
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
              className="tabular h-11 cursor-pointer rounded-[var(--radius-inner)] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none"
            >
              {RADIUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} km
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" icon={X} onClick={() => setPlace(null)}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {place && (
        <p className="mt-3 text-sm text-muted">
          Showing services within <span className="tabular text-ink">{radius} km</span> of{' '}
          <span className="font-medium text-ink">{place.label}</span>
        </p>
      )}

      {loading ? (
        <LoadingState label="Loading the map" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
          <ServiceMap
            services={services}
            activeId={activeId}
            onSelect={setActiveId}
            focus={place ? { ...place, radiusKm: radius } : null}
            // Dragging the pin (or clicking the map) re-runs the search from
            // the new point, keeping whatever zoom the visitor has set.
            onFocusMove={(moved) => setPlace((current) => ({ ...current, ...moved, zoom: undefined }))}
            height={560}
            className="lg:h-[calc(100dvh-18rem)]"
          />

          {/* Companion list. On mobile it sits under the map; on desktop it
              scrolls independently beside it. */}
          <aside className="mt-4 lg:mt-0 lg:max-h-[calc(100dvh-18rem)] lg:overflow-y-auto">
            <p className="tabular mb-3 text-xs text-muted">
              {services.length} location{services.length === 1 ? '' : 's'}
            </p>

            {services.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title={place ? 'Nothing in this area' : 'Nothing to map yet'}
                description={
                  place
                    ? 'Try a wider radius, or search a different place.'
                    : 'No in-person services are listed at the moment.'
                }
                action={
                  place && (
                    <Button variant="secondary" size="sm" onClick={() => setRadius(100)}>
                      Widen to 100 km
                    </Button>
                  )
                }
                className="rounded-[var(--radius-card)] border border-line bg-surface"
              />
            ) : (
              <ul className="space-y-2">
                {services.map((service) => (
                  <li key={service.id}>
                    <Link
                      to={`/services/${service.slug}`}
                      onMouseEnter={() => setActiveId(service.id)}
                      onFocus={() => setActiveId(service.id)}
                      className={[
                        'block rounded-[var(--radius-card)] border p-4 transition-colors',
                        activeId === service.id
                          ? 'border-accent bg-accent-soft'
                          : 'border-line bg-surface hover:border-line-strong',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 text-sm font-medium text-ink">{service.title}</p>
                        <span className="tabular shrink-0 text-sm font-semibold text-accent">
                          {money(service.price, service.currency)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted">
                        {service.provider?.provider_profile?.business_name} · {service.location?.city}
                      </p>
                      <Rating value={service.rating_avg} count={service.rating_count} size={12} className="mt-2" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
