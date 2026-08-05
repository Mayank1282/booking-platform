import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import PublicLayout from '@/layouts/PublicLayout'
import AppLayout from '@/layouts/AppLayout'
import { RequireAuth, RequireGuest, RequireRole } from '@/components/RouteGuards'
import { LoadingState } from '@/components/ui/States'

import Home from '@/pages/Home'
import About from '@/pages/About'
import ServiceBrowse from '@/pages/ServiceBrowse'
import NotFound from '@/pages/NotFound'

import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'

import Bookings from '@/pages/app/Bookings'
import Payments from '@/pages/app/Payments'
import ProviderServices from '@/pages/app/ProviderServices'
import ProviderAvailability from '@/pages/app/ProviderAvailability'
import ProviderReviews from '@/pages/app/ProviderReviews'

/*
  Leaflet and Recharts are heavy and only a handful of routes need them.
  Splitting those routes keeps the first load light for everyone else.
*/
const ServiceDetail = lazy(() => import('@/pages/ServiceDetail'))
const MapExplore = lazy(() => import('@/pages/MapExplore'))
const DashboardHome = lazy(() => import('@/pages/app/DashboardHome'))
const BookingDetail = lazy(() => import('@/pages/app/BookingDetail'))
const Settings = lazy(() => import('@/pages/app/Settings'))

// Admin is a small audience — no reason to ship it to everyone else.
const AdminUsers = lazy(() => import('@/pages/app/admin/AdminUsers'))
const AdminServices = lazy(() => import('@/pages/app/admin/AdminServices'))
const AdminBookings = lazy(() => import('@/pages/app/admin/AdminBookings'))
const AdminPayments = lazy(() => import('@/pages/app/admin/AdminPayments'))

export default function App() {
  return (
    <Suspense fallback={<LoadingState className="min-h-[60vh]" />}>
      <Routes>
        {/* Public marketplace */}
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="services" element={<ServiceBrowse />} />
          <Route path="services/:slug" element={<ServiceDetail />} />
          <Route path="map" element={<MapExplore />} />
          <Route path="about" element={<About />} />
        </Route>

        {/* Auth — signed-in users are redirected away */}
        <Route element={<RequireGuest />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
        </Route>

        {/* Dashboard */}
        <Route element={<RequireAuth />}>
          <Route path="app" element={<AppLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="bookings/:id" element={<BookingDetail />} />
            <Route path="payments" element={<Payments />} />
            <Route path="settings" element={<Settings />} />

            <Route element={<RequireRole role="provider" />}>
              <Route path="services" element={<ProviderServices />} />
              <Route path="availability" element={<ProviderAvailability />} />
              <Route path="reviews" element={<ProviderReviews />} />
            </Route>

            <Route element={<RequireRole role="admin" />}>
              <Route path="admin/users" element={<AdminUsers />} />
              <Route path="admin/services" element={<AdminServices />} />
              <Route path="admin/bookings" element={<AdminBookings />} />
              <Route path="admin/payments" element={<AdminPayments />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
