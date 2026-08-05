import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import AuthShell from '@/layouts/AuthShell'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import api, { errorMessage, fieldErrors } from '@/lib/api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    // Laravel's reset link carries both of these as query parameters.
    token: searchParams.get('token') ?? '',
    email: searchParams.get('email') ?? '',
    password: '',
    password_confirmation: '',
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
      const { data } = await api.post('/auth/reset-password', form)
      toast.success(data.message)
      navigate('/login', { replace: true })
    } catch (error) {
      setErrors(fieldErrors(error))
      toast.error(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Password reset"
      title="Choose a new password"
      subtitle="Pick something you have not used before. This will sign you out everywhere else."
      footer={
        <>
          Changed your mind?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={update('email')}
          error={errors.email}
        />
        <Input
          label="New password"
          type="password"
          required
          autoComplete="new-password"
          value={form.password}
          onChange={update('password')}
          error={errors.password}
          placeholder="At least 8 characters"
        />
        <Input
          label="Confirm new password"
          type="password"
          required
          autoComplete="new-password"
          value={form.password_confirmation}
          onChange={update('password_confirmation')}
          error={errors.password_confirmation}
        />

        {!form.token && (
          <p className="rounded-[var(--radius-inner)] border border-gold/25 bg-gold-soft px-3 py-2 text-xs text-gold">
            This page needs the token from your reset email. Open the link in that email instead.
          </p>
        )}

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Reset password
        </Button>
      </form>
    </AuthShell>
  )
}
