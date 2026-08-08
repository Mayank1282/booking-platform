import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowRight } from 'lucide-react'
import AuthShell from '@/layouts/AuthShell'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useAuth } from '@/context/AuthContext'
import { errorMessage, fieldErrors } from '@/lib/api'

/* The seeded accounts, offered as one-tap fills so a reviewer can get in fast. */
const demoAccounts = [
  { label: 'Client', email: 'client@yopmail.com' },
  { label: 'Provider', email: 'provider@yopmail.com' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (searchParams.get('expired')) {
      toast('Your session expired — please sign in again.', { icon: '🔒' })
    }
  }, [searchParams])

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setErrors({})

    try {
      const user = await login(form)
      toast.success(`Welcome back, ${user.name.split(' ')[0]}.`)
      navigate(location.state?.from?.pathname ?? '/app', { replace: true })
    } catch (error) {
      setErrors(fieldErrors(error))
      toast.error(errorMessage(error, 'Could not sign you in.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to Slotwise"
      subtitle="Pick up where you left off — your bookings, schedule and payments are all here."
      quote={{
        eyebrow: 'Why Slotwise',
        text: 'Real availability, not a contact form. Pick a slot, pay, and it is done.',
        attribution: 'Built as portfolio project #3 — Laravel + React + Stripe + Leaflet',
      }}
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={update('email')}
          error={errors.email}
          placeholder="you@example.com"
        />

        <div>
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={update('password')}
            error={errors.password}
            placeholder="••••••••"
          />
          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-xs text-muted hover:text-accent">
              Forgot your password?
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" loading={submitting} iconRight={ArrowRight} className="w-full">
          Sign in
        </Button>
      </form>

      <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface-sunk p-4">
        <p className="eyebrow mb-3">Demo accounts</p>
        <div className="flex flex-wrap gap-2">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => setForm({ email: account.email, password: 'password' })}
              className="min-h-11 rounded-[var(--radius-inner)] border border-line-strong bg-surface px-3 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
            >
              {account.label}
            </button>
          ))}
        </div>
        <p className="tabular mt-3 text-xs text-muted">Password for every demo account: password</p>
      </div>
    </AuthShell>
  )
}
