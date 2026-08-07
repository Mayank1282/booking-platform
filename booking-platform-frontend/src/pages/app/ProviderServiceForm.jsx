import { Suspense, lazy, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, ImagePlus, Lock, MapPin, X } from 'lucide-react'
import api, { errorMessage, fieldErrors } from '@/lib/api'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { SectionTitle } from '@/components/ui/Misc'

// Leaflet is heavy and only this route needs it inside the dashboard.
const LocationPicker = lazy(() => import('@/components/map/LocationPicker'))

const emptyForm = {
  title: '',
  description: '',
  category_id: '',
  duration_minutes: 60,
  buffer_minutes: 0,
  price: '',
  location_type: 'on_site',
  is_active: true,
  image: null,
  address_line: '',
  city: '',
  state: '',
  postal_code: '',
  latitude: null,
  longitude: null,
}

const ADDRESS_KEYS = ['address_line', 'city', 'state', 'postal_code', 'latitude', 'longitude']

export default function ProviderServiceForm() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(slug)

  const [form, setForm] = useState(emptyForm)
  const [categories, setCategories] = useState([])
  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(null)

  // Set once the service already owes clients an appointment: they booked a
  // specific place, so it cannot move under them.
  const locked = Boolean(service?.location_locked)
  const outstanding = service?.outstanding_bookings_count ?? 0

  useEffect(() => {
    api
      .get('/categories')
      .then(({ data }) => setCategories(data.data))
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!isEdit) return

    setLoading(true)
    setLoadError(null)

    api
      .get(`/provider/services/${slug}`)
      .then(({ data }) => {
        const found = data.data
        setService(found)
        setForm({
          title: found.title,
          description: found.description,
          category_id: found.category?.id ?? '',
          duration_minutes: found.duration_minutes,
          buffer_minutes: found.buffer_minutes,
          price: found.price,
          location_type: found.location_type,
          is_active: found.is_active,
          image: null,
          address_line: found.own_location?.address_line ?? '',
          city: found.own_location?.city ?? '',
          state: found.own_location?.state ?? '',
          postal_code: found.own_location?.postal_code ?? '',
          latitude: found.own_location?.latitude ?? null,
          longitude: found.own_location?.longitude ?? null,
        })
      })
      .catch((requestError) =>
        setLoadError(errorMessage(requestError, 'That service could not be loaded.'))
      )
      .finally(() => setLoading(false))
  }, [slug, isEdit])

  // A chosen file needs a local preview; revoke it so the blob is not leaked.
  useEffect(() => {
    if (!form.image) {
      setPreview(null)
      return
    }

    const url = URL.createObjectURL(form.image)
    setPreview(url)

    return () => URL.revokeObjectURL(url)
  }, [form.image])

  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const setPin = (lat, lng) => {
    if (locked) return
    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))
  }

  const fillAddress = (address) => {
    if (locked) return
    setForm((prev) => ({
      ...prev,
      address_line: address.address_line ?? prev.address_line,
      city: address.city ?? prev.city,
      state: address.state ?? prev.state,
      postal_code: address.postal_code ?? prev.postal_code,
    }))
  }

  const clearAddress = () => {
    if (locked) return
    setForm((prev) => ({
      ...prev,
      address_line: '',
      city: '',
      state: '',
      postal_code: '',
      latitude: null,
      longitude: null,
    }))
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})

    // Multipart, because a service can carry an image.
    const payload = new FormData()

    Object.entries(form).forEach(([key, value]) => {
      // The address is read-only while bookings are outstanding; sending it
      // back unchanged is harmless, but sending nothing is clearer.
      if (locked && ADDRESS_KEYS.includes(key)) return

      if (key === 'image') {
        if (value) payload.append('image', value)
      } else if (key === 'is_active') {
        payload.append('is_active', value ? '1' : '0')
      } else if (value !== '' && value != null) {
        payload.append(key, value)
      }
    })

    try {
      const url = isEdit ? `/provider/services/${slug}` : '/provider/services'
      const { data } = await api.post(url, payload)

      toast.success(data.message)
      navigate('/app/services')
    } catch (requestError) {
      setErrors(fieldErrors(requestError))
      toast.error(errorMessage(requestError, 'That service could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState label="Loading this service" />
  if (loadError) return <ErrorState message={loadError} onRetry={() => navigate(0)} />

  const needsAddress = form.location_type === 'on_site'
  const hasPin = form.latitude != null && form.longitude != null

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <div className="space-y-4">
        <Link
          to="/app/services"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to my services
        </Link>

        <SectionTitle
          eyebrow={isEdit ? 'Edit service' : 'New service'}
          title={isEdit ? service?.title : 'Add a service'}
          description="What clients can book, how long it takes, what it costs and where it happens."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-6">
          {/* --- The listing itself ---------------------------------- */}
          <Card className="space-y-4 p-5">
            <h2 className="text-sm font-semibold tracking-wide text-ink-soft uppercase">Details</h2>

            <Input
              label="Title"
              required
              value={form.title}
              onChange={update('title')}
              error={errors.title}
              placeholder="Deep Tissue Massage"
            />

            <Textarea
              label="Description"
              required
              rows={5}
              value={form.description}
              onChange={update('description')}
              error={errors.description}
              placeholder="What happens in the session, and who it suits."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Category"
                required
                value={form.category_id}
                onChange={update('category_id')}
                error={errors.category_id}
              >
                <option value="">Choose a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>

              <Select
                label="Where it happens"
                required
                value={form.location_type}
                onChange={update('location_type')}
                error={errors.location_type}
                hint={locked ? 'Locked while bookings are outstanding.' : undefined}
                disabled={locked}
              >
                <option value="on_site">At my location</option>
                <option value="client_location">At the client's location</option>
                <option value="remote">Online</option>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Duration (min)"
                type="number"
                min="15"
                max="480"
                step="5"
                required
                value={form.duration_minutes}
                onChange={update('duration_minutes')}
                error={errors.duration_minutes}
              />
              <Input
                label="Buffer (min)"
                type="number"
                min="0"
                max="120"
                step="5"
                value={form.buffer_minutes}
                onChange={update('buffer_minutes')}
                error={errors.buffer_minutes}
                hint="Gap after each booking"
              />
              <Input
                label="Price (₹)"
                type="number"
                min="0"
                step="50"
                required
                value={form.price}
                onChange={update('price')}
                error={errors.price}
              />
            </div>
          </Card>

          {/* --- Address and map ------------------------------------- */}
          {needsAddress && (
            <Card className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
                  Address
                </h2>
                {hasPin && !locked && (
                  <button
                    type="button"
                    onClick={clearAddress}
                    className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-accent"
                  >
                    <X size={13} aria-hidden="true" />
                    Use my profile address instead
                  </button>
                )}
              </div>

              {locked ? (
                <p className="flex items-start gap-2.5 rounded-[var(--radius-inner)] border border-line bg-surface-sunk p-3.5 text-sm text-ink-soft">
                  <Lock size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                  <span>
                    This address is locked. {outstanding} booking{outstanding === 1 ? '' : 's'} still
                    to be delivered — clients agreed to this place, so it can only change once every
                    one of those appointments is completed or cancelled.
                    {service?.location?.formatted_address && (
                      <span className="mt-1 block text-ink">
                        {service.location.formatted_address}
                      </span>
                    )}
                  </span>
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted">
                    Leave this blank to use the address on your profile. Set one here if this
                    particular service runs somewhere else.
                  </p>

                  <Suspense fallback={<LoadingState label="Loading the map" />}>
                    <LocationPicker
                      latitude={form.latitude}
                      longitude={form.longitude}
                      onChange={setPin}
                      onAddressFound={fillAddress}
                    />
                  </Suspense>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Address"
                      className="sm:col-span-2"
                      value={form.address_line}
                      onChange={update('address_line')}
                      error={errors.address_line}
                      placeholder="Street, building, floor"
                    />
                    <Input
                      label="City"
                      value={form.city}
                      onChange={update('city')}
                      error={errors.city}
                    />
                    <Input
                      label="State"
                      value={form.state}
                      onChange={update('state')}
                      error={errors.state}
                    />
                    <Input
                      label="Postcode"
                      value={form.postal_code}
                      onChange={update('postal_code')}
                      error={errors.postal_code}
                    />
                  </div>
                </>
              )}
            </Card>
          )}

          {!needsAddress && (
            <Card className="flex items-start gap-2.5 p-5 text-sm text-muted">
              <MapPin size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              {form.location_type === 'remote'
                ? 'Online services need no address — clients get joining details after booking.'
                : "You travel to the client, so their address is collected at booking time."}
            </Card>
          )}
        </div>

        {/* --- Image and visibility ---------------------------------- */}
        <div className="space-y-6 lg:sticky lg:top-6">
          <Card className="space-y-4 p-5">
            <h2 className="text-sm font-semibold tracking-wide text-ink-soft uppercase">Image</h2>

            <label
              htmlFor="service-image"
              className="block cursor-pointer overflow-hidden rounded-[var(--radius-inner)] border border-dashed border-line-strong bg-surface-sunk transition-colors hover:border-accent"
            >
              {preview || service?.image_url ? (
                <img src={preview ?? service.image_url} alt="" className="aspect-[16/9] w-full object-cover" />
              ) : (
                <span className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 text-sm text-muted">
                  <ImagePlus size={20} aria-hidden="true" />
                  Choose an image
                </span>
              )}
            </label>
            <input
              id="service-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.files?.[0] ?? null }))}
            />
            <p className="text-xs text-muted">
              Optional, max 4 MB. Without one, a generated cover is used.
            </p>
            {errors.image && <p className="text-xs text-rose">{errors.image}</p>}
          </Card>

          <Card className="p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={update('is_active')}
                className="mt-0.5 size-4 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block text-sm font-medium text-ink">Live in the directory</span>
                <span className="block text-xs text-muted">
                  Uncheck to hide it without deleting it.
                </span>
              </span>
            </label>
          </Card>

          <div className="flex items-center gap-2">
            <Button type="submit" loading={saving} className="flex-1">
              {isEdit ? 'Save changes' : 'Create service'}
            </Button>
            <Button variant="ghost" type="button" onClick={() => navigate('/app/services')}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
