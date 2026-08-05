import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, Menu, X } from 'lucide-react'
import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'
import Button from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Misc'
import { useAuth } from '@/context/AuthContext'

const links = [
  { to: '/services', label: 'Browse services' },
  { to: '/map', label: 'Map' },
  { to: '/about', label: 'How it works' },
]

export default function PublicLayout() {
  const { isAuthenticated, user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  // Navigating always dismisses the mobile drawer.
  useEffect(() => setMenuOpen(false), [pathname])

  const navClass = ({ isActive }) =>
    `text-sm transition-colors ${isActive ? 'text-accent' : 'text-ink-soft hover:text-ink'}`

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />

          <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={navClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            {isAuthenticated ? (
              <Button to="/app" variant="secondary" icon={LayoutDashboard}>
                Dashboard
              </Button>
            ) : (
              <>
                <Button to="/login" variant="ghost">
                  Sign in
                </Button>
                <Button to="/register">Get started</Button>
              </>
            )}
          </div>

          {/* Mobile: theme toggle stays reachable, everything else goes in the drawer. */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="flex size-11 items-center justify-center rounded-[var(--radius-inner)] border border-line text-ink"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-line bg-canvas md:hidden">
            <nav className="mx-auto flex w-full max-w-7xl flex-col px-4 py-3 sm:px-6" aria-label="Mobile">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center border-b border-line text-sm last:border-0 ${
                      isActive ? 'text-accent' : 'text-ink-soft'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}

              <div className="mt-4 flex flex-col gap-2">
                {isAuthenticated ? (
                  <Button to="/app" icon={LayoutDashboard}>
                    Go to dashboard
                  </Button>
                ) : (
                  <>
                    <Button to="/login" variant="secondary">
                      Sign in
                    </Button>
                    <Button to="/register">Get started</Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-10 md:flex-row">
            <div className="max-w-sm">
              <Logo />
              <p className="mt-4 text-sm leading-relaxed text-muted">
                A booking marketplace for people who do good work — wellness, beauty, fitness,
                home services and more. Real availability, honest reviews, paid securely.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              <div>
                <p className="eyebrow mb-3">Explore</p>
                <ul className="space-y-2 text-sm text-muted">
                  <li>
                    <Link to="/services" className="hover:text-accent">
                      All services
                    </Link>
                  </li>
                  <li>
                    <Link to="/map" className="hover:text-accent">
                      Map view
                    </Link>
                  </li>
                  <li>
                    <Link to="/about" className="hover:text-accent">
                      How it works
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <p className="eyebrow mb-3">Account</p>
                <ul className="space-y-2 text-sm text-muted">
                  <li>
                    <Link to="/login" className="hover:text-accent">
                      Sign in
                    </Link>
                  </li>
                  <li>
                    <Link to="/register" className="hover:text-accent">
                      Create account
                    </Link>
                  </li>
                  <li>
                    <Link to="/register?role=provider" className="hover:text-accent">
                      List your service
                    </Link>
                  </li>
                </ul>
              </div>

              {isAuthenticated && (
                <div>
                  <p className="eyebrow mb-3">Signed in</p>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={user?.name} src={user?.avatar_url} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
                      <p className="text-xs capitalize text-muted">{user?.role}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Slotwise. A portfolio project.</p>
            <p>
              Maps ©{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent"
              >
                OpenStreetMap
              </a>{' '}
              contributors
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
