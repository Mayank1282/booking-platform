import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, MapPin, Navigation, Search, X } from 'lucide-react'

/**
 * Google-Maps-style place search for the map views.
 *
 * The marketplace search box looks inside our own catalogue; this one looks at
 * the world. Typing "Lon" offers London the way Maps does, and choosing a
 * result flies the map there and narrows the listings to that area.
 *
 * Backed by Nominatim (free, key-less). Its usage policy asks for at most one
 * request a second, so input is debounced and in-flight requests are aborted.
 */
export default function PlaceSearch({ onSelect, onClear, placeholder = 'Search a city, area or landmark', className = '' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [locating, setLocating] = useState(false)

  const containerRef = useRef(null)
  const abortRef = useRef(null)
  const listId = useId()

  useEffect(() => {
    const term = query.trim()

    // Suggest from the first character, the way Maps does.
    if (term.length < 1) {
      setResults([])
      setOpen(false)
      return
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)

      const url = new URL('https://photon.komoot.io/api/')
      url.searchParams.set('q', term)
      // The list scrolls, so a fuller set costs nothing and greatly improves
      // the chance the right place is in it.
      url.searchParams.set('limit', '10')

      fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error('lookup failed'))))
        .then((data) => {
          const places = (data.features ?? []).map(toPlace)
          setResults(places)
          setOpen(places.length > 0)
          setHighlighted(-1)
        })
        .catch((error) => {
          if (error.name !== 'AbortError') setResults([])
        })
        .finally(() => setLoading(false))
    }, 350)

    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const choose = (place) => {
    setQuery(place.label)
    setOpen(false)
    setHighlighted(-1)

    onSelect({ lat: place.lat, lng: place.lng, label: place.label, zoom: place.zoom })
  }

  const clear = () => {
    setQuery('')
    setResults([])
    setOpen(false)
    onClear?.()
  }

  /** Browser geolocation, the equivalent of Maps' "your location" button. */
  const useMyLocation = () => {
    if (!navigator.geolocation) return

    setLocating(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        setQuery('My location')
        onSelect({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: 'My location',
          zoom: 13,
        })
      },
      () => setLocating(false),
      { timeout: 8000 },
    )
  }

  const onKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (open && highlighted >= 0) choose(results[highlighted])
      else if (open && results.length > 0) choose(results[0])
      return
    }

    if (!open || results.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((index) => (index + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((index) => (index - 1 + results.length) % results.length)
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search for a place"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          className="h-11 w-full rounded-[var(--radius-inner)] border border-line-strong bg-surface pr-20 pl-9 text-sm text-ink placeholder:text-muted/70 shadow-[var(--shadow-lift)] focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
        />

        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
          {loading && <Loader2 size={14} className="animate-spin text-accent" aria-hidden="true" />}

          {query && !loading && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear place search"
              className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-sunk hover:text-ink"
            >
              <X size={15} />
            </button>
          )}

          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            aria-label="Use my location"
            title="Use my location"
            className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-50"
          >
            {locating ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />}
          </button>
        </div>
      </div>

      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          // Scrolls inside itself so a long result set never grows the page.
          className="animate-rise absolute top-full right-0 left-0 z-[1000] mt-1.5 max-h-[22rem] overflow-y-auto overscroll-contain rounded-[var(--radius-card)] border border-line bg-surface py-1 shadow-[var(--shadow-pop)]"
        >
          {results.map((place, index) => (
            <li key={place.id} role="option" aria-selected={index === highlighted}>
              <button
                type="button"
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(place)}
                className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  index === highlighted ? 'bg-accent-soft' : 'hover:bg-surface-sunk'
                }`}
              >
                <MapPin
                  size={15}
                  className={`mt-0.5 shrink-0 ${index === highlighted ? 'text-accent' : 'text-muted'}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{place.label}</span>
                  <span className="block truncate text-xs text-muted">{place.context}</span>
                </span>
                {place.postcode && (
                  <span className="tabular shrink-0 self-center rounded-full border border-line bg-surface-sunk px-2 py-0.5 text-[0.6875rem] text-ink-soft">
                    {place.postcode}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Photon returns GeoJSON features. Flatten one into the shape this component
 * and the map both use.
 */
function toPlace(feature) {
  const p = feature.properties ?? {}
  const [lng, lat] = feature.geometry?.coordinates ?? []

  const label = p.name || [p.street, p.city].filter(Boolean).join(', ') || p.country || 'Unknown place'

  // Everything below the name, so the visitor can tell two Londons apart.
  const context = [p.street && p.street !== p.name ? p.street : null, p.district, p.city, p.state, p.country]
    .filter((part, index, all) => part && all.indexOf(part) === index && part !== label)
    .slice(0, 3)
    .join(', ')

  return {
    id: `${p.osm_type ?? 'x'}${p.osm_id ?? Math.random()}`,
    label,
    context,
    postcode: p.postcode ?? null,
    lat,
    lng,
    zoom: zoomFor(p),
  }
}

/** A country should zoom out; a building should zoom right in. */
function zoomFor(p) {
  const kind = p.osm_value ?? p.type

  if (kind === 'country') return 5
  if (['state', 'region', 'province'].includes(kind)) return 7
  if (['county', 'city', 'municipality'].includes(kind)) return 11
  if (['town', 'suburb', 'city_district', 'village', 'borough'].includes(kind)) return 13

  return 15
}
