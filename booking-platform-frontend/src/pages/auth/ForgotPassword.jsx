import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { MailCheck } from 'lucide-react'
import AuthShell from '@/layouts/AuthShell'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import api, { errorMessage, fieldErrors } from '@/lib/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setErrors({})

    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      setSent(true)
      toast.success(data.message)
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
      title="Forgot your password?"
      subtitle="Enter the email on your account and we will send you a link to set a new one."
      quote={{
        eyebrow: 'Security',
        text: 'Reset links expire quickly, and using one signs out every other device.',
      }}
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="rounded-[var(--radius-card)] border border-sage/25 bg-sage-soft p-6 text-center">
          <MailCheck size={22} className="mx-auto text-sage" aria-hidden="true" />
          <p className="mt-3 font-medium text-ink">Check your inbox</p>
          <p className="mt-1.5 text-sm text-muted">
            If <span className="tabular">{email}</span> is registered, a reset link is on its way.
          </p>
          <Button variant="secondary" size="sm" className="mt-5" onClick={() => setSent(false)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setErrors({})
            }}
            error={errors.email}
            placeholder="you@example.com"
          />

          <Button type="submit" size="lg" loading={submitting} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
