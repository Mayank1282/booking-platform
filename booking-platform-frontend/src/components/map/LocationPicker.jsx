import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import AddressAutocomplete from './AddressAutocomplete'
import { pickerPin } from './markers'

function ClickHandler({ onPick }) {
  useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
  })

  return null
}

/**
 * Wheel zooms while the pointer is over the map, and scrolls the page
 * otherwise — the same contract as the directory and explore maps, so the
 * behaviour is consistent everywhere a map appears.
 */
function HoverZoom() {
  const map = useMap()

  useEffect(() => {
    map.scrollWheelZoom.disable()

    const enable = () => map.scrollWheelZoom.enable()
    const disable = () => map.scrollWheelZoom.disable()

    map.on('mouseover', enable)
    map.on('focus', enable)
    map.on('mouseout', disable)
    map.on('blur', disable)

    return () => {
      map.off('mouseover', enable)
      map.off('focus', enable)
      map.off('mouseout', disable)
      map.off('blur', disable)
      map.scrollWheelZoom.disable()
    }
  }, [map])

  return null
}

function Recenter({ position }) {
  const map = useMap()

  useEffect(() => {
    if (position) map.setView(position, Math.max(map.getZoom(), 15))
  }, [map, position])

  return null
}

/**
 * Address picker for the provider settings screen. Search is a live
 * autocomplete over Nominatim (free, key-less); choosing a result fills the
 * address fields and moves the pin, which can then be dragged to fine-tune.
 */
export default function LocationPicker({ latitude, longitude, onChange, onAddressFound }) {
  // Falls back to the centre of India until the provider picks a point.
  const position = latitude != null && longitude != null ? [Number(latitude), Number(longitude)] : null
  const center = position ?? [20.5937, 78.9629]

  const handleSelect = ({ latitude: lat, longitude: lng, ...address }) => {
    onChange(lat, lng)
    onAddressFound?.(address)
  }

  return (
    <div className="space-y-3">
      <AddressAutocomplete onSelect={handleSelect} />

      <div className="h-72 overflow-hidden rounded-[var(--radius-card)] border border-line">
        <MapContainer center={center} zoom={position ? 15 : 4} className="size-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <HoverZoom />
          <ClickHandler onPick={onChange} />
          <Recenter position={position} />
          {position && (
            <Marker
              position={position}
              icon={pickerPin}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const { lat, lng } = event.target.getLatLng()
                  onChange(lat, lng)
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <p className="text-xs text-muted">
        Start typing to search, or tap the map to drop the pin. Drag it to fine-tune.
        {position && (
          <span className="tabular ml-1 text-ink-soft">
            {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
          </span>
        )}
      </p>
    </div>
  )
}
