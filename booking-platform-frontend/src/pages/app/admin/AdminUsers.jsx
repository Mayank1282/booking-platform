import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Ban, Search, ShieldCheck, Trash2, UserX } from 'lucide-react'
import api, { errorMessage } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Field'
import { Avatar, Pagination, SectionTitle } from '@/components/ui/Misc'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { dateShort } from '@/lib/format'

const roleTone = { admin: 'accent', provider: 'sage', client: 'neutral' }

export default function AdminUsers() {
  const { user: currentUser } = useAuth()

  const [users, setUsers] = useState([])
  const [meta, setMeta] = useState(null)
  const [filters, setFilters] = useState({ q: '', role: '', status: '' })
  const [draft, setDraft] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [suspending, setSuspending] = useState(null)
  const [reason, setReason] = useState('')
  const [erasing, setErasing] = useState(null)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)

    api
      .get('/admin/users', {
        params: {
          q: filters.q || undefined,
          role: filters.role || undefined,
          status: filters.status || undefined,
          page,
        },
      })
      .then(({ data }) => {
        setUsers(data.data)
        setMeta(data.meta)
      })
      .catch(() => setError('The user list could not be loaded.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [filters, page])

  const setFilter = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const suspend = async () => {
    setBusy(true)

    try {
      const { data } = await api.post(`/admin/users/${suspending.id}/suspend`, {
        reason: reason.trim() || undefined,
      })
      toast.success(data.message)
      setSuspending(null)
      setReason('')
      load()
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  const reinstate = async (user) => {
    try {
      const { data } = await api.post(`/admin/users/${user.id}/reinstate`)
      toast.success(data.message)
      load()
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    }
  }

  const erase = async () => {
    setBusy(true)

    try {
      const { data } = await api.delete(`/admin/users/${erasing.id}`)
      toast.success(data.message, { duration: 6000 })
      setErasing(null)
      setConfirmEmail('')
      load()
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="space-y-6">
        <SectionTitle
          eyebrow="Administration"
          title="Users"
          description="Suspend an account to block access, or erase it to scrub the personal data and release the email address."
        />

        {/* Filters */}
        <div className="flex flex-col gap-3 lg:flex-row">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setFilter({ q: draft.trim() })
            }}
            className="relative flex-1"
          >
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Search name, email or business…"
              aria-label="Search users"
              className="h-11 w-full rounded-[var(--radius-inner)] border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
            />
          </form>

          <div className="flex gap-2">
            <select
              value={filters.role}
              onChange={(event) => setFilter({ role: event.target.value })}
              aria-label="Filter by role"
              className="h-11 flex-1 cursor-pointer rounded-[var(--radius-inner)] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none lg:w-40 lg:flex-none"
            >
              <option value="">All roles</option>
              <option value="client">Clients</option>
              <option value="provider">Providers</option>
              <option value="admin">Admins</option>
            </select>

            <select
              value={filters.status}
              onChange={(event) => setFilter({ status: event.target.value })}
              aria-label="Filter by status"
              className="h-11 flex-1 cursor-pointer rounded-[var(--radius-inner)] border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none lg:w-40 lg:flex-none"
            >
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading users" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : users.length === 0 ? (
          <EmptyState
            icon={UserX}
            title="No users match"
            description="Try a different search or clear the filters."
            className="rounded-[var(--radius-card)] border border-line bg-surface"
          />
        ) : (
          <>
            {/* Desktop table */}
            <Card className="hidden overflow-hidden lg:block">
              <div className="scroll-rail">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      {['User', 'Role', 'Activity', 'Joined', 'Status', ''].map((heading) => (
                        <th key={heading} className="eyebrow px-5 py-3 font-medium">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {users.map((user) => (
                      <tr key={user.id} className="transition-colors hover:bg-surface-sunk">
                        <td className="px-5 py-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar name={user.name} src={user.avatar_url} size={34} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">{user.name}</p>
                              <p className="truncate text-xs text-muted">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={roleTone[user.role]} size="sm">
                            {user.role_label}
                          </Badge>
                          {user.business_name && (
                            <p className="mt-1 truncate text-xs text-muted">{user.business_name}</p>
                          )}
                        </td>
                        <td className="tabular px-5 py-3 text-xs text-muted">
                          {user.role === 'provider'
                            ? `${user.services_count ?? 0} listings · ${user.bookings_as_provider_count ?? 0} bookings`
                            : `${user.bookings_as_client_count ?? 0} bookings`}
                        </td>
                        <td className="tabular px-5 py-3 text-muted">{dateShort(user.created_at)}</td>
                        <td className="px-5 py-3">
                          {user.is_anonymised ? (
                            <Badge tone="neutral" size="sm">
                              Erased
                            </Badge>
                          ) : user.is_suspended ? (
                            <Badge tone="rose" size="sm">
                              Suspended
                            </Badge>
                          ) : (
                            <Badge tone="sage" size="sm">
                              Active
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <UserActions
                            user={user}
                            currentUser={currentUser}
                            onSuspend={() => setSuspending(user)}
                            onReinstate={() => reinstate(user)}
                            onErase={() => setErasing(user)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobile cards */}
            <ul className="space-y-3 lg:hidden">
              {users.map((user) => (
                <li key={user.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={user.name} src={user.avatar_url} size={38} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                          <p className="truncate text-xs text-muted">{user.email}</p>
                        </div>
                      </div>
                      {user.is_anonymised ? (
                        <Badge tone="neutral" size="sm">Erased</Badge>
                      ) : user.is_suspended ? (
                        <Badge tone="rose" size="sm">Suspended</Badge>
                      ) : (
                        <Badge tone="sage" size="sm">Active</Badge>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                      <Badge tone={roleTone[user.role]} size="sm">
                        {user.role_label}
                      </Badge>
                      <span className="tabular text-xs text-muted">{dateShort(user.created_at)}</span>
                    </div>

                    <div className="mt-3">
                      <UserActions
                        user={user}
                        currentUser={currentUser}
                        onSuspend={() => setSuspending(user)}
                        onReinstate={() => reinstate(user)}
                        onErase={() => setErasing(user)}
                      />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>

            <Pagination meta={meta} onPage={setPage} />
          </>
        )}
      </div>

      {/* --- Suspend --------------------------------------------------- */}
      <Modal
        open={Boolean(suspending)}
        onClose={() => setSuspending(null)}
        eyebrow={suspending?.email}
        title="Suspend this account?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspending(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={suspend}>
              Suspend
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">{suspending?.name}</span> will be signed out
          everywhere and blocked from signing back in. Their data and bookings are untouched, and
          you can reinstate them at any time.
        </p>
        <Input
          label="Reason (shown to them at sign-in)"
          className="mt-4"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Repeated no-shows"
        />
      </Modal>

      {/* --- Erase ------------------------------------------------------ */}
      <Modal
        open={Boolean(erasing)}
        onClose={() => setErasing(null)}
        eyebrow="This cannot be undone"
        title="Erase this account?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setErasing(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={confirmEmail.trim() !== erasing?.email}
              onClick={erase}
            >
              Erase permanently
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm leading-relaxed text-muted">
          <p>
            Every personal detail on{' '}
            <span className="font-medium text-ink">{erasing?.name}</span> is scrubbed and{' '}
            <span className="tabular font-medium text-ink">{erasing?.email}</span> becomes free to
            register again.
          </p>
          <p>
            Upcoming bookings are cancelled and any settled payment refunded. Past bookings and the
            payment ledger are kept — they belong to the other party too, so the record survives
            with the personal data removed.
          </p>
        </div>

        <Input
          label="Type the email address to confirm"
          className="mt-4"
          value={confirmEmail}
          onChange={(event) => setConfirmEmail(event.target.value)}
          placeholder={erasing?.email}
          autoComplete="off"
        />
      </Modal>
    </>
  )
}

/** Row actions, with the guards the API also enforces server-side. */
function UserActions({ user, currentUser, onSuspend, onReinstate, onErase }) {
  const isSelf = user.id === currentUser?.id

  if (user.is_anonymised) {
    return <span className="text-xs text-muted">No actions</span>
  }

  return (
    <div className="flex items-center gap-1">
      {user.is_suspended ? (
        <button
          type="button"
          onClick={onReinstate}
          aria-label="Reinstate account"
          title="Reinstate"
          className="flex size-9 items-center justify-center rounded-[var(--radius-inner)] text-muted transition-colors hover:bg-sage-soft hover:text-sage"
        >
          <ShieldCheck size={16} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onSuspend}
          disabled={isSelf}
          aria-label="Suspend account"
          title={isSelf ? 'You cannot suspend yourself' : 'Suspend'}
          className="flex size-9 items-center justify-center rounded-[var(--radius-inner)] text-muted transition-colors hover:bg-gold-soft hover:text-gold disabled:pointer-events-none disabled:opacity-30"
        >
          <Ban size={16} />
        </button>
      )}

      <button
        type="button"
        onClick={onErase}
        disabled={isSelf}
        aria-label="Erase account"
        title={isSelf ? 'You cannot erase your own account' : 'Erase'}
        className="flex size-9 items-center justify-center rounded-[var(--radius-inner)] text-muted transition-colors hover:bg-rose-soft hover:text-rose disabled:pointer-events-none disabled:opacity-30"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}
