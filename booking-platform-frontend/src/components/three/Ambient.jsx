import { Suspense, lazy, useEffect, useState } from 'react'

/*
  The mounting wrapper for every 3D surface on the site.

  Three.js is ~930KB, so it must never be in the critical path. This component
  guards it three ways:

    1. Lazy — one shared chunk, fetched only when a scene is actually mounted.
    2. Deferred — mounting waits for an idle moment, so the page becomes
       readable and interactive before any WebGL work begins.
    3. Optional — small screens and machines without WebGL skip it entirely
       and fall back to a CSS gradient, which is indistinguishable at a glance
       and costs nothing.
*/
const AmbientScene = lazy(() => import('./AmbientScene'))

/** WebGL support is checked once and cached for the session. */
let webglSupported = null

function hasWebGL() {
  if (webglSupported !== null) return webglSupported

  try {
    const canvas = document.createElement('canvas')
    webglSupported = Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    )
  } catch {
    webglSupported = false
  }

  return webglSupported
}

export default function Ambient({
  className = '',
  fallbackClassName = '',
  // Phones get the CSS gradient rather than a WebGL canvas: the field is
  // decorative, and battery and first paint matter more on a small screen.
  minWidth = 768,
  intensity = 1,
  // A framed artwork in its own panel rather than a wash behind live text.
  contained = false,
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.innerWidth < minWidth || !hasWebGL()) return

    // Wait for idle so the scene never competes with first paint.
    const schedule = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 400))
    const cancel = window.cancelIdleCallback ?? clearTimeout
    const handle = schedule(() => setReady(true), { timeout: 2500 })

    return () => cancel(handle)
  }, [minWidth])

  /* The fallback is also what shows while the chunk loads, so there is never
     an empty hole where the scene will be. */
  const fallback = (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${fallbackClassName}`}
    >
      <div className="absolute top-[-20%] left-[10%] size-[36rem] rounded-full bg-accent/10 blur-[120px]" />
      <div className="absolute right-[-10%] bottom-[-25%] size-[32rem] rounded-full bg-sage/10 blur-[130px]" />
    </div>
  )

  if (!ready) return fallback

  return (
    <Suspense fallback={fallback}>
      <AmbientScene className={className} intensity={intensity} contained={contained} />
    </Suspense>
  )
}
