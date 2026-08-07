import { useState } from 'react'
import toast from 'react-hot-toast'
import { KeyRound, Lock, Save, UserRound } from 'lucide-react'
import api, { errorMessage, fieldErrors } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Field'
import { Avatar, SectionTitle } from '@/components/ui/Misc'
import LocationPicker from '@/components/map/LocationPicker'

export default function Settings() {
  const { user, setUser, isProvider } = useAuth()
  const profile = user?.provider_profile

  // Set while a service that inherits this address still owes a client an
  // appointment. The server drops the address fields regardless; hiding them
  // here is what stops it looking like a silent failure.
  const addressLocked = Boolean(profile?.location_locked)

  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    business_name: profile?.business_name ?? '',
    headline: profile?.headline ?? '',
    bio: profile?.bio ?? '',
    address_line: profile?.address_line ?? '',
    city: profile?.city ?? '',
    state: profile?.state ?? '',
    country: profile?.country ?? '',
    postal_code: profile?.postal_code ?? '',
    latitude: profile?.latitude ?? null,
    longitude: profile?.longitude ?? null,
  })
  const [avatar, setAvatar] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [password, setPassword] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  })
  const [passwordErrors, setPasswordErrors] = useState({})
  const [changingPassword, setChangingPassword] = useState(false)

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})

    const payload = new FormData()
    Object.entries(form).forEach(([key, value]) => {
      // Provider-only fields are simply not sent for client accounts.
      if (!isProvider && !['name', 'email', 'phone'].includes(key)) return
      // Empty strings are sent through so a field can actually be cleared;
      // only null/undefined (an unset map pin) is omitted.
      if (value !== null && value !== undefined) payload.append(key, value)
    })
    if (avatar) payload.append('avatar', avatar)

    try {
      const { data } = await api.post('/auth/profile', payload)
      setUser(data.data)
      setAvatar(null)
      toast.success(data.message)
    } catch (requestError) {
      setErrors(fieldErrors(requestError))
      toast.error(errorMessage(requestError, 'Your profile could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    setChangingPassword(true)
    setPasswordErrors({})

    try {
      const { data } = await api.post('/auth/password', password)
      setPassword({ current_password: '', password: '', password_confirmation: '' })
      toast.success(data.message)
    } catch (requestError) {
      setPasswordErrors(fieldErrors(requestError))
      toast.error(errorMessage(requestError, 'Your password could not be changed.'))
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Your account"
        title="Settings"
        description={
          isProvider
            ? 'Your details, your business profile and where clients can find you.'
            : 'Your details and how we reach you about bookings.'
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* --- Profile ------------------------------------------------- */}
          <Card>
            <CardHeader eyebrow="Who you are" title="Profile" />
            <form onSubmit={saveProfile} className="space-y-4 p-5" noValidate>
              <div className="flex flex-wrap items-center gap-4">
                <Avatar
                  name={form.name}
                  src={avatar ? URL.createObjectURL(avatar) : user?.avatar_url}
                  size={64}
                />
                <div>
                  <label
                    htmlFor="avatar"
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-inner)] border border-line-strong px-3 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
                  >
                    {avatar ? avatar.name : 'Change photo'}
                  </label>
                  <input
                    id="avatar"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
                  />
                  <p className="mt-1.5 text-xs text-muted">JPG, PNG or WebP, up to 2 MB.</p>
                  {errors.avatar && <p className="mt-1 text-xs text-rose">{errors.avatar}</p>}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Full name" required value={form.name} onChange={update('name')} error={errors.name} />
                <Input
                  label="Email"
                  type="email"
                  required
                  value={form.email}
                  onChange={update('email')}
                  error={errors.email}
                />
              </div>

              <Input
                label="Phone"
                type="tel"
                value={form.phone}
                onChange={update('phone')}
                error={errors.phone}
                placeholder="+91 98765 43210"
              />

              {isProvider && (
                <>
                  <div className="border-t border-line pt-4">
                    <p className="eyebrow mb-4">Your business</p>

                    <div className="space-y-4">
                      <Input
                        label="Business name"
                        value={form.business_name}
                        onChange={update('business_name')}
                        error={errors.business_name}
                      />
                      <Input
                        label="Headline"
                        value={form.headline}
                        onChange={update('headline')}
                        error={errors.headline}
                        placeholder="What you do, in one line."
                        hint="Shown under your name on every listing."
                      />
                      <Textarea
                        label="About"
                        rows={4}
                        value={form.bio}
                        onChange={update('bio')}
                        error={errors.bio}
                        placeholder="Your experience, your approach, what a session is like."
                      />
                    </div>
                  </div>

                  <div className="border-t border-line pt-4">
                    <p className="eyebrow mb-1">Where you are</p>
                    <p className="mb-4 text-xs text-muted">
                      Used for the map and for clients filtering by city. Only on-site services are
                      pinned publicly.
                    </p>

                    {addressLocked ? (
                      /*
                        Services without an address of their own sit here, and
                        clients booked them at this place. Read-only until every
                        one of those appointments is completed or cancelled.
                      */
                      <div className="space-y-3">
                        <p className="flex items-start gap-2.5 rounded-[var(--radius-inner)] border border-line bg-surface-sunk p-3.5 text-sm text-ink-soft">
                          <Lock size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                          <span>
                            Your address is locked — clients still have appointments booked here. It
                            can change once every one of those bookings is completed or cancelled.
                            Give a single service its own address instead if only that one has moved.
                            <span className="mt-1 block text-ink">{profile?.formatted_address}</span>
                          </span>
                        </p>
                      </div>
                    ) : (
                    <div className="space-y-4">
                      <Input
                        label="Address"
                        value={form.address_line}
                        onChange={update('address_line')}
                        error={errors.address_line}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="City" value={form.city} onChange={update('city')} error={errors.city} />
                        <Input label="State" value={form.state} onChange={update('state')} error={errors.state} />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                          label="Postal code"
                          value={form.postal_code}
                          onChange={update('postal_code')}
                          error={errors.postal_code}
                        />
                        <Input
                          label="Country"
                          value={form.country}
                          onChange={update('country')}
                          error={errors.country}
                        />
                      </div>

                      <LocationPicker
                        latitude={form.latitude}
                        longitude={form.longitude}
                        onChange={(latitude, longitude) =>
                          setForm((prev) => ({ ...prev, latitude, longitude }))
                        }
                        onAddressFound={(address) => setForm((prev) => ({ ...prev, ...address }))}
                      />
                    </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex justify-end border-t border-line pt-4">
                <Button type="submit" icon={Save} loading={saving}>
                  Save changes
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* --- Side column ---------------------------------------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader eyebrow="Security" title="Password" />
            <form onSubmit={changePassword} className="space-y-4 p-5" noValidate>
              <Input
                label="Current password"
                type="password"
                required
                autoComplete="current-password"
                value={password.current_password}
                onChange={(event) => setPassword((prev) => ({ ...prev, current_password: event.target.value }))}
                error={passwordErrors.current_password}
              />
              <Input
                label="New password"
                type="password"
                required
                autoComplete="new-password"
                value={password.password}
                onChange={(event) => setPassword((prev) => ({ ...prev, password: event.target.value }))}
                error={passwordErrors.password}
              />
              <Input
                label="Confirm new password"
                type="password"
                required
                autoComplete="new-password"
                value={password.password_confirmation}
                onChange={(event) =>
                  setPassword((prev) => ({ ...prev, password_confirmation: event.target.value }))
                }
                error={passwordErrors.password_confirmation}
              />

              <p className="text-xs text-muted">
                Changing your password signs you out of every other device.
              </p>

              <Button
                type="submit"
                variant="secondary"
                icon={KeyRound}
                loading={changingPassword}
                className="w-full"
              >
                Update password
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <p className="eyebrow mb-3 flex items-center gap-2">
              <UserRound size={12} aria-hidden="true" />
              Account type
            </p>
            <p className="text-sm text-ink">
              {isProvider ? 'Provider' : 'Client'} account
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              {isProvider
                ? 'You can list services, manage availability and take bookings.'
                : 'You can browse the directory, book appointments and leave reviews.'}
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
