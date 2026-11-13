// A single shared requestAnimationFrame loop for all live counters.
// Counters write straight to the DOM, so React never re-renders at 60fps.

type Sub = (nowMs: number) => void
const subs = new Set<Sub>()
let raf = 0
let last = 0
const FRAME_MS = 1000 / 30 // text doesn't need more than 30fps

function loop(t: number) {
  raf = requestAnimationFrame(loop)
  if (t - last < FRAME_MS) return
  last = t
  const now = Date.now()
  subs.forEach((s) => s(now))
}

export function subscribeTicker(fn: Sub): () => void {
  subs.add(fn)
  if (!raf) raf = requestAnimationFrame(loop)
  return () => {
    subs.delete(fn)
    if (!subs.size && raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }
}

/** Choose a "nice" value per particle (1/2/5 × 10^k) so spawn rate lands near `target`/s. */
export function niceUnit(ratePerSec: number, target = 40): number {
  if (!(ratePerSec > 0)) return 1
  const raw = ratePerSec / target
  const exp = Math.floor(Math.log10(raw))
  const base = raw / 10 ** exp
  const nice = base < 1.5 ? 1 : base < 3.5 ? 2 : base < 7.5 ? 5 : 10
  return nice * 10 ** exp
}

/** Hard caps on particle spawn rates (per second) to keep the canvas smooth. */
export const MAX_EMBERS_PER_SEC = 200
export const MAX_FLARES_PER_SEC = 8
export const MAX_SPARKS_PER_SEC = 200

/** Default amount per ember (TC), flare (ICP) and spark (ICP) until the user changes it. */
export const DEFAULT_PARTICLE_UNIT = 0.1

/** Preset particle sizes offered in the settings modals. */
export const EMBER_PRESETS = [0.001, 0.01, 0.05, 0.1, 0.5, 1]
export const FLARE_PRESETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1]
export const SPARK_PRESETS = [0.01, 0.05, 0.1, 0.5, 1, 5]

export interface SimUnits {
  /** TC represented by one ember; null = automatic */
  emberTc: number | null
  /** ICP represented by one flare; null = automatic */
  flareIcp: number | null
  /** ICP represented by one mint spark; null = automatic */
  sparkIcp: number | null
}

const KEY = 'icp-pulse:sim-units'

export function loadSimUnits(): SimUnits {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    const ok = (n: unknown) => (typeof n === 'number' && n > 0 && Number.isFinite(n) ? n : null)
    if (v && typeof v === 'object') return { emberTc: ok(v.emberTc), flareIcp: ok(v.flareIcp), sparkIcp: ok(v.sparkIcp) }
  } catch {
    /* storage unavailable: fall back to automatic */
  }
  return { emberTc: null, flareIcp: null, sparkIcp: null }
}

export function saveSimUnits(u: SimUnits) {
  try {
    localStorage.setItem(KEY, JSON.stringify(u))
  } catch {
    /* ignore */
  }
}
