import { Link } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import Button from '@/components/ui/Button'
import Logo from '@/components/Logo'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />

      <p className="eyebrow mt-12">Error 404</p>
      <h1 className="mt-4 text-6xl font-semibold text-ink sm:text-8xl">
        Nothing <span className="text-accent italic">here</span>.
      </h1>
      <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">
        That page has either moved or never existed. The directory is still where you left it.
      </p>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button to="/" variant="secondary" icon={ArrowLeft}>
          Back home
        </Button>
        <Button to="/services" icon={Search}>
          Browse services
        </Button>
      </div>

      <p className="mt-16 text-xs text-muted">
        <Link to="/about" className="hover:text-accent">
          How Slotwise works
        </Link>
      </p>
    </div>
  )
}
