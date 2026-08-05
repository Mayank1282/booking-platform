import { format, formatDistanceToNowStrict, isToday, isTomorrow, parseISO } from 'date-fns'

/** Prices always render in mono — the design system treats them as data. */
export function money(amount, currency = 'INR') {
  const value = Number(amount ?? 0)

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

/** Compact form for stat tiles: ₹1.2L, ₹48.1k. */
export function compactMoney(amount, currency = 'INR') {
  const value = Number(amount ?? 0)

  if (value >= 100000) return `${symbolFor(currency)}${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `${symbolFor(currency)}${(value / 1000).toFixed(1)}k`

  return money(value, currency)
}

const symbolFor = (currency) => (currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '')

export const toDate = (value) => (value instanceof Date ? value : parseISO(value))

export const dateLong = (value) => format(toDate(value), 'EEEE, d MMMM yyyy')
export const dateShort = (value) => format(toDate(value), 'd MMM yyyy')
export const time = (value) => format(toDate(value), 'h:mm a')
export const dateTime = (value) => `${dateShort(value)} · ${time(value)}`
export const isoDay = (value) => format(toDate(value), 'yyyy-MM-dd')

/** "Today", "Tomorrow", else the short date — used on booking cards. */
export function friendlyDay(value) {
  const date = toDate(value)

  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'

  return format(date, 'EEE d MMM')
}

export const relative = (value) => `${formatDistanceToNowStrict(toDate(value))} ago`

export function duration(minutes) {
  const total = Number(minutes ?? 0)
  const hours = Math.floor(total / 60)
  const mins = total % 60

  if (!hours) return `${mins} min`
  if (!mins) return `${hours} hr`

  return `${hours} hr ${mins} min`
}

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
