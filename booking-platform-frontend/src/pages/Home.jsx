import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Camera,
  Car,
  Dumbbell,
  Flower2,
  GraduationCap,
  House,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import ServiceCard, { ServiceCardSkeleton } from '@/components/ServiceCard'
import SearchAutocomplete from '@/components/SearchAutocomplete'
import Ambient from '@/components/three/Ambient'
import BookingPreview from '@/components/BookingPreview'
import CategoryTile from '@/components/CategoryTile'
import { SectionTitle } from '@/components/ui/Misc'

/*
  Categories carry a Lucide icon name from the backend. They are mapped
  explicitly rather than resolved off a namespace import, because
  `import * as Icons` pulls the whole icon set into the bundle.
*/
const categoryIcons = {
  'flower-2': Flower2,
  scissors: Scissors,
  dumbbell: Dumbbell,
  house: House,
  camera: Camera,
  briefcase: Briefcase,
  'graduation-cap': GraduationCap,
  car: Car,
}

const iconFor = (name) => categoryIcons[name] ?? Sparkles

const money = (value, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    Number(value ?? 0),
  )

/**
 * Picks the four bookings shown in the hero carousel.
 *
 * With a large enough catalogue the four are drawn at random on each load, so
 * the home page is not the same every visit. Below that threshold there is no
 * meaningful variety to shuffle, so the most popular are shown in order.
 *
 * These are public listings, not real client bookings — a marketing panel on a
 * public page must never expose who booked what.
 */
function pickHeroBookings(services) {
  if (!services?.length) return null

  const pool = services.length > 5 ? [...services].sort(() => Math.random() - 0.5) : services

  return pool.slice(0, 4).map((service) => ({
    title: service.title,
    provider: service.provider?.provider_profile?.business_name ?? service.provider?.name ?? '',
    price: money(service.pricing?.total ?? service.price, service.currency),
  }))
}

export default function Home() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState([])
  const [featured, setFeatured] = useState([])
  const [heroBookings, setHeroBookings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      api.get('/categories'),
      api.get('/services', { params: { sort: 'rating', per_page: 6 } }),
      // A wider pull purely for the hero carousel, so there is a pool to
      // choose from rather than always the same top few.
      api.get('/services', { params: { sort: 'popular', per_page: 24 } }),
    ])
      .then(([categoryRes, serviceRes, poolRes]) => {
        if (cancelled) return
        setCategories(categoryRes.data.data.filter((c) => c.services_count > 0))
        setFeatured(serviceRes.data.data)
        setHeroBookings(pickHeroBookings(poolRes.data.data))
      })
      .catch(() => {
        // The hero and static sections still render — a failed fetch just
        // leaves the two dynamic rails empty rather than blanking the page.
      })
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [])

  const runSearch = (term) => {
    const value = (term ?? query).trim()
    navigate(value ? `/services?q=${encodeURIComponent(value)}` : '/services')
  }

  const handleSearch = (event) => {
    event.preventDefault()
    runSearch()
  }

  return (
    <>
      {/* ---------------------------------------------------------------
          Asymmetric editorial hero: oversized serif headline on the left,
          an offset stat panel on the right. Stacks on mobile.
      ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden">
        {/* Full-bleed 3D background. It has no silhouette and fades to the
            page colour at every edge, so it behaves like atmosphere rather
            than an object sitting behind the words. */}
        {/* A very faint wash tying the framed artwork into the page. The panel
            carries the visual weight; this only stops the surrounding paper
            looking cut out. */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_78%_28%,var(--color-accent-soft),transparent_70%)] opacity-70"
          aria-hidden="true"
        />

        <div className="shell grid gap-16 pt-20 pb-24 lg:grid-cols-12 lg:gap-12 lg:pt-32 lg:pb-36">
          <div className="lg:col-span-7">
            <p className="eyebrow">Booking marketplace · India</p>

            {/* Set large and light. The restraint is the point — one italic
                phrase in the accent is the only colour in the whole block. */}
            <h1 className="mt-8 text-[3rem] text-ink sm:text-[4.5rem] lg:text-[5.5rem]">
              Book someone
              <br />
              <span className="text-accent italic">genuinely good</span>
              <br />
              at a time that suits.
            </h1>

            <p className="mt-10 max-w-md text-base leading-[1.7] text-muted">
              Real availability from real providers — wellness, beauty, fitness and home services.
              Pick a slot, pay securely, and get a confirmation in seconds.
            </p>

            <form onSubmit={handleSearch} className="mt-10 flex max-w-lg flex-col gap-2 sm:flex-row">
              <SearchAutocomplete
                value={query}
                onChange={setQuery}
                onSubmit={runSearch}
                size="lg"
                className="flex-1"
              />
              <Button type="submit" size="lg" iconRight={ArrowRight}>
                Search
              </Button>
            </form>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={13} aria-hidden="true" />
                Secure payments
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Star size={13} aria-hidden="true" />
                Verified reviews
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles size={13} aria-hidden="true" />
                Free cancellation up to 24h
              </span>
            </div>
          </div>

          {/* The artwork. Framed in its own panel so it reads as an image on
              the page rather than a shape floating behind the words — and so
              it can carry real colour without touching the headline. */}
          <div className="lg:col-span-5">
            <figure className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-sunk shadow-[var(--shadow-pop)]">
              <div className="relative aspect-[4/5] w-full">
                {/* Colour field behind, schedule in front — the field gives
                    the panel depth, the schedule gives it meaning. */}
                <Ambient
                  contained
                  intensity={0.75}
                  minWidth={0}
                  className="absolute inset-0"
                  fallbackClassName="bg-gradient-to-br from-accent-soft via-surface-sunk to-canvas"
                />
                {/* The product itself, tilted in 3D and booking as you watch. */}
                <BookingPreview bookings={heroBookings} className="absolute inset-0 p-4 pb-20" />

                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-canvas via-canvas/90 to-transparent p-6 pt-16">
                  <p className="eyebrow">Live availability</p>
                  <p className="mt-2 font-display text-xl leading-snug text-ink">
                    Pick a real slot. Confirmed in seconds.
                  </p>
                </figcaption>
              </div>

              <dl className="grid grid-cols-3 divide-x divide-line border-t border-line bg-surface">
                {[
                  ['2.4k', 'Bookings'],
                  ['180+', 'Providers'],
                  ['4.8', 'Rating'],
                ].map(([value, label]) => (
                  <div key={label} className="px-4 py-4 text-center">
                    <dt className="sr-only">{label}</dt>
                    <dd>
                      <span className="tabular block text-xl text-ink">{value}</span>
                      <span className="mt-1 block text-[0.625rem] tracking-[0.18em] text-muted uppercase">
                        {label}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </figure>
          </div>
        </div>
      </section>

      {/* --- Categories --------------------------------------------------- */}
      <section className="rule">
        <div className="shell section">
          <SectionTitle
            eyebrow="Browse by category"
            title="What do you need done?"
            action={
              <Button to="/services" variant="ghost" size="sm" iconRight={ArrowUpRight}>
                All services
              </Button>
            }
          />

          {/* Six across on desktop, so a short category list still fills its
              row rather than orphaning one tile. */}
          <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="aspect-[5/6] animate-pulse rounded-[var(--radius-card)] bg-surface-sunk"
                  />
                ))
              : categories.map((category) => (
                  <CategoryTile key={category.id} category={category} icon={iconFor(category.icon)} />
                ))}
          </div>
        </div>
      </section>

      {/* --- Featured ------------------------------------------------------ */}
      <section>
        <div className="shell section">
          <SectionTitle
            eyebrow="Highest rated"
            title="Booked again and again"
            description="Ranked by verified reviews left after a completed appointment — nothing else."
            action={
              <Button to="/services?sort=rating" variant="secondary" size="sm" iconRight={ArrowUpRight}>
                See all
              </Button>
            }
          />

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, index) => <ServiceCardSkeleton key={index} />)
              : featured.map((service) => <ServiceCard key={service.id} service={service} />)}
          </div>
        </div>
      </section>

      {/* --- Provider CTA -------------------------------------------------- */}
      <section className="border-t border-line bg-surface">
        <div className="shell section">
          <div className="flex flex-col items-start justify-between gap-8 rounded-[var(--radius-card)] border border-line bg-canvas p-8 lg:flex-row lg:items-center lg:p-12">
            <div className="max-w-2xl">
              <p className="eyebrow">For providers</p>
              <h2 className="mt-3 text-3xl text-ink sm:text-4xl">
                Your calendar, minus the back-and-forth.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
                Set your working hours once. Slotwise shows only the times you are genuinely free,
                takes the payment, and emails both of you the confirmation.
              </p>
            </div>
            <Button to="/register?role=provider" size="lg" iconRight={ArrowRight} className="shrink-0">
              List your service
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
