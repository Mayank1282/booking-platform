import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * Centred on desktop, bottom-sheet on mobile — the same pattern used across
 * the portfolio, so the mobile interaction stays familiar between projects.
 */
export default function Modal({ open, onClose, title, eyebrow, children, footer, size = 'md' }) {
  const panelRef = useRef(null)

  /*
    `onClose` is passed as an inline arrow by every caller, so its identity
    changes on each render. Holding it in a ref keeps it out of the effect's
    dependencies — otherwise the effect re-ran on every keystroke and its
    `panelRef.focus()` stole focus back from whatever field was being typed in,
    letting only one character through at a time.
  */
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.()
    }

    document.addEventListener('keydown', onKeyDown)

    // Freeze the page behind the sheet so it cannot scroll under the overlay.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the panel once on open, so screen readers land inside the dialog.
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
    // Deliberately keyed on `open` alone — see the note above.
  }, [open])

  if (!open) return null

  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={[
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden bg-surface',
          'rounded-t-[var(--radius-card)] sm:rounded-[var(--radius-card)]',
          'border border-line shadow-[var(--shadow-pop)] animate-rise focus:outline-none',
          widths[size] ?? widths.md,
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-inner)] text-muted transition-colors hover:bg-surface-sunk hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="scroll-rail flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>

        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
