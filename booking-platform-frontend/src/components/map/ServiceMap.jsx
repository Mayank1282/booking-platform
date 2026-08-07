import { useEffect, useState } from 'react'
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { money } from '@/lib/format'
import { Rating } from '@/components/ui/Misc'
import { activePin, pickerPin, providerPin } from './markers'

/**
 * Refits the viewport to the visible pins — but only until the visitor takes
 * control by searching for a place, at which point refitting would yank the
 * map away from where they just asked to go.
 */
function FitBounds({ points, enabled }) {
  const map = useMap()

  useEffect(() => {
    if (!enabled || !points.length) return

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13)
      return
    }

    map.fitBounds(
      points.map((point) => [point.lat, point.lng]),
      { padding: [48, 48], maxZoom: 14 },
    )
  }, [map, points, enabled])

  return null
}

/**
 * Scroll-wheel zoom while the pointer is over the map, page scroll everywhere
 * else.
 *
 * A map that always captures the wheel traps the page — you scroll past it and
 * end up zoomed into an ocean instead of reading on. Binding to hover gives
 * the expected result without demanding a click first: the wheel zooms where
 * the cursor is, which is where the intent is.
 */
function ScrollZoomGuard({ onActiveChange }) {
  const map = useMap()

  useEffect(() => {
    map.scrollWheelZoom.disable()

    const enable = () => {
      map.scrollWheelZoom.enable()
      onActiveChange?.(true)
    }

    const disable = () => {
      map.scrollWheelZoom.disable()
      onActiveChange?.(false)
    }

    // Hover drives it; focus is kept so keyboard users get the same control.
    map.on('mouseover', enable)
    map.on('focus', enable)
    map.on('mouseout', disable)
    map.on('blur', disable)

    return () => {
      map.off('mouseover', enable)
      map.off('focus', enable)
      map.off('mouseout', disable)
      map.off('blur', disable)
      // Leave the map as we found it if it unmounts mid-hover.
      map.scrollWheelZoom.disable()
    }
  }, [map, onActiveChange])

  return null
}

/**
 * Animates to a place chosen from the search box.
 *
 * Only fires when a zoom level is supplied, which marks the change as coming
 * from a search rather than from the visitor dragging the pin — flying the map
 * mid-drag would fight the gesture.
 */
function FlyTo({ focus }) {
  const map = useMap()
  const lat = focus?.lat
  const lng = focus?.lng
  const zoom = focus?.zoom

  useEffect(() => {
    if (lat == null || lng == null || zoom == null) return

    map.flyTo([lat, lng], zoom, { duration: 0.9 })
  }, [map, lat, lng, zoom])

  return null
}

/**
 * OpenStreetMap tiles via Leaflet — no API key, no billing account, no quota,
 * which is why this is used instead of Google Maps.
 */
export default function ServiceMap({
  services = [],
  activeId = null,
  onSelect,
  className = '',
  height = 460,
  focus = null,
  onFocusMove,
}) {
  const [zoomActive, setZoomActive] = useState(false)

  const points = services
    .filter((service) => service.location?.latitude != null && service.location?.longitude != null)
    .map((service) => ({
      id: service.id,
      slug: service.slug,
      title: service.title,
      price: service.pricing?.total ?? service.price,
      currency: service.currency,
      rating: service.rating_avg,
      ratingCount: service.rating_count,
      provider: service.provider?.provider_profile?.business_name ?? service.provider?.name,
      address: service.location.formatted_address,
      lat: Number(service.location.latitude),
      lng: Number(service.location.longitude),
    }))

  // With a place in focus the map still has a job to do even when nothing is
  // nearby — it has to show the visitor where they searched.
  if (!points.length && !focus) {
    return (
      <div
        className={`flex items-center justify-center rounded-[var(--radius-card)] border border-line bg-surface-sunk text-sm text-muted ${className}`}
        style={{ height }}
      >
        No mappable locations — remote services do not appear here.
      </div>
    )
  }

  const center = points.length ? [points[0].lat, points[0].lng] : [focus.lat, focus.lng]

  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius-card)] border border-line ${className}`}
      style={{ height }}
    >
      {/* Confirms the wheel is now zooming rather than scrolling the page. */}
      {zoomActive && (
        <p className="animate-rise pointer-events-none absolute bottom-3 left-1/2 z-[500] -translate-x-1/2 rounded-full border border-line bg-surface/90 px-3 py-1.5 text-xs text-muted shadow-[var(--shadow-lift)] backdrop-blur-sm">
          Scroll to zoom · move off the map to scroll the page
        </p>
      )}

      <MapContainer
        center={center}
        zoom={focus?.zoom ?? 12}
        // Enabled by ScrollZoomGuard only once the map is engaged, so the
        // page keeps scrolling normally until then.
        scrollWheelZoom={false}
        className="size-full"
      >
        <ScrollZoomGuard onActiveChange={setZoomActive} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} enabled={!focus} />
        <FlyTo focus={focus} />

        {/* The searched place: a radius ring plus a draggable pin. Dragging
            the pin (or clicking the map) re-centres the search, so a visitor
            can nudge it to the exact area they mean without retyping. */}
        {focus && (
          <>
            <Circle
              center={[focus.lat, focus.lng]}
              radius={(focus.radiusKm ?? 25) * 1000}
              pathOptions={{
                color: 'var(--color-accent)',
                weight: 1.5,
                fillColor: 'var(--color-accent)',
                fillOpacity: 0.06,
              }}
            />

            <Marker
              position={[focus.lat, focus.lng]}
              icon={pickerPin}
              draggable={Boolean(onFocusMove)}
              zIndexOffset={1000}
              eventHandlers={{
                dragend: (event) => {
                  const { lat, lng } = event.target.getLatLng()
                  onFocusMove?.({ lat, lng, label: 'Custom location' })
                },
              }}
            >
              <Popup>
                <p className="text-sm font-medium text-ink">{focus.label}</p>
                {onFocusMove && (
                  <p className="mt-1 text-xs text-muted">Drag this pin to search a different spot.</p>
                )}
              </Popup>
            </Marker>
          </>
        )}

        {points.map((point) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={point.id === activeId ? activePin : providerPin}
            eventHandlers={{ click: () => onSelect?.(point.id) }}
          >
            <Popup>
              <p className="eyebrow mb-1">{point.provider}</p>
              <Link
                to={`/services/${point.slug}`}
                className="block font-display text-base font-semibold text-ink hover:text-accent"
              >
                {point.title}
              </Link>
              {point.address && <p className="mt-1 text-xs text-muted">{point.address}</p>}
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="tabular text-sm font-semibold text-accent">
                  {money(point.price, point.currency)}
                </span>
                <Rating value={point.rating} count={point.ratingCount} size={12} />
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
