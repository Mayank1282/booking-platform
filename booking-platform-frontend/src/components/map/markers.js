import L from 'leaflet'

/*
  Leaflet's default marker images break under bundlers because they are
  resolved relative to the CSS. Drawing the pin as a divIcon avoids the issue
  entirely and lets the marker inherit the warm palette.
*/
const pinSvg = (fill, stroke) => `
  <svg viewBox="0 0 24 32" width="26" height="34" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.7 0 .6 5.1.6 11.4.6 20 12 32 12 32s11.4-12 11.4-20.6C23.4 5.1 18.3 0 12 0Z"
          fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <circle cx="12" cy="11.2" r="4" fill="#fff"/>
  </svg>`

const makeIcon = (fill, stroke, className) =>
  L.divIcon({
    html: pinSvg(fill, stroke),
    className: `slotwise-pin ${className}`,
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -32],
  })

export const providerPin = makeIcon('#c2410c', '#7c2d12', 'pin-provider')
export const activePin = makeIcon('#4d7c6f', '#2f4f47', 'pin-active')
export const pickerPin = makeIcon('#b45309', '#7c3d06', 'pin-picker')
