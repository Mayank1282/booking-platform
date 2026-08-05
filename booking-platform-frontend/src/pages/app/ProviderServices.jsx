import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ImagePlus, Pencil, Plus, Store, Trash2 } from 'lucide-react'
import api, { errorMessage, fieldErrors } from '@/lib/api'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { Pagination, Rating, SectionTitle } from '@/components/ui/Misc'
import ServiceArtwork from '@/components/ServiceArtwork'
import { duration, money } from '@/lib/format'

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
}

export default function ProviderServices() {
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editing, setEditing] = useState(null) // null = closed, {} = new
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)

    api
      .get('/provider/services', { params: { page } })
      .then(({ data }) => {
        setServices(data.data)
        setMeta(data.meta)
      })
      .catch(() => setError('Your services could not be loaded.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [page])

  useEffect(() => {
    api
      .get('/categories')
      .then(({ data }) => setCategories(data.data))
      .catch(() => setCategories([]))
  }, [])

  const openNew = () => {
    setForm({ ...emptyForm, category_id: categories[0]?.id ?? '' })
    setErrors({})
    setEditing({})
  }

  const openEdit = (service) => {
    setForm({
      title: service.title,
      description: service.description,
      category_id: service.category?.id ?? '',
      duration_minutes: service.duration_minutes,
      buffer_minutes: service.buffer_minutes,
      price: service.price,
      location_type: service.location_type,
      is_active: service.is_active,
      image: null,
    })
    setErrors({})
    setEditing(service)
  }

  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})

    // Multipart, because a service can carry an image.
    const payload = new FormData()
    Object.entries(form).forEach(([key, value]) => {
      if (key === 'image') {
        if (value) payload.append('image', value)
      } else if (key === 'is_active') {
        payload.append('is_active', value ? '1' : '0')
      } else if (value !== '' && value != null) {
        payload.append(key, value)
      }
    })

    try {
      const url = editing?.id ? `/provider/services/${editing.slug}` : '/provider/services'
      const { data } = await api.post(url, payload)

      toast.success(data.message)
      setEditing(null)
      load()
    } catch (requestError) {
      setErrors(fieldErrors(requestError))
      toast.error(errorMessage(requestError, 'That service could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      const { data } = await api.delete(`/provider/services/${deleting.slug}`)
      toast.success(data.message)
      setDeleting(null)
      load()
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    }
  }

  const toggleActive = async (service) => {
    const payload = new FormData()
    payload.append('is_active', service.is_active ? '0' : '1')

    try {
      await api.post(`/provider/services/${service.slug}`, payload)
      toast.success(service.is_active ? 'Service hidden from the directory.' : 'Service is live again.')
      load()
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    }
  }

  return (
    <>
      <div className="space-y-6">
        <SectionTitle
          eyebrow="Your listings"
          title="My services"
          description="What clients can book, how long it takes and what it costs."
          action={
            <Button icon={Plus} onClick={openNew}>
              New service
            </Button>
          }
        />

        {loading ? (
          <LoadingState label="Loading your services" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : services.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No services yet"
            description="Add your first service and it will appear in the directory straight away."
            action={
              <Button icon={Plus} onClick={openNew}>
                Add a service
              </Button>
            }
            className="rounded-[var(--radius-card)] border border-line bg-surface"
          />
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {services.map((service) => (
                <li key={service.id}>
                  <Card className="flex h-full flex-col overflow-hidden">
                    <div className="relative aspect-[16/9] bg-surface-sunk">
                      {service.image_url ? (
                        <img src={service.image_url} alt="" className="size-full object-cover" />
                      ) : (
                        <ServiceArtwork service={service} className="size-full" />
                      )}
                      {!service.is_active && (
                        <span className="absolute top-3 right-3">
                          <Badge tone="rose" size="sm">
                            Hidden
                          </Badge>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 text-base font-semibold text-ink">{service.title}</h3>
                        <span className="tabular shrink-0 font-semibold text-accent">
                          {money(service.price, service.currency)}
                        </span>
                      </div>

                      <p className="tabular mt-1.5 text-xs text-muted">
                        {duration(service.duration_minutes)}
                        {service.buffer_minutes > 0 && ` · +${service.buffer_minutes} min buffer`}
                      </p>

                      <p className="mt-2 line-clamp-2 text-sm text-muted">{service.description}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge tone="neutral" size="sm">
                          {service.category?.name}
                        </Badge>
                        <Badge tone="neutral" size="sm">
                          {service.location_label}
                        </Badge>
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3.5">
                        <Rating value={service.rating_avg} count={service.rating_count} size={12} />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleActive(service)}
                            aria-label={service.is_active ? 'Hide service' : 'Show service'}
                            className="flex size-9 items-center justify-center rounded-[var(--radius-inner)] text-muted transition-colors hover:bg-surface-sunk hover:text-ink"
                          >
                            {service.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(service)}
                            aria-label="Edit service"
                            className="flex size-9 items-center justify-center rounded-[var(--radius-inner)] text-muted transition-colors hover:bg-surface-sunk hover:text-accent"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(service)}
                            aria-label="Delete service"
                            className="flex size-9 items-center justify-center rounded-[var(--radius-inner)] text-muted transition-colors hover:bg-rose-soft hover:text-rose"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>

            <Pagination meta={meta} onPage={setPage} />
          </>
        )}
      </div>

      {/* --- Create / edit --------------------------------------------- */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        eyebrow={editing?.id ? 'Edit service' : 'New service'}
        title={editing?.id ? editing.title : 'Add a service'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="service-form" loading={saving}>
              {editing?.id ? 'Save changes' : 'Create service'}
            </Button>
          </>
        }
      >
        <form id="service-form" onSubmit={save} className="space-y-4" noValidate>
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
            rows={4}
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

          <div>
            <label htmlFor="service-image" className="mb-1.5 block text-sm font-medium text-ink-soft">
              Image
            </label>
            <label
              htmlFor="service-image"
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-inner)] border border-dashed border-line-strong bg-surface-sunk px-3 py-2.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <ImagePlus size={16} aria-hidden="true" />
              {form.image ? form.image.name : 'Choose an image (optional, max 4 MB)'}
            </label>
            <input
              id="service-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.files?.[0] ?? null }))}
            />
            {errors.image && <p className="mt-1.5 text-xs text-rose">{errors.image}</p>}
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-inner)] border border-line p-3">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={update('is_active')}
              className="size-4 accent-[var(--color-accent)]"
            />
            <span>
              <span className="block text-sm font-medium text-ink">Live in the directory</span>
              <span className="block text-xs text-muted">Uncheck to hide it without deleting it.</span>
            </span>
          </label>
        </form>
      </Modal>

      {/* --- Delete confirmation --------------------------------------- */}
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        eyebrow="Careful"
        title="Delete this service?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">{deleting?.title}</span> will be removed. If it has
          past bookings it is archived instead, so your history stays intact — and a service with
          upcoming bookings cannot be deleted at all.
        </p>
      </Modal>
    </>
  )
}
