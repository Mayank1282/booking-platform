import { Suspense, lazy, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

/*
  Three.js is by far the heaviest dependency in the app, so the hero scene is
  split into its own chunk and streamed in after the page is readable. The
  headline and search never wait on WebGL.
*/
const HeroScene = lazy(() => import('@/components/three/HeroScene'))

export default function Home() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState([])
  const [featured, setFeatured] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([api.get('/categories'), api.get('/services', { params: { sort: 'rating', per_page: 6 } })])
      .then(([categoryRes, serviceRes]) => {
        if (cancelled) return
        setCategories(categoryRes.data.data.filter((c) => c.services_count > 0))
        setFeatured(serviceRes.data.data)
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
      <section className="relative overflow-hidden border-b border-line">
        {/* Layered mesh blooms behind the hero. Large, heavily blurred and
            low-opacity, so the canvas reads as lit rather than flat. */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-40 -left-32 size-[34rem] rounded-full bg-accent/18 blur-[110px]" />
          <div className="absolute -top-24 right-[-10rem] size-[30rem] rounded-full bg-gold/18 blur-[120px]" />
          <div className="absolute -bottom-56 left-1/3 size-[32rem] rounded-full bg-sage/14 blur-[130px]" />
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-24">
          <div className="lg:col-span-7">
            <p className="eyebrow">Booking marketplace · India</p>

            <h1 className="mt-5 text-[2.5rem] leading-[1.05] font-semibold text-ink sm:text-6xl lg:text-[4.25rem]">
              Book someone
              <br />
              <span className="text-accent italic">genuinely good</span>
              <br />
              at a time that suits.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Real availability from real providers — wellness, beauty, fitness, home services and
              more. Pick a slot, pay securely, and get a confirmation in seconds.
            </p>

            <form onSubmit={handleSearch} className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
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

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-sage" aria-hidden="true" />
                Secure payments
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Star size={14} className="text-gold" aria-hidden="true" />
                Verified reviews
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles size={14} className="text-accent" aria-hidden="true" />
                Free cancellation up to 24h
              </span>
            </div>
          </div>

          {/* The 3D dial. It carries the visual weight of the hero, with the
              proof points sitting on glass beneath it. */}
          <div className="mt-12 lg:col-span-5 lg:mt-0">
            <div className="relative">
              <Suspense
                fallback={<div className="aspect-square w-full animate-pulse rounded-full bg-accent-soft/40" />}
              >
                <HeroScene className="aspect-square w-full [&_canvas]:!touch-pan-y" />
              </Suspense>

              {/* Frosted panel overlapping the lower edge of the scene. */}
              <figure className="relative -mt-10 rounded-[var(--radius-card)] border border-line/80 bg-surface/70 p-6 shadow-[var(--shadow-lift)] backdrop-blur-xl sm:-mt-14">
                <blockquote className="font-display text-xl leading-snug font-medium text-ink sm:text-2xl">
                  “Booked a physio at 9pm on a Sunday. Confirmed before I closed the tab.”
                </blockquote>
                <figcaption className="mt-3 text-sm text-muted">— Ananya S., Bengaluru</figcaption>

                <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-5">
                  {[
                    ['2.4k', 'Bookings'],
                    ['180+', 'Providers'],
                    ['4.8', 'Avg rating'],
                  ].map(([value, label]) => (
                    <div key={label}>
                      <dt className="sr-only">{label}</dt>
                      <dd>
                        <span className="tabular text-xl font-semibold text-ink">{value}</span>
                        <span className="mt-0.5 block text-[0.6875rem] tracking-wide text-muted uppercase">
                          {label}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* --- Categories --------------------------------------------------- */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <SectionTitle
            eyebrow="Browse by category"
            title="What do you need done?"
            action={
              <Button to="/services" variant="ghost" size="sm" iconRight={ArrowUpRight}>
                All services
              </Button>
            }
          />

          {/* Compact tiles, six across on desktop — dense enough that a short
              category list still fills its row instead of orphaning one card. */}
          <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-32 animate-pulse rounded-[var(--radius-card)] bg-surface-sunk" />
                ))
              : categories.map((category) => {
                  const Icon = iconFor(category.icon)

                  return (
                    <Link
                      key={category.id}
                      to={`/services?category=${category.slug}`}
                      className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas p-4 transition-all duration-200 hover:-translate-y-1 hover:border-accent hover:shadow-[var(--shadow-lift)]"
                    >
                      {/* Accent bloom that only surfaces on hover. */}
                      <span
                        className="pointer-events-none absolute -top-8 -right-8 size-24 rounded-full bg-accent/0 blur-2xl transition-colors duration-300 group-hover:bg-accent/20"
                        aria-hidden="true"
                      />
                      {/* A hairline outlined glyph reads more considered than
                          a filled pastel chip. */}
                      <span className="relative flex size-10 items-center justify-center rounded-full border border-line-strong text-ink-soft transition-colors duration-200 group-hover:border-accent group-hover:text-accent">
                        <Icon size={17} strokeWidth={1.5} aria-hidden="true" />
                      </span>
                      <span className="relative">
                        <span className="block text-sm leading-snug font-medium tracking-tight text-ink transition-colors group-hover:text-accent">
                          {category.name}
                        </span>
                        <span className="tabular mt-1 block text-[0.6875rem] tracking-wide text-muted uppercase">
                          {category.services_count} service{category.services_count === 1 ? '' : 's'}
                        </span>
                      </span>
                    </Link>
                  )
                })}
          </div>
        </div>
      </section>

      {/* --- Featured ------------------------------------------------------ */}
      <section>
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
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
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="flex flex-col items-start justify-between gap-8 rounded-[var(--radius-card)] border border-line bg-canvas p-8 lg:flex-row lg:items-center lg:p-12">
            <div className="max-w-2xl">
              <p className="eyebrow">For providers</p>
              <h2 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">
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
