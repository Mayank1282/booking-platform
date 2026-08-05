import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'

/**
 * Google-Maps-style address autocomplete over Nominatim.
 *
 * Nominatim's usage policy asks for at most one request per second, so input
 * is debounced and every in-flight request is aborted when the query moves on.
 * Results show the place name, the rest of the address and the postcode, and
 * the list is fully keyboard navigable.
 */
export default function AddressAutocomplete({ onSelect, placeholder = 'Search an address, area or landmark' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [error, setError] = useState(null)

  const abortRef = useRef(null)
  const containerRef = useRef(null)
  const listId = useId()

  // Debounced lookup. Anything under three characters is too vague to spend a
  // request on.
  useEffect(() => {
    const term = query.trim()

    // Suggest from the first character, matching the map search.
    if (term.length < 1) {
      setResults([])
      setOpen(false)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.searchParams.set('q', term)
      url.searchParams.set('format', 'json')
      url.searchParams.set('addressdetails', '1')
      url.searchParams.set('limit', '12')

      fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
        .then((response) => {
          if (!response.ok) throw new Error('Lookup failed')
          return response.json()
        })
        .then((data) => {
          setResults(data)
          setOpen(true)
          setHighlighted(-1)
        })
        .catch((fetchError) => {
          if (fetchError.name !== 'AbortError') {
            setError('Address lookup is unavailable — drop the pin on the map instead.')
            setResults([])
          }
        })
        .finally(() => setLoading(false))
    }, 450)

    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => () => abortRef.current?.abort(), [])

  // Clicking anywhere else dismisses the list.
  useEffect(() => {
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const choose = (result) => {
    const address = result.address ?? {}

    onSelect({
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      address_line:
        [address.house_number, address.road, address.neighbourhood, address.suburb]
          .filter(Boolean)
          .join(', ') || result.name || result.display_name,
      city: address.city ?? address.town ?? address.village ?? address.municipality ?? address.state_district ?? '',
      state: address.state ?? '',
      country: address.country ?? '',
      postal_code: address.postcode ?? '',
    })

    setQuery(primaryLabel(result))
    setOpen(false)
    setHighlighted(-1)
  }

  const onKeyDown = (event) => {
    // This input lives inside the settings form. Enter must never bubble up
    // and submit it — that is a page reload in the middle of picking a place.
    if (event.key === 'Enter') {
      event.preventDefault()
      if (open && highlighted >= 0) choose(results[highlighted])
      else if (open && results.length === 1) choose(results[0])
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
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search for an address"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
          autoComplete="off"
          className="h-11 w-full rounded-[var(--radius-inner)] border border-line-strong bg-surface pr-10 pl-9 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
        />
        {loading && (
          <Loader2
            size={15}
            className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-accent"
            aria-hidden="true"
          />
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="animate-rise absolute top-full right-0 left-0 z-[500] mt-1.5 max-h-[22rem] overflow-y-auto overscroll-contain rounded-[var(--radius-card)] border border-line bg-surface py-1 shadow-[var(--shadow-pop)]"
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">No matches. Try a nearby landmark.</li>
          ) : (
            results.map((result, index) => (
              <li key={result.place_id} id={`${listId}-${index}`} role="option" aria-selected={index === highlighted}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => choose(result)}
                  className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                    index === highlighted ? 'bg-accent-soft' : 'hover:bg-surface-sunk'
                  }`}
                >
                  <MapPin
                    size={15}
                    className={`mt-0.5 shrink-0 ${index === highlighted ? 'text-accent' : 'text-muted'}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{primaryLabel(result)}</span>
                    <span className="block truncate text-xs text-muted">{secondaryLabel(result)}</span>
                  </span>
                  {result.address?.postcode && (
                    <span className="tabular ml-auto shrink-0 self-center rounded-full border border-line bg-surface-sunk px-2 py-0.5 text-[0.6875rem] text-ink-soft">
                      {result.address.postcode}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {error && <p className="mt-1.5 text-xs text-rose">{error}</p>}
    </div>
  )
}

/* Nominatim's display_name is a long comma-joined string; split it into a
   headline and the rest so the list stays scannable. */
const primaryLabel = (result) => result.name || result.display_name.split(',')[0]

const secondaryLabel = (result) => {
  const parts = result.display_name.split(',').map((part) => part.trim())
  const head = result.name ? parts : parts.slice(1)

  return head.filter(Boolean).slice(0, 4).join(', ')
}
