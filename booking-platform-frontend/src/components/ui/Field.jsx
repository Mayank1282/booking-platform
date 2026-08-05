import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const baseInput =
  'w-full rounded-[var(--radius-inner)] border bg-surface px-3 text-sm text-ink placeholder:text-muted/70 ' +
  'transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed'

/** Shared label + error + hint wrapper so every form reads the same. */
export function Field({ label, error, hint, required, htmlFor, className = '', children }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-soft">
          {label}
          {required && <span className="ml-0.5 text-accent">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-rose">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  )
}

export function Input({ label, error, hint, required, className = '', id, type = 'text', ...props }) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  // Password fields get a reveal toggle. The input type is swapped rather
  // than the value exposed, so autofill and password managers still work.
  const isPassword = type === 'password'
  const [revealed, setRevealed] = useState(false)
  const resolvedType = isPassword && revealed ? 'text' : type

  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={inputId} className={className}>
      <div className="relative">
        <input
          id={inputId}
          type={resolvedType}
          // 44px tall so it is comfortable to tap on a phone.
          className={`${baseInput} h-11 ${isPassword ? 'pr-11' : ''} ${error ? 'border-rose' : 'border-line-strong'}`}
          aria-invalid={error ? 'true' : undefined}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((shown) => !shown)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            // Not a tab stop — it sits between the password field and the
            // submit button, and stopping there each time is a nuisance.
            tabIndex={-1}
            className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-[var(--radius-inner)] text-muted transition-colors hover:text-accent"
          >
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </Field>
  )
}

export function Textarea({ label, error, hint, required, rows = 4, className = '', id, ...props }) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={inputId} className={className}>
      <textarea
        id={inputId}
        rows={rows}
        className={`${baseInput} resize-y py-2.5 ${error ? 'border-rose' : 'border-line-strong'}`}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
    </Field>
  )
}

export function Select({ label, error, hint, required, children, className = '', id, ...props }) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={inputId} className={className}>
      <select
        id={inputId}
        className={`${baseInput} h-11 cursor-pointer ${error ? 'border-rose' : 'border-line-strong'}`}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      >
        {children}
      </select>
    </Field>
  )
}
