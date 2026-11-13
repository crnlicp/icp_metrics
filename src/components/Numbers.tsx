import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { subscribeTicker } from '../lib/ticker'

/**
 * A value that grows in real time: base + rate × (now − since).
 * Rendered by the shared ticker straight into the DOM.
 */
export function LiveValue({
  base = 0,
  ratePerSec,
  sinceMs,
  decimals,
  className,
}: {
  base?: number
  ratePerSec: number
  sinceMs: number
  decimals: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  // Integrate the rate piecewise: when the rate changes (every few seconds with
  // live data) continue from the value already shown instead of recomputing
  // rate × total elapsed, which would make the counter jump or run backwards.
  const anchor = useRef<{ value: number; at: number; rate: number; base: number; since: number } | null>(null)

  useEffect(() => {
    const now = Date.now()
    const a = anchor.current
    if (!a || a.base !== base || a.since !== sinceMs) {
      anchor.current = { value: base + (ratePerSec * (now - sinceMs)) / 1000, at: now, rate: ratePerSec, base, since: sinceMs }
    } else if (a.rate !== ratePerSec) {
      a.value += (a.rate * (now - a.at)) / 1000
      a.at = now
      a.rate = ratePerSec
    }
  }, [base, ratePerSec, sinceMs])

  useEffect(() => {
    const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    const render = (now: number) => {
      const a = anchor.current
      if (ref.current && a) ref.current.textContent = fmt.format(a.value + (a.rate * (now - a.at)) / 1000)
    }
    render(Date.now())
    return subscribeTicker(render)
  }, [decimals])
  return <span ref={ref} className={className} />
}

/** Elapsed mm:ss since a moment, ticking. */
export function Elapsed({ sinceMs }: { sinceMs: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(
    () =>
      subscribeTicker((now) => {
        const s = Math.floor((now - sinceMs) / 1000)
        const h = Math.floor(s / 3600)
        const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
        const ss = String(s % 60).padStart(2, '0')
        if (ref.current) ref.current.textContent = h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
      }),
    [sinceMs],
  )
  return <span ref={ref}>00:00</span>
}

/** A number that tweens smoothly whenever `value` changes. */
export function AnimatedNumber({
  value,
  format,
  duration = 0.9,
  className,
}: {
  value: number | null
  format: (n: number | null) => string
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef<number | null>(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = prev.current
    prev.current = value
    if (value == null || from == null || reduce || from === value) {
      el.textContent = format(value)
      return
    }
    // tween in log space for values that jump by orders of magnitude (s → year)
    const logScale = from > 0 && value > 0 && Math.abs(Math.log10(value / from)) > 1
    const a = logScale ? Math.log(from) : from
    const b = logScale ? Math.log(value) : value
    const ctrl = animate(a, b, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (el.textContent = format(logScale ? Math.exp(v) : v)),
    })
    return () => ctrl.stop()
  }, [value, format, duration, reduce])
  return <span ref={ref} className={className}>{format(value)}</span>
}
