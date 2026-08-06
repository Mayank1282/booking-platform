/*
  Status colours map to the warm palette rather than generic semantic colours:
  gold for waiting, sage for confirmed, ink for done, rose for cancelled.
*/
const tones = {
  neutral: 'bg-surface-sunk text-ink-soft border-line',
  accent: 'bg-accent-soft text-accent-ink border-accent/20',
  sage: 'bg-sage-soft text-sage border-sage/25',
  gold: 'bg-gold-soft text-gold border-gold/25',
  rose: 'bg-rose-soft text-rose border-rose/25',
  ink: 'bg-ink text-canvas border-ink',
}

export const bookingTone = {
  pending: 'gold',
  confirmed: 'sage',
  completed: 'ink',
  cancelled: 'rose',
  // A hold that ran out before payment. Neutral, because nothing happened.
  expired: 'neutral',
}

export const paymentTone = {
  pending: 'gold',
  processing: 'gold',
  succeeded: 'sage',
  failed: 'rose',
  refunded: 'neutral',
}

export default function Badge({ tone = 'neutral', size = 'md', className = '', children }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[0.6875rem]' : 'px-2.5 py-1 text-xs',
        tones[tone] ?? tones.neutral,
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
