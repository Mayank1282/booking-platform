import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CalendarOff, Plus, Save, Trash2 } from 'lucide-react'
import api, { errorMessage } from '@/lib/api'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Field'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { SectionTitle } from '@/components/ui/Misc'
import { dateTime } from '@/lib/format'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ProviderAvailability() {
  const [rules, setRules] = useState([])
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [blockOpen, setBlockOpen] = useState(false)
  const [block, setBlock] = useState({ starts_at: '', ends_at: '', reason: '' })
  const [blockSaving, setBlockSaving] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)

    Promise.all([api.get('/provider/availability/rules'), api.get('/provider/availability/blocks')])
      .then(([ruleRes, blockRes]) => {
        setRules(ruleRes.data.data)
        setBlocks(blockRes.data.data)
      })
      .catch(() => setError('Your availability could not be loaded.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  /* --- Weekly rules -------------------------------------------------- */

  const rulesFor = (day) => rules.filter((rule) => rule.day_of_week === day)

  const addWindow = (day) => {
    setRules((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, day_of_week: day, start_time: '09:00', end_time: '17:00', is_active: true },
    ])
  }

  const updateWindow = (id, patch) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)))
  }

  const removeWindow = (id) => setRules((prev) => prev.filter((rule) => rule.id !== id))

  const saveRules = async () => {
    setSaving(true)

    try {
      const { data } = await api.put('/provider/availability/rules', {
        // The backend replaces the whole schedule, so ids are irrelevant.
        rules: rules.map(({ day_of_week, start_time, end_time, is_active }) => ({
          day_of_week,
          start_time,
          end_time,
          is_active,
        })),
      })

      setRules(data.data)
      toast.success(data.message)
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Those hours could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  /* --- Blocked dates -------------------------------------------------- */

  const saveBlock = async (event) => {
    event.preventDefault()
    setBlockSaving(true)

    try {
      const { data } = await api.post('/provider/availability/blocks', block)
      setBlocks((prev) => [...prev, data.data].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
      setBlockOpen(false)
      setBlock({ starts_at: '', ends_at: '', reason: '' })
      toast.success(data.message)
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setBlockSaving(false)
    }
  }

  const removeBlock = async (id) => {
    try {
      await api.delete(`/provider/availability/blocks/${id}`)
      setBlocks((prev) => prev.filter((entry) => entry.id !== id))
      toast.success('Block removed.')
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    }
  }

  if (loading) return <LoadingState label="Loading availability" />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <>
      <div className="space-y-6">
        <SectionTitle
          eyebrow="Your schedule"
          title="Availability"
          description="Clients only ever see times inside these windows, minus anything already booked."
          action={
            <Button icon={Save} loading={saving} onClick={saveRules}>
              Save hours
            </Button>
          }
        />

        {/* --- Weekly grid --------------------------------------------- */}
        <Card>
          <CardHeader eyebrow="Every week" title="Working hours" />
          <ul className="divide-y divide-line">
            {DAYS.map((day, index) => {
              const windows = rulesFor(index)

              return (
                <li key={day} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="flex items-center justify-between gap-3 sm:w-32 sm:shrink-0">
                      <p className="text-sm font-medium text-ink">{day}</p>
                      <button
                        type="button"
                        onClick={() => addWindow(index)}
                        aria-label={`Add a window on ${day}`}
                        className="flex size-8 items-center justify-center rounded-[var(--radius-inner)] border border-line text-muted transition-colors hover:border-accent hover:text-accent"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className="flex-1 space-y-2">
                      {windows.length === 0 ? (
                        <p className="text-sm text-muted">Closed</p>
                      ) : (
                        windows.map((rule) => (
                          <div key={rule.id} className="flex flex-wrap items-center gap-2">
                            <input
                              type="time"
                              value={rule.start_time}
                              onChange={(event) => updateWindow(rule.id, { start_time: event.target.value })}
                              aria-label={`${day} start time`}
                              className="tabular h-11 rounded-[var(--radius-inner)] border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
                            />
                            <span className="text-muted">–</span>
                            <input
                              type="time"
                              value={rule.end_time}
                              onChange={(event) => updateWindow(rule.id, { end_time: event.target.value })}
                              aria-label={`${day} end time`}
                              className="tabular h-11 rounded-[var(--radius-inner)] border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => removeWindow(rule.id)}
                              aria-label="Remove this window"
                              className="flex size-11 items-center justify-center rounded-[var(--radius-inner)] text-muted transition-colors hover:bg-rose-soft hover:text-rose"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>

        {/* --- Blocked dates ------------------------------------------- */}
        <Card>
          <CardHeader
            eyebrow="Time off"
            title="Blocked dates"
            action={
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => setBlockOpen(true)}>
                Block dates
              </Button>
            }
          />

          {blocks.length === 0 ? (
            <EmptyState
              icon={CalendarOff}
              title="Nothing blocked"
              description="Block a holiday or a busy afternoon and those times disappear from every listing."
            />
          ) : (
            <ul className="divide-y divide-line">
              {blocks.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="tabular truncate text-sm text-ink">
                      {dateTime(entry.starts_at)} → {dateTime(entry.ends_at)}
                    </p>
                    {entry.reason && <p className="mt-0.5 truncate text-xs text-muted">{entry.reason}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBlock(entry.id)}
                    aria-label="Remove block"
                    className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-inner)] text-muted transition-colors hover:bg-rose-soft hover:text-rose"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        eyebrow="Time off"
        title="Block some dates"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBlockOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="block-form" loading={blockSaving}>
              Block these dates
            </Button>
          </>
        }
      >
        <form id="block-form" onSubmit={saveBlock} className="space-y-4" noValidate>
          <Input
            label="From"
            type="datetime-local"
            required
            value={block.starts_at}
            onChange={(event) => setBlock((prev) => ({ ...prev, starts_at: event.target.value }))}
          />
          <Input
            label="Until"
            type="datetime-local"
            required
            value={block.ends_at}
            onChange={(event) => setBlock((prev) => ({ ...prev, ends_at: event.target.value }))}
          />
          <Input
            label="Reason (optional)"
            value={block.reason}
            onChange={(event) => setBlock((prev) => ({ ...prev, reason: event.target.value }))}
            placeholder="Holiday, training, family"
          />
          <p className="text-xs text-muted">
            Existing bookings inside this range are not cancelled — block dates before they fill up.
          </p>
        </form>
      </Modal>
    </>
  )
}
