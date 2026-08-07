import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarClock,
  CalendarRange,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Star,
  Store,
  Users,
  X,
} from 'lucide-react'
import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'
import PayoutGate from '@/components/provider/PayoutGate'
import { Avatar } from '@/components/ui/Misc'
import { useAuth } from '@/context/AuthContext'

/*
  Navigation ergonomics are deliberately identical to the other portfolio
  projects: fixed sidebar on desktop, slide-in drawer behind a hamburger on
  mobile. Only the styling differs — warm surfaces, hairline borders, serif
  section headings.
*/
const providerNav = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/bookings', label: 'Bookings', icon: CalendarClock },
  { to: '/app/services', label: 'My services', icon: Store },
  { to: '/app/availability', label: 'Availability', icon: CalendarRange },
  { to: '/app/reviews', label: 'Reviews', icon: Star },
  { to: '/app/payments', label: 'Earnings', icon: CreditCard },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

const adminNav = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/admin/users', label: 'Users', icon: Users },
  { to: '/app/admin/services', label: 'Listings', icon: Store },
  { to: '/app/admin/bookings', label: 'Bookings', icon: CalendarClock },
  { to: '/app/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

const clientNav = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/bookings', label: 'My bookings', icon: CalendarClock },
  { to: '/services', label: 'Browse services', icon: Search },
  { to: '/app/payments', label: 'Payments', icon: CreditCard },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export default function AppLayout() {
  const { user, isProvider, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const isAdmin = user?.role === 'admin'
  const items = isAdmin ? adminNav : isProvider ? providerNav : clientNav

  useEffect(() => setDrawerOpen(false), [pathname])

  // The drawer is an overlay, so the page behind it must not scroll.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const linkClass = ({ isActive }) =>
    [
      'flex min-h-11 items-center gap-3 rounded-[var(--radius-inner)] px-3 text-sm transition-colors',
      isActive
        ? 'bg-accent-soft font-medium text-accent-ink'
        : 'text-ink-soft hover:bg-surface-sunk hover:text-ink',
    ].join(' ')

  const sidebarBody = (
    <>
      <div className="flex h-16 items-center justify-between px-4">
        <Logo to="/app" />
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
          className="flex size-10 items-center justify-center rounded-[var(--radius-inner)] text-muted hover:bg-surface-sunk hover:text-ink lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface-sunk p-3">
          <Avatar name={user?.name} src={user?.avatar_url} size={38} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
            <p className="truncate text-xs text-muted">
              {isAdmin
                ? 'Platform administrator'
                : isProvider
                  ? user?.provider_profile?.business_name || 'Provider'
                  : 'Client'}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-4" aria-label="Dashboard">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            <Icon size={17} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-inner)] px-3 text-sm text-ink-soft transition-colors hover:bg-rose-soft hover:text-rose"
        >
          <LogOut size={17} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-dvh lg:flex">
      {/* Providers cannot use the dashboard until Stripe can pay them. */}
      <PayoutGate />
      {/* Desktop: fixed sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        {sidebarBody}
      </aside>

      {/* Mobile: slide-in drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="animate-rise relative flex h-full w-[17rem] max-w-[85vw] flex-col border-r border-line bg-surface">
            {sidebarBody}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="flex size-11 items-center justify-center rounded-[var(--radius-inner)] border border-line text-ink"
          >
            <Menu size={18} />
          </button>
          <Logo to="/app" className="flex-1" />
          <ThemeToggle />
        </header>

        {/* Desktop header keeps the theme toggle reachable without a sidebar row. */}
        <div className="hidden justify-end border-b border-line bg-canvas/85 px-6 py-3 backdrop-blur-md lg:flex lg:px-8">
          <ThemeToggle />
        </div>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
