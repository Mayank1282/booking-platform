import { useMemo } from 'react'

/*
  ============================================================================
  Procedural service artwork
  ----------------------------------------------------------------------------
  Most services have no uploaded photo, and a flat block of colour with the
  title centred on it reads as an unfinished placeholder. Instead each service
  gets its own generated mesh-gradient composition — layered radial blooms, a
  soft depth ring and a category glyph — seeded deterministically from the
  service so the same listing always looks the same, while no two look alike.

  Everything is inline SVG: no external assets, no network cost, and it
  recolours itself for dark mode through the palette tokens.
  ============================================================================
*/

/** Small deterministic string hash → 32-bit int. */
function hash(input) {
  let value = 2166136261

  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i)
    value = Math.imul(value, 16777619)
  }

  return Math.abs(value)
}

/** Seeded pseudo-random sequence, so a service's artwork never changes. */
function sequence(seed) {
  let state = seed || 1

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/*
  Each palette is a warm triad drawn from the design system — terracotta,
  gold, sage and clay. Deep enough to give the composition real depth without
  ever straying into the cool blues the rest of the identity avoids.
*/
const palettes = [
  { base: '#FDEBD8', a: '#F0A868', b: '#C2410C', c: '#7C2D12' }, // terracotta
  { base: '#FDF1DC', a: '#EBBF6B', b: '#B45309', c: '#78350F' }, // gold
  { base: '#E3EFEB', a: '#8FBFAE', b: '#4D7C6F', c: '#2F4F47' }, // sage
  { base: '#FBE8E4', a: '#E8A090', b: '#B4462F', c: '#7A2E1E' }, // clay
  { base: '#F6EDE3', a: '#D9AE86', b: '#9A5B2C', c: '#5F3A1B' }, // sand
  { base: '#EDEBE4', a: '#B3AE96', b: '#6F6A52', c: '#453F2E' }, // olive
]

/* Simple geometric glyphs per category — abstract, never literal clipart. */
const glyphs = {
  'wellness-spa': (p) => (
    <g stroke={p.c} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5">
      <path d="M100 40c0 28-18 44-18 60a18 18 0 0 0 36 0c0-16-18-32-18-60Z" />
      <path d="M60 92c14 10 22 24 22 40M140 92c-14 10-22 24-22 40" />
    </g>
  ),
  'hair-beauty': (p) => (
    <g stroke={p.c} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5">
      <circle cx="70" cy="130" r="14" />
      <circle cx="130" cy="130" r="14" />
      <path d="M80 120 138 46M120 120 62 46" />
    </g>
  ),
  'fitness-training': (p) => (
    <g stroke={p.c} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5">
      <path d="M52 76v48M68 62v76M132 62v76M148 76v48M68 100h64" />
    </g>
  ),
  'home-services': (p) => (
    <g stroke={p.c} strokeWidth="2.5" fill="none" strokeLinejoin="round" opacity="0.5">
      <path d="M46 100 100 52l54 48" />
      <path d="M62 96v52h76V96" />
      <path d="M88 148v-30h24v30" />
    </g>
  ),
  photography: (p) => (
    <g stroke={p.c} strokeWidth="2.5" fill="none" opacity="0.5">
      <rect x="46" y="70" width="108" height="72" rx="10" />
      <circle cx="100" cy="106" r="22" />
      <path d="M78 70l10-14h24l10 14" strokeLinejoin="round" />
    </g>
  ),
  consulting: (p) => (
    <g stroke={p.c} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5">
      <path d="M50 140V96M84 140V64M118 140V82M152 140V54" />
      <path d="M42 150h116" />
    </g>
  ),
  tutoring: (p) => (
    <g stroke={p.c} strokeWidth="2.5" fill="none" strokeLinejoin="round" opacity="0.5">
      <path d="M100 54 44 84l56 30 56-30-56-30Z" />
      <path d="M64 98v32c0 10 16 18 36 18s36-8 36-18V98" />
    </g>
  ),
  automotive: (p) => (
    <g stroke={p.c} strokeWidth="2.5" fill="none" strokeLinejoin="round" opacity="0.5">
      <path d="M46 122v-18l14-32h80l14 32v18" />
      <path d="M46 122h108" />
      <circle cx="72" cy="128" r="12" />
      <circle cx="128" cy="128" r="12" />
    </g>
  ),
}

const defaultGlyph = (p) => (
  <g stroke={p.c} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5">
    <circle cx="100" cy="100" r="34" />
    <path d="M100 100V62M100 100l26 18" />
  </g>
)

export default function ServiceArtwork({ service, className = '', showTitle = false }) {
  const art = useMemo(() => {
    const seed = hash(`${service?.slug ?? ''}${service?.id ?? ''}${service?.title ?? ''}`)
    const random = sequence(seed)

    const palette = palettes[seed % palettes.length]

    // Three offset blooms make the surface read as lit from one side rather
    // than as a flat wash.
    const blooms = [
      { x: 18 + random() * 22, y: 20 + random() * 20, r: 52 + random() * 20, fill: palette.a, o: 0.85 },
      { x: 62 + random() * 26, y: 58 + random() * 26, r: 44 + random() * 22, fill: palette.b, o: 0.55 },
      { x: 30 + random() * 46, y: 74 + random() * 18, r: 34 + random() * 18, fill: palette.c, o: 0.3 },
    ]

    // A single large ring, cropped by the frame, adds the sense of a form
    // sitting behind the surface.
    const ring = {
      cx: 20 + random() * 160,
      cy: 20 + random() * 160,
      r: 70 + random() * 50,
      rotate: random() * 360,
    }

    const glyph = glyphs[service?.category?.slug] ?? defaultGlyph
    const id = `art-${seed.toString(36)}`

    return { palette, blooms, ring, glyph, id }
  }, [service])

  const { palette, blooms, ring, glyph, id } = art

  return (
    <div className={`relative isolate overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 200 200"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
        aria-hidden="true"
      >
        <defs>
          {blooms.map((bloom, index) => (
            <radialGradient key={index} id={`${id}-b${index}`}>
              <stop offset="0%" stopColor={bloom.fill} stopOpacity={bloom.o} />
              <stop offset="100%" stopColor={bloom.fill} stopOpacity="0" />
            </radialGradient>
          ))}

          {/* Blur ties the blooms into one continuous mesh. */}
          <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="14" />
          </filter>

          <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width="200" height="200" fill={palette.base} />

        <g filter={`url(#${id}-soft)`}>
          {blooms.map((bloom, index) => (
            <circle
              key={index}
              cx={bloom.x * 2}
              cy={bloom.y * 2}
              r={bloom.r}
              fill={`url(#${id}-b${index})`}
            />
          ))}
        </g>

        {/* Depth ring, deliberately cropped by the frame. */}
        <g transform={`rotate(${ring.rotate} 100 100)`} opacity="0.22">
          <circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke={palette.c} strokeWidth="1.2" />
          <circle
            cx={ring.cx}
            cy={ring.cy}
            r={ring.r * 0.62}
            fill="none"
            stroke={palette.c}
            strokeWidth="0.8"
          />
        </g>

        {glyph(palette)}

        {/* Glass sheen across the top-left, the light source for the tile. */}
        <rect width="200" height="200" fill={`url(#${id}-sheen)`} />
      </svg>

      {/* Paper grain keeps the large soft areas from banding. */}
      <span className="grain pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden="true" />

      {showTitle && (
        <div className="absolute inset-0 flex items-end p-5">
          <h3 className="font-display text-2xl leading-tight font-semibold text-[#3B1D0C] drop-shadow-sm sm:text-3xl">
            {service?.title}
          </h3>
        </div>
      )}
    </div>
  )
}
