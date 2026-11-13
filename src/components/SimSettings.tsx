import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fmtNumber } from '../lib/format'
import { Close } from './Icons'


/** Plain decimal string (no exponent) for a positive number. */
const plain = (n: number) => Number(n.toPrecision(6)).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 12 })

function parse(s: string): number | null {
  const n = Number(s.trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

function rateText(perSec: number, noun: string) {
  if (perSec >= 1) return `≈ ${fmtNumber(perSec, 3)} ${noun}/s`
  const everySec = 1 / perSec
  return everySec < 120 ? `≈ 1 ${noun.replace(/s$/, '')} every ${fmtNumber(everySec, 2)} s` : `≈ 1 ${noun.replace(/s$/, '')} every ${fmtNumber(everySec / 60, 2)} min`
}

function Field({
  tone,
  label,
  unit,
  value,
  onChange,
  presets,
  isAuto,
  rateOf,
  cap,
  noun,
  detail,
}: {
  tone: 'burn' | 'mint'
  label: string
  unit: string
  value: string
  onChange: (s: string) => void
  presets: number[]
  isAuto: boolean
  rateOf: (unit: number) => number
  cap: number
  noun: string
  detail?: (n: number) => string
}) {
  const id = useId()
  const n = parse(value)
  const perSec = n ? rateOf(n) : 0
  return (
    <div className="sim-field">
      <label htmlFor={id} className="sim-field-label">
        {label}
      </label>
      <div className={`sim-field-input ${n ? '' : 'invalid'} ${tone}`}>
        <span className="sim-field-prefix">1 {noun.replace(/s$/, '')} =</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!n}
        />
        <span className="sim-field-unit">{unit}</span>
      </div>
      <div className="chips">
        {presets.map((p) => (
          <button type="button" key={p} className={`chip ${tone} ${n === p ? 'on' : ''}`} onClick={() => onChange(plain(p))}>
            {plain(p)}
          </button>
        ))}
      </div>
      <p className="sim-field-help">
        {n ? (
          <>
            {detail && <span>{detail(n)} · </span>}
            <span>{rateText(perSec, noun)}</span>
            {isAuto && <span className="muted"> · default</span>}
          </>
        ) : (
          <span className="sim-field-error">Enter a number greater than 0</span>
        )}
      </p>
      {n && perSec > cap && (
        <p className="sim-field-warn">
          That's {fmtNumber(perSec, 3)}/s, above the {cap}/s display limit, so the animation will be capped and run slower than the
          real rate.
        </p>
      )}
    </div>
  )
}

/** One particle kind the user can rescale. `current` null = automatic. */
export interface SimFieldSpec {
  key: string
  label: string
  unit: string
  noun: string
  presets: number[]
  current: number | null
  auto: number
  /** real amount per second, so the preview shows particles per second */
  ratePerSec: number
  cap: number
  detail?: (n: number) => string
}

export function SimSettings({
  open,
  onClose,
  tone,
  eyebrow,
  intro,
  fields,
  onApply,
}: {
  open: boolean
  onClose: () => void
  tone: 'burn' | 'mint'
  eyebrow: string
  intro: string
  fields: SimFieldSpec[]
  /** values in the same order as `fields`; null = automatic */
  onApply: (values: (number | null)[]) => void
}) {
  const [values, setValues] = useState<string[]>([])
  const [autos, setAutos] = useState<boolean[]>([])
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // load current values each time the modal opens
  useEffect(() => {
    if (!open) return
    setValues(fields.map((f) => plain(f.current ?? f.auto)))
    setAutos(fields.map((f) => f.current == null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Keep the latest onClose in a ref: the parent passes a new function on every
  // render (live data refreshes every few seconds), and depending on it here
  // re-ran this effect and stole focus back to the first input mid-typing.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    window.addEventListener('keydown', onKey)
    // focus the first field once, when the modal opens
    const t = setTimeout(() => dialogRef.current?.querySelector('input')?.focus(), 50)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open])

  const parsed = fields.map((_, i) => parse(values[i] ?? ''))
  const valid = values.length === fields.length && parsed.every((n) => n != null)
  const setAt = <T,>(arr: T[], i: number, v: T) => arr.map((x, j) => (j === i ? v : x))

  const apply = () => {
    if (!valid) return
    onApply(parsed.map((n, i) => (autos[i] ? null : n)))
    onClose()
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            className={`modal modal-${tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">{eyebrow}</p>
                <h3 id={titleId}>Particle scale</h3>
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Close settings">
                <Close width={18} height={18} />
              </button>
            </div>
            <p className="modal-intro">{intro}</p>

            <form
              onSubmit={(ev) => {
                ev.preventDefault()
                apply()
              }}
            >
              {fields.map((f, i) => (
                <Field
                  key={f.key}
                  tone={tone}
                  label={f.label}
                  unit={f.unit}
                  noun={f.noun}
                  value={values[i] ?? ''}
                  onChange={(v) => {
                    setValues((a) => setAt(a, i, v))
                    setAutos((a) => setAt(a, i, false))
                  }}
                  presets={f.presets}
                  isAuto={autos[i] ?? true}
                  rateOf={(u) => f.ratePerSec / u}
                  cap={f.cap}
                  detail={f.detail}
                />
              ))}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setValues(fields.map((f) => plain(f.auto)))
                    setAutos(fields.map(() => true))
                  }}
                >
                  Reset to default
                </button>
                <span className="spacer" />
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className={`btn btn-primary btn-${tone}`} disabled={!valid}>
                  Apply
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
