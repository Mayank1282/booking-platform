import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowRight, CalendarCheck, Store } from 'lucide-react'
import AuthShell from '@/layouts/AuthShell'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useAuth } from '@/context/AuthContext'
import { errorMessage, fieldErrors } from '@/lib/api'

const roles = [
  {
    value: 'client',
    label: 'I want to book',
    description: 'Browse services, pick a slot and pay securely.',
    icon: CalendarCheck,
  },
  {
    value: 'provider',
    label: 'I offer services',
    description: 'List what you do, set your hours and get paid.',
    icon: Store,
  },
]

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    phone: '',
    // Deep links like /register?role=provider preselect the right side.
    role: searchParams.get('role') === 'provider' ? 'provider' : 'client',
    business_name: '',
    city: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setErrors({})

    try {
      const user = await register(form)
      toast.success(`Welcome to Slotwise, ${user.name.split(' ')[0]}.`)
      navigate('/app', { replace: true })
    } catch (error) {
      setErrors(fieldErrors(error))
      toast.error(errorMessage(error, 'Could not create your account.'))
    } finally {
      setSubmitting(false)
    }
  }

  const isProvider = form.role === 'provider'

  return (
    <AuthShell
      eyebrow="Create your account"
      title={isProvider ? 'List your service' : 'Start booking'}
      subtitle="One account, two ways to use it. You can always change your details later."
      quote={{
        eyebrow: 'For providers',
        text: 'Set your hours once. Slotwise handles the calendar, the payments and the reminders.',
        attribution: 'No listing fees in this demo — it is a portfolio build.',
      }}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Role selector — segmented cards rather than a dropdown, since it
            changes which fields appear below. */}
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-ink-soft">
            How will you use Slotwise?
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {roles.map(({ value, label, description, icon: Icon }) => {
              const selected = form.role === value

              return (
                <label
                  key={value}
                  className={[
                    'flex cursor-pointer flex-col gap-1 rounded-[var(--radius-card)] border p-4 transition-colors',
                    selected
                      ? 'border-accent bg-accent-soft'
                      : 'border-line-strong bg-surface hover:border-accent/50',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={selected}
                    onChange={update('role')}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2">
                    <Icon size={16} className={selected ? 'text-accent' : 'text-muted'} aria-hidden="true" />
                    <span className={`text-sm font-medium ${selected ? 'text-accent-ink' : 'text-ink'}`}>
                      {label}
                    </span>
                  </span>
                  <span className="text-xs text-muted">{description}</span>
                </label>
              )
            })}
          </div>
          {errors.role && <p className="mt-1.5 text-xs text-rose">{errors.role}</p>}
        </fieldset>

        <Input
          label="Full name"
          required
          autoComplete="name"
          value={form.name}
          onChange={update('name')}
          error={errors.name}
          placeholder="Ananya Sharma"
        />

        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={update('email')}
          error={errors.email}
          placeholder="you@example.com"
        />

        {isProvider && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Business name"
              required
              value={form.business_name}
              onChange={update('business_name')}
              error={errors.business_name}
              placeholder="Stillpoint Studio"
            />
            <Input
              label="City"
              value={form.city}
              onChange={update('city')}
              error={errors.city}
              placeholder="Bengaluru"
            />
          </div>
        )}

        <Input
          label="Phone"
          type="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={update('phone')}
          error={errors.phone}
          placeholder="+91 98765 43210"
          hint="Optional — used only for booking reminders."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={update('password')}
            error={errors.password}
            placeholder="At least 8 characters"
          />
          <Input
            label="Confirm password"
            type="password"
            required
            autoComplete="new-password"
            value={form.password_confirmation}
            onChange={update('password_confirmation')}
            error={errors.password_confirmation}
            placeholder="Repeat it"
          />
        </div>

        <Button type="submit" size="lg" loading={submitting} iconRight={ArrowRight} className="w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
