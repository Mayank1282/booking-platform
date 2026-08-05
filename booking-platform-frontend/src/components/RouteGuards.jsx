import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { LoadingState } from '@/components/ui/States'

/** Blocks a route until the session is known, then requires a signed-in user. */
export function RequireAuth() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingState label="Checking your session" className="min-h-dvh" />

  // Remember where they were heading so login can send them back.
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />

  return <Outlet />
}

/** Keeps signed-in users off the login and register screens. */
export function RequireGuest() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return <LoadingState label="Checking your session" className="min-h-dvh" />
  if (isAuthenticated) return <Navigate to="/app" replace />

  return <Outlet />
}

/** Role gate for the provider-only and client-only sections. */
export function RequireRole({ role }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingState label="Loading" />
  if (user?.role !== role) return <Navigate to="/app" replace />

  return <Outlet />
}
