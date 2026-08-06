import { Link } from 'react-router-dom'
import { ArrowUpRight, Clock, MapPin, Video } from 'lucide-react'
import { duration, money } from '@/lib/format'
import { Avatar, Rating } from '@/components/ui/Misc'
import ServiceArtwork from '@/components/ServiceArtwork'

/**
 * Marketplace listing card. Services without a photo get generated
 * mesh-gradient artwork rather than an empty coloured block, so a card always
 * has something to look at.
 */
export default function ServiceCard({ service, className = '' }) {
  const profile = service.provider?.provider_profile
  const isRemote = service.location_type === 'remote'
  const city = service.location?.city

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface transition-all duration-200 hover:-translate-y-1 hover:border-line-strong hover:shadow-[var(--shadow-pop)] ${className}`}
    >
      <Link to={`/services/${service.slug}`} className="relative block overflow-hidden">
        <div className="relative aspect-[16/10] overflow-hidden">
          {service.image_url ? (
            <img
              src={service.image_url}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <ServiceArtwork
              service={service}
              className="size-full transition-transform duration-500 group-hover:scale-[1.04]"
            />
          )}

          {/* Category and price float over the artwork, so the eye gets the
              two facts that matter before reading anything. Built from theme
              tokens rather than fixed colours, so they follow dark mode. */}
          <span className="absolute top-3 left-3 rounded-full border border-line/60 bg-surface/85 px-2.5 py-1 text-[0.6875rem] font-medium text-ink-soft backdrop-blur-md">
            {service.category?.name}
          </span>

          <span className="tabular absolute right-3 bottom-3 rounded-full border border-line/60 bg-surface/90 px-2.5 py-1 text-sm font-medium text-accent-ink backdrop-blur-md">
            {money(service.price, service.currency)}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-base leading-snug font-semibold text-ink">
            <Link to={`/services/${service.slug}`} className="hover:text-accent">
              {service.title}
            </Link>
          </h3>
          <ArrowUpRight
            size={16}
            className="mt-0.5 shrink-0 text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 group-hover:text-accent"
            aria-hidden="true"
          />
        </div>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{service.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} aria-hidden="true" />
            <span className="tabular">{duration(service.duration_minutes)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            {isRemote ? <Video size={13} aria-hidden="true" /> : <MapPin size={13} aria-hidden="true" />}
            {isRemote ? 'Online' : (city ?? service.location_label)}
          </span>
        </div>

        {/* Provider row is pinned to the bottom so cards of differing text
            length still line up along a shared baseline. */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar
              name={profile?.business_name ?? service.provider?.name}
              src={service.provider?.avatar_url}
              size={26}
            />
            <span className="truncate text-xs text-ink-soft">
              {profile?.business_name ?? service.provider?.name}
            </span>
          </div>
          <Rating value={service.rating_avg} count={service.rating_count} size={12} />
        </div>
      </div>
    </article>
  )
}

/** Matching skeleton so the grid does not jump when results land. */
export function ServiceCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="aspect-[16/10] animate-pulse bg-surface-sunk" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-sunk" />
        <div className="h-3 w-full animate-pulse rounded bg-surface-sunk" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-sunk" />
        <div className="h-8 w-full animate-pulse rounded bg-surface-sunk" />
      </div>
    </div>
  )
}
