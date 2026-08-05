import { lazy } from 'react'
import { useAuth } from '@/context/AuthContext'

/*
  /app resolves to a different dashboard per role. Splitting the choice into
  its own component keeps each dashboard in its own chunk — a client never
  downloads the admin overview.
*/
const Dashboard = lazy(() => import('./Dashboard'))
const AdminOverview = lazy(() => import('./admin/AdminOverview'))

export default function DashboardHome() {
  const { user } = useAuth()

  return user?.role === 'admin' ? <AdminOverview /> : <Dashboard />
}
