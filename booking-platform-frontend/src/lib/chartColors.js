import { useEffect, useState } from 'react'
import { useTheme } from '@/context/ThemeContext'

/*
  Recharts needs real colour values — it cannot resolve a CSS custom property
  passed as `fill="var(--color-accent)"`. Hardcoding hex here is what let the
  charts drift out of sync when the palette changed, and it also meant dark
  mode rendered light-mode chart colours.

  So the values are read off the document once per theme change, keeping the
  charts on exactly the same tokens as everything else.
*/
function read() {
  const styles = getComputedStyle(document.documentElement)
  const value = (name, fallback) => styles.getPropertyValue(name).trim() || fallback

  return {
    accent: value('--color-accent', '#a63d2a'),
    sage: value('--color-sage', '#4a6b58'),
    gold: value('--color-gold', '#8a6a2f'),
    rose: value('--color-rose', '#8f3040'),
    muted: value('--color-muted', '#837e73'),
    ink: value('--color-ink', '#17150f'),
    line: value('--color-line', '#e8e4da'),
    surface: value('--color-surface', '#ffffff'),
    surfaceSunk: value('--color-surface-sunk', '#f2f0ea'),
  }
}

export function useChartColors() {
  const { theme } = useTheme()
  const [colors, setColors] = useState(read)

  useEffect(() => {
    // The class swap happens in an effect too, so defer a frame to be sure the
    // new custom properties are live before reading them.
    const id = requestAnimationFrame(() => setColors(read()))
    return () => cancelAnimationFrame(id)
  }, [theme])

  return colors
}

/** Booking statuses share one mapping across every chart and legend. */
export function statusColors(colors) {
  return {
    pending: colors.gold,
    confirmed: colors.sage,
    completed: colors.muted,
    cancelled: colors.rose,
  }
}
