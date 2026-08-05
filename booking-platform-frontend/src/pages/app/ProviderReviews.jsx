import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquareQuote } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Card from '@/components/ui/Card'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { Avatar, Pagination, Rating, SectionTitle } from '@/components/ui/Misc'
import { relative } from '@/lib/format'

export default function ProviderReviews() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .get('/provider/reviews', { params: { page } })
      .then(({ data }) => {
        if (cancelled) return
        setReviews(data.data)
        setMeta(data.meta)
      })
      .catch(() => !cancelled && setError('Your reviews could not be loaded.'))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [page])

  const profile = user?.provider_profile

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="What clients said"
        title="Reviews"
        description="Left only after a completed booking, so every one of these is from real work."
      />

      {/* Rating summary */}
      {profile?.rating_count > 0 && (
        <Card className="flex flex-wrap items-center gap-6 p-5 sm:p-6">
          <div>
            <p className="tabular text-5xl font-semibold text-ink">
              {Number(profile.rating_avg).toFixed(1)}
            </p>
            <Rating value={profile.rating_avg} showCount={false} size={15} className="mt-2" />
          </div>
          <div className="border-l border-line pl-6">
            <p className="tabular text-sm text-ink-soft">
              {profile.rating_count} review{profile.rating_count === 1 ? '' : 's'}
            </p>
            <p className="mt-1 text-xs text-muted">Across all your services</p>
          </div>
        </Card>
      )}

      {loading ? (
        <LoadingState label="Loading reviews" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setPage(1)} />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquareQuote}
          title="No reviews yet"
          description="Once you complete a booking, the client is prompted to leave one."
          className="rounded-[var(--radius-card)] border border-line bg-surface"
        />
      ) : (
        <>
          <ul className="grid gap-4 lg:grid-cols-2">
            {reviews.map((review) => (
              <li key={review.id}>
                <Card className="h-full p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={review.client?.name} src={review.client?.avatar_url} size={40} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{review.client?.name}</p>
                        <p className="text-xs text-muted">{relative(review.created_at)}</p>
                      </div>
                    </div>
                    <Rating value={review.rating} showCount={false} size={13} />
                  </div>

                  {review.comment && (
                    <p className="mt-3 text-sm leading-relaxed text-ink-soft">{review.comment}</p>
                  )}

                  {review.service && (
                    <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                      For{' '}
                      <Link to={`/services/${review.service.slug}`} className="text-accent hover:underline">
                        {review.service.title}
                      </Link>
                      {review.booking_code && <span className="tabular"> · {review.booking_code}</span>}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>

          <Pagination meta={meta} onPage={setPage} />
        </>
      )}
    </div>
  )
}
