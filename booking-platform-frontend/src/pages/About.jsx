import { ArrowRight, CalendarCheck, CreditCard, MapPin, Search, Star } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { SectionTitle } from '@/components/ui/Misc'

const clientSteps = [
  { icon: Search, title: 'Find someone', body: 'Filter by category, price, rating or city — or browse the map to see who is genuinely near you.' },
  { icon: CalendarCheck, title: 'Pick a real slot', body: 'Times come straight from the provider’s working hours, minus anything already booked or blocked out.' },
  { icon: CreditCard, title: 'Pay securely', body: 'Payment confirms the booking instantly and emails you both. Cancel free up to 24 hours before.' },
  { icon: Star, title: 'Leave a review', body: 'Reviews unlock only after a completed appointment, so ratings reflect work actually done.' },
]

const providerSteps = [
  { title: 'Set your hours once', body: 'Define weekly working windows and block out holidays. Slotwise never offers a time you are not free.' },
  { title: 'List what you do', body: 'Duration, price, category and whether it happens at your place, theirs, or online.' },
  { title: 'Add a buffer', body: 'Set padding between appointments and it is enforced automatically — no back-to-back surprises.' },
  { title: 'Get paid', body: 'Payments settle to your earnings dashboard, with a full history and monthly revenue chart.' },
]

export default function About() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
      <div className="max-w-3xl">
        <p className="eyebrow">How it works</p>
        <h1 className="mt-4 text-4xl leading-[1.1] font-semibold text-ink sm:text-5xl lg:text-6xl">
          Booking, without the <span className="text-accent italic">back-and-forth</span>.
        </h1>
        <p className="mt-6 text-base leading-relaxed text-muted sm:text-lg">
          Slotwise sits between people who need something done and the people who do it well. No
          phone tag, no “let me check and get back to you” — just live availability, a secure
          payment and a confirmation in your inbox.
        </p>
      </div>

      {/* --- For clients ---------------------------------------------- */}
      <section className="mt-16 lg:mt-24">
        <SectionTitle eyebrow="For clients" title="Four steps, start to finish" />

        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {clientSteps.map((step, index) => (
            <li key={step.title}>
              <Card className="h-full p-5" hover>
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-[var(--radius-inner)] bg-accent-soft text-accent-ink">
                    <step.icon size={17} aria-hidden="true" />
                  </span>
                  <span className="tabular text-2xl font-semibold text-line-strong">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* --- For providers -------------------------------------------- */}
      <section className="mt-16 lg:mt-24">
        <div className="grid gap-8 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="eyebrow">For providers</p>
            <h2 className="mt-3 text-3xl text-ink sm:text-4xl">
              Your calendar does the admin.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Slotwise generates bookable times from your rules, not from a static list. Change your
              hours and every listing updates at once.
            </p>
            <Button to="/register?role=provider" size="lg" iconRight={ArrowRight} className="mt-6">
              List your service
            </Button>
          </div>

          <dl className="space-y-5">
            {providerSteps.map((step) => (
              <div key={step.title} className="border-b border-line pb-5 last:border-0 last:pb-0">
                <dt className="text-base font-semibold text-ink">{step.title}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --- Maps note -------------------------------------------------- */}
      <section className="mt-16 lg:mt-24">
        <Card className="flex flex-col gap-6 p-6 sm:p-10 lg:flex-row lg:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-inner)] bg-sage-soft text-sage">
            <MapPin size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow mb-2">On the maps</p>
            <h2 className="text-2xl font-semibold text-ink">Powered by OpenStreetMap</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Locations are rendered with Leaflet and OpenStreetMap tiles, and address lookup uses
              Nominatim. No API key, no billing account, no usage quota — so the map works the same
              whether one person visits or a hundred thousand do.
            </p>
          </div>
        </Card>
      </section>
    </div>
  )
}
