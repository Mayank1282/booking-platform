import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

/*
  A category tile with a surface of its own.

  The previous version was an outlined glyph and two lines of text on bare
  paper — restrained to the point of looking unfinished. This gives each
  category a tinted field and an oversized watermark of its own icon, so the
  row reads as six distinct destinations rather than a list.

  The tints are muted and drawn from the same warm family as the rest of the
  palette, so this adds presence without turning the page into a colour chart.
*/
const TINTS = {
  'wellness-spa': { from: '#E8EFEA', to: '#F5F7F4', ink: '#3F5C4B' },
  'hair-beauty': { from: '#F7EAE4', to: '#FBF4F0', ink: '#8A3F28' },
  'fitness-training': { from: '#EAE8E2', to: '#F6F5F1', ink: '#4A463D' },
  'home-services': { from: '#F5EEDF', to: '#FAF6EE', ink: '#7A5F2A' },
  photography: { from: '#EDE9E4', to: '#F7F5F2', ink: '#514A42' },
  consulting: { from: '#F2E9E5', to: '#F9F4F1', ink: '#6D3B2A' },
  tutoring: { from: '#EDEEE4', to: '#F7F8F1', ink: '#565B3C' },
  automotive: { from: '#E9EAEC', to: '#F5F6F7', ink: '#454A52' },
}

const DEFAULT_TINT = { from: '#F0EDE7', to: '#F9F7F4', ink: '#4A463D' }

const DARK_SURFACE = 'rgb(255 255 255 / 0.04)'

export default function CategoryTile({ category, icon: Icon }) {
  const tint = TINTS[category.slug] ?? DEFAULT_TINT

  return (
    <Link
      to={`/services?category=${category.slug}`}
      className="group relative flex aspect-[5/6] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] border border-line p-5 transition-all duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-[var(--shadow-lift)]"
      style={{ backgroundImage: `linear-gradient(160deg, ${tint.from}, ${tint.to})` }}
    >
      {/* In dark mode the light tints would glare, so a translucent veil sits
          over them and the surface reads as a dim panel instead. */}
      <span
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{ background: 'var(--color-surface)', opacity: 0.92 }}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{ background: DARK_SURFACE }}
        aria-hidden="true"
      />

      {/* Oversized watermark, cropped by the corner. */}
      <Icon
        size={132}
        strokeWidth={0.7}
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -bottom-8 opacity-[0.09] transition-transform duration-500 group-hover:scale-110 dark:opacity-[0.14]"
        style={{ color: tint.ink }}
      />

      <span className="relative flex items-start justify-between">
        <span
          className="flex size-9 items-center justify-center rounded-full bg-white/70 dark:bg-white/10"
          style={{ color: tint.ink }}
        >
          <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <ArrowUpRight
          size={15}
          aria-hidden="true"
          className="text-muted opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
        />
      </span>

      <span className="relative">
        <span className="block text-[0.9375rem] leading-snug tracking-tight text-ink">
          {category.name}
        </span>
        <span className="tabular mt-1.5 block text-[0.625rem] tracking-[0.18em] text-muted uppercase">
          {category.services_count} service{category.services_count === 1 ? '' : 's'}
        </span>
      </span>
    </Link>
  )
}
