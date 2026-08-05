import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, MapPin, Search, Sparkles, Store, Tag, X } from 'lucide-react'
import api from '@/lib/api'

/*
  Typeahead for the marketplace search box.

  Visitors type what they call the thing ("hairstyle"), not what the catalogue
  calls it ("Signature Haircut & Style"), and a plain LIKE search on that
  returns nothing. Offering the catalogue's own vocabulary as you type is what
  turns a dead end into a booking.
*/
const icons = {
  service: Sparkles,
  category: Tag,
  city: MapPin,
  provider: Store,
}

const groupLabels = {
  service: 'Services',
  category: 'Categories',
  city: 'Places',
  provider: 'Providers',
}

export default function SearchAutocomplete({
  value,
  onChange,
  onSubmit,
  // Called when the inline × is pressed. Clearing only empties the input by
  // default — a page that has already committed the term to its results (the
  // directory) passes this to reset that too. The home page deliberately does
  // not, because there "submit an empty search" means navigate away.
  onClear,
  placeholder = 'Massage, haircut, personal trainer…',
  size = 'md',
  className = '',
  autoFocus = false,
}) {
  const navigate = useNavigate()
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [matchedTerm, setMatchedTerm] = useState(null)
  const inputRef = useRef(null)

  const containerRef = useRef(null)
  const abortRef = useRef(null)
  const listId = useId()

  // Debounced so a fast typist fires one request, not one per keystroke.
  useEffect(() => {
    const term = value.trim()

    // Suggest from the very first character, the way a search box should.
    if (term.length < 1) {
      setSuggestions([])
      setMatchedTerm(null)
      setOpen(false)
      return
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)

      api
        .get('/search/suggestions', { params: { q: term }, signal: controller.signal })
        .then(({ data }) => {
          setSuggestions(data.data.suggestions)
          setMatchedTerm(data.data.matched_term ?? null)
          setOpen(data.data.suggestions.length > 0)
          setHighlighted(-1)
        })
        .catch(() => {
          // A failed suggestion lookup must never block the actual search.
          setSuggestions([])
        })
        .finally(() => setLoading(false))
    }, 220)

    return () => clearTimeout(timer)
  }, [value])

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const choose = (suggestion) => {
    setOpen(false)
    setHighlighted(-1)

    // A service is a specific thing — go straight to it. Everything else is a
    // way of narrowing the directory.
    if (suggestion.type === 'service') {
      navigate(`/services/${suggestion.slug}`)
      return
    }

    if (suggestion.type === 'category') {
      onChange('')
      navigate(`/services?category=${encodeURIComponent(suggestion.slug)}`)
      return
    }

    if (suggestion.type === 'city') {
      onChange('')
      navigate(`/services?city=${encodeURIComponent(suggestion.slug)}`)
      return
    }

    onChange(suggestion.query)
    onSubmit?.(suggestion.query)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()

      if (open && highlighted >= 0) choose(suggestions[highlighted])
      else {
        setOpen(false)
        onSubmit?.(value.trim())
      }

      return
    }

    if (!open || suggestions.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((index) => (index - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const height = size === 'lg' ? 'h-12' : 'h-11'

  // Insert a small heading whenever the result type changes.
  let lastType = null

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search
          size={size === 'lg' ? 17 : 16}
          className="absolute top-1/2 left-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Search services"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          className={`${height} w-full rounded-[var(--radius-inner)] border border-line-strong bg-surface pr-10 pl-11 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none`}
        />
        {loading ? (
          <Loader2
            size={15}
            className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-accent"
            aria-hidden="true"
          />
        ) : (
          value && (
            <button
              type="button"
              onClick={() => {
                onChange('')
                setSuggestions([])
                setMatchedTerm(null)
                setOpen(false)
                onClear?.()
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-sunk hover:text-ink"
            >
              <X size={15} />
            </button>
          )
        )}
      </div>

      {/* Tells the visitor when their term was widened to find anything. */}
      {matchedTerm && !open && (
        <p className="mt-1.5 text-xs text-muted">
          Showing results for “<span className="text-ink">{matchedTerm}</span>”
        </p>
      )}

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="animate-rise absolute top-full right-0 left-0 z-50 mt-1.5 max-h-80 overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface py-1 shadow-[var(--shadow-pop)]"
        >
          {suggestions.map((suggestion, index) => {
            const Icon = icons[suggestion.type] ?? Sparkles
            const showHeading = suggestion.type !== lastType
            lastType = suggestion.type

            return (
              <li key={`${suggestion.type}-${suggestion.slug}-${index}`}>
                {showHeading && (
                  <p className="eyebrow px-3 pt-2.5 pb-1">{groupLabels[suggestion.type]}</p>
                )}
                <button
                  type="button"
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === highlighted}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => choose(suggestion)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                    index === highlighted ? 'bg-accent-soft' : 'hover:bg-surface-sunk'
                  }`}
                >
                  <Icon
                    size={15}
                    className={`shrink-0 ${index === highlighted ? 'text-accent' : 'text-muted'}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{suggestion.label}</span>
                  {suggestion.hint && (
                    <span className="shrink-0 text-xs text-muted">{suggestion.hint}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
