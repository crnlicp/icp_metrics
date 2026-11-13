import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fmtCompact, fmtNumber } from '../lib/format'
import { MAX_EMBERS_PER_SEC, MAX_FLARES_PER_SEC, type SimUnits } from '../lib/ticker'
import { Close } from './Icons'

const EMBER_PRESETS = [0.0001, 0.0005, 0.001, 0.005, 0.01]
const FLARE_PRESETS = [0.001, 0.005, 0.01, 0.05, 0.1]

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
  label,
  unit,
  value,
  onChange,
  presets,
  autoValue,
  isAuto,
  onAuto,
  rateOf,
  cap,
  noun,
  detail,
}: {
  label: string
  unit: string
  value: string
  onChange: (s: string) => void
  presets: number[]
  autoValue: number
  isAuto: boolean
  onAuto: () => void
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
      <div className={`sim-field-input ${n ? '' : 'invalid'}`}>
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
        <button type="button" className={`chip ${isAuto ? 'on' : ''}`} onClick={onAuto}>
          Auto
        </button>
        {presets.map((p) => (
          <button type="button" key={p} className={`chip ${!isAuto && n === p ? 'on' : ''}`} onClick={() => onChange(plain(p))}>
            {plain(p)}
          </button>
        ))}
      </div>
      <p className="sim-field-help">
        {n ? (
          <>
            {detail && <span>{detail(n)} · </span>}
            <span>{rateText(perSec, noun)}</span>
            {isAuto && <span className="muted"> · auto picks {plain(autoValue)} {unit}</span>}
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

export function SimSettings({
  open,
  onClose,
  units,
  onApply,
  auto,
  tcPerSec,
  icpBurnPerSec,
}: {
  open: boolean
  onClose: () => void
  units: SimUnits
  onApply: (u: SimUnits) => void
  auto: { emberTc: number; flareIcp: number }
  tcPerSec: number
  icpBurnPerSec: number
}) {
  const [ember, setEmber] = useState('')
  const [flare, setFlare] = useState('')
  const [emberAuto, setEmberAuto] = useState(true)
  const [flareAuto, setFlareAuto] = useState(true)
  const dialogRef = useRef<HTMLDivElement>(null)

  // load current values each time the modal opens
  useEffect(() => {
    if (!open) return
    setEmber(plain(units.emberTc ?? auto.emberTc))
    setFlare(plain(units.flareIcp ?? auto.flareIcp))
    setEmberAuto(units.emberTc == null)
    setFlareAuto(units.flareIcp == null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => dialogRef.current?.querySelector('input')?.focus(), 50)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open, onClose])

  const e = parse(ember)
  const f = parse(flare)

  const apply = () => {
    if (!e || !f) return
    onApply({ emberTc: emberAuto ? null : e, flareIcp: flareAuto ? null : f })
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
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sim-title"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">Burn simulation</p>
                <h3 id="sim-title">Particle scale</h3>
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Close settings">
                <Close width={18} height={18} />
              </button>
            </div>
            <p className="modal-intro">
              Choose how much each particle represents. Particles spawn at the real burn rate, so a smaller amount means more
              particles.
            </p>

            <form
              onSubmit={(ev) => {
                ev.preventDefault()
                apply()
              }}
            >
              <Field
                label="Cycle embers"
                unit="TC"
                noun="embers"
                value={ember}
                onChange={(s) => {
                  setEmber(s)
                  setEmberAuto(false)
                }}
                presets={EMBER_PRESETS}
                autoValue={auto.emberTc}
                isAuto={emberAuto}
                onAuto={() => {
                  setEmber(plain(auto.emberTc))
                  setEmberAuto(true)
                }}
                rateOf={(u) => tcPerSec / u}
                cap={MAX_EMBERS_PER_SEC}
                detail={(n) => `${fmtCompact(n * 1e12, 2)} cycles`}
              />
              <Field
                label="ICP flares"
                unit="ICP"
                noun="flares"
                value={flare}
                onChange={(s) => {
                  setFlare(s)
                  setFlareAuto(false)
                }}
                presets={FLARE_PRESETS}
                autoValue={auto.flareIcp}
                isAuto={flareAuto}
                onAuto={() => {
                  setFlare(plain(auto.flareIcp))
                  setFlareAuto(true)
                }}
                rateOf={(u) => icpBurnPerSec / u}
                cap={MAX_FLARES_PER_SEC}
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEmber(plain(auto.emberTc))
                    setFlare(plain(auto.flareIcp))
                    setEmberAuto(true)
                    setFlareAuto(true)
                  }}
                >
                  Reset to auto
                </button>
                <span className="spacer" />
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!e || !f}>
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
