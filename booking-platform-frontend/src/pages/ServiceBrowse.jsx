import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Filter, MapIcon, Search, SlidersHorizontal, X } from 'lucide-react'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import ServiceCard, { ServiceCardSkeleton } from '@/components/ServiceCard'
import SearchAutocomplete from '@/components/SearchAutocomplete'
import ServiceMap from '@/components/map/ServiceMap'
import PlaceSearch from '@/components/map/PlaceSearch'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Pagination, SectionTitle } from '@/components/ui/Misc'
import { Select } from '@/components/ui/Field'

const sorts = [
  { value: 'latest', label: 'Newest first' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'popular', label: 'Most booked' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
]

const locationTypes = [
  { value: '', label: 'Anywhere' },
  { value: 'on_site', label: "At the provider's place" },
  { value: 'client_location', label: 'They come to me' },
  { value: 'remote', label: 'Online' },
]

export default function ServiceBrowse() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [categories, setCategories] = useState([])
  const [services, setServices] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  // Place focus for the map panel — a location search, not a service search.
  const [place, setPlace] = useState(null)
  const [radius, setRadius] = useState(25)
  const [showMap, setShowMap] = useState(false)

  // The URL is the single source of truth for filters, so results are
  // shareable and the back button behaves.
  const filters = useMemo(
    () => ({
      q: searchParams.get('q') ?? '',
      category: searchParams.get('category') ?? '',
      sort: searchParams.get('sort') ?? 'latest',
      location_type: searchParams.get('location_type') ?? '',
      min_price: searchParams.get('min_price') ?? '',
      max_price: searchParams.get('max_price') ?? '',
      min_rating: searchParams.get('min_rating') ?? '',
      city: searchParams.get('city') ?? '',
      page: searchParams.get('page') ?? '1',
    }),
    [searchParams],
  )

  const [searchDraft, setSearchDraft] = useState(filters.q)

  useEffect(() => setSearchDraft(filters.q), [filters.q])

  useEffect(() => {
    api
      .get('/categories')
      .then(({ data }) => setCategories(data.data))
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''))

    if (place) {
      params.near_lat = place.lat
      params.near_lng = place.lng
      params.radius_km = radius
    }

    api
      .get('/services', { params })
      .then(({ data }) => {
        if (cancelled) return
        setServices(data.data)
        setMeta(data.meta)
        // The API widens a term that matches nothing; it says so in `message`.
        setNotice(data.message && data.message !== 'OK' ? data.message : null)
      })
      .catch(() => !cancelled && setError('We could not load services just now.'))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [filters, place, radius])

  /** Changing any filter resets to page 1 — page is only kept when paging. */
  const setFilter = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams)

      Object.entries(patch).forEach(([key, value]) => {
        if (value === '' || value == null) next.delete(key)
        else next.set(key, String(value))
      })

      if (!('page' in patch)) next.delete('page')

      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  // The place filter is counted too, so the Clear button appears whenever
  // anything is actually narrowing the results — including a map location.
  const activeCount =
    ['category', 'location_type', 'min_price', 'max_price', 'min_rating', 'city'].filter(
      (key) => filters[key],
    ).length + (place ? 1 : 0)

  /**
   * Clears the refine panel but keeps whatever the visitor searched for.
   * The map's place filter lives in component state rather than the URL, so
   * it has to be cleared explicitly — forgetting it leaves an invisible
   * location filter still narrowing the results.
   */
  const clearFilters = () => {
    setPlace(null)
    setRadius(25)
    setSearchParams(filters.q ? { q: filters.q } : {}, { replace: true })
  }


  const filterPanel = (
    <div className="space-y-4">
      <Select
        label="Category"
        value={filters.category}
        onChange={(event) => setFilter({ category: event.target.value })}
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.slug}>
            {category.name} ({category.services_count})
          </option>
        ))}
      </Select>

      <Select
        label="Where"
        value={filters.location_type}
        onChange={(event) => setFilter({ location_type: event.target.value })}
      >
        {locationTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </Select>

      <div>
        <p className="mb-1.5 block text-sm font-medium text-ink-soft">Price range (₹)</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={filters.min_price}
            onChange={(event) => setFilter({ min_price: event.target.value })}
            placeholder="Min"
            aria-label="Minimum price"
            className="tabular h-11 w-full rounded-[var(--radius-inner)] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
          />
          <span className="text-muted">–</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={filters.max_price}
            onChange={(event) => setFilter({ max_price: event.target.value })}
            placeholder="Max"
            aria-label="Maximum price"
            className="tabular h-11 w-full rounded-[var(--radius-inner)] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
          />
        </div>
      </div>

      <Select
        label="Minimum rating"
        value={filters.min_rating}
        onChange={(event) => setFilter({ min_rating: event.target.value })}
      >
        <option value="">Any rating</option>
        <option value="4.5">4.5 and above</option>
        <option value="4">4.0 and above</option>
        <option value="3">3.0 and above</option>
      </Select>

      <div>
        <label htmlFor="city-filter" className="mb-1.5 block text-sm font-medium text-ink-soft">
          City
        </label>
        <input
          id="city-filter"
          value={filters.city}
          onChange={(event) => setFilter({ city: event.target.value })}
          placeholder="Bengaluru"
          className="h-11 w-full rounded-[var(--radius-inner)] border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
        />
      </div>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" icon={X} onClick={clearFilters} className="w-full">
          Clear filters
        </Button>
      )}
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <SectionTitle
        eyebrow="The directory"
        title="Find your provider"
        description="Every listing shows real availability. What you see is what you can book."
      />

      {/* Search + sort bar */}
      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setFilter({ q: searchDraft.trim() })
          }}
          className="flex-1"
        >
          <SearchAutocomplete
            value={searchDraft}
            onChange={setSearchDraft}
            onSubmit={(term) => setFilter({ q: term })}
            // Here the term is already committed to the URL and the results,
            // so clearing the box has to drop it as well.
            onClear={() => setFilter({ q: '' })}
            placeholder="Search services…"
            size="lg"
          />
        </form>

        <div className="flex items-center gap-2">
          <select
            value={filters.sort}
            onChange={(event) => setFilter({ sort: event.target.value })}
            aria-label="Sort results"
            className="h-12 flex-1 cursor-pointer rounded-[var(--radius-inner)] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none lg:flex-none"
          >
            {sorts.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>

          <Button
            variant={showMap ? 'primary' : 'secondary'}
            size="lg"
            icon={MapIcon}
            onClick={() => setShowMap((open) => !open)}
            className="shrink-0"
          >
            <span className="hidden sm:inline">Map</span>
          </Button>

          {/* Filters live behind a button on small screens and in a rail on desktop. */}
          <Button
            variant="secondary"
            size="lg"
            icon={SlidersHorizontal}
            onClick={() => setShowFilters((open) => !open)}
            className="shrink-0 lg:hidden"
          >
            {activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
          </Button>
        </div>
      </div>

      {/* Map panel. Its search looks for a place, not a service — choosing one
          flies the map there and narrows the listings below to that area. */}
      {showMap && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <PlaceSearch
              className="flex-1"
              placeholder="Search a city or area to see who is nearby"
              onSelect={setPlace}
              onClear={() => setPlace(null)}
            />

            {place && (
              <div className="flex items-center gap-2">
                <label htmlFor="browse-radius" className="text-xs whitespace-nowrap text-muted">
                  Within
                </label>
                <select
                  id="browse-radius"
                  value={radius}
                  onChange={(event) => setRadius(Number(event.target.value))}
                  className="tabular h-11 cursor-pointer rounded-[var(--radius-inner)] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  {[10, 25, 50, 100].map((option) => (
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

          <ServiceMap
            services={services}
            focus={place ? { ...place, radiusKm: radius } : null}
            onFocusMove={(moved) => setPlace((current) => ({ ...current, ...moved, zoom: undefined }))}
            height={380}
          />
        </div>
      )}

      <div className="mt-6 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        {/* Desktop filter rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <p className="eyebrow mb-4 flex items-center gap-2">
              <Filter size={12} aria-hidden="true" />
              Refine
            </p>
            {filterPanel}
          </div>
        </aside>

        {/* Mobile filter sheet */}
        {showFilters && (
          <div className="mb-6 rounded-[var(--radius-card)] border border-line bg-surface p-5 lg:hidden">
            {filterPanel}
          </div>
        )}

        <div className="min-w-0">
          {meta && !loading && (
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="tabular text-xs text-muted">
                {meta.total} service{meta.total === 1 ? '' : 's'} found
              </p>
              {notice && (
                <p className="rounded-full border border-gold/25 bg-gold-soft px-2.5 py-0.5 text-xs text-gold">
                  {notice}
                </p>
              )}
              {place && (
                <p className="rounded-full border border-accent/25 bg-accent-soft px-2.5 py-0.5 text-xs text-accent-ink">
                  Within <span className="tabular">{radius} km</span> of {place.label}
                </p>
              )}
            </div>
          )}

          {error ? (
            <ErrorState message={error} onRetry={() => setFilter({})} />
          ) : loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <ServiceCardSkeleton key={index} />
              ))}
            </div>
          ) : services.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nothing matched that"
              description={
                place
                  ? `No services within ${radius} km of ${place.label}. Try a wider radius, a different area, or clear the location.`
                  : filters.q
                    ? `No services match “${filters.q}”. Try a broader term, or start over.`
                    : 'Try a broader search, or clear a filter or two.'
              }
              // Message only. Clearing and widening belong in the refine panel
              // and the radius selector, where those controls already live.
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {services.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>

              <Pagination
                meta={meta}
                onPage={(page) => {
                  setFilter({ page })
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="mt-8"
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
