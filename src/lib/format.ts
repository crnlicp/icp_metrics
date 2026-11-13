const SUFFIXES: [number, string][] = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
]

/** Significant-digit aware number formatting that never shows "0.00" for tiny values. */
export function fmtNumber(n: number | null | undefined, sig = 4): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs === 0) return '0'
  if (abs >= 1e6) return fmtCompact(n, 2)
  if (abs >= 1000) return Math.round(n).toLocaleString('en-US')
  const decimals = Math.max(0, Math.min(8, sig - 1 - Math.floor(Math.log10(abs))))
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function fmtCompact(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  for (const [v, s] of SUFFIXES) {
    if (abs >= v) return `${(n / v).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })}${s}`
  }
  return fmtNumber(n, 3)
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('en-US')
}

export function fmtPct(n: number | null | undefined, digits = 2, signed = false): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const v = n * 100
  const abs = Math.abs(v)
  // keep tiny per-second inflation readable
  const d = abs === 0 ? digits : abs < 1e-4 ? 8 : abs < 0.01 ? 5 : abs < 0.1 ? 4 : digits
  const s = v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  return `${signed && v > 0 ? '+' : ''}${s}%`
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e6) return `$${fmtCompact(n, 2)}`
  if (abs >= 100) return `$${Math.round(n).toLocaleString('en-US')}`
  return `$${fmtNumber(n, 3)}`
}

/** Pick decimals for a live ticking counter so the last digit visibly moves. */
export function tickerDecimals(ratePerSec: number): number {
  if (!(ratePerSec > 0)) return 2
  // aim for the last digit to change ~10×/s
  const d = Math.ceil(-Math.log10(ratePerSec / 10))
  return Math.max(0, Math.min(8, d))
}

export function timeAgo(tsSec: number, nowMs = Date.now()): string {
  const s = Math.max(0, Math.round(nowMs / 1000 - tsSec))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

/** Plain decimal (no exponent, no trailing zeros), e.g. 0.001, 0.0005, 2.5. */
export function fmtPlain(n: number | null | undefined, sig = 6): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return Number(n.toPrecision(sig)).toLocaleString('en-US', { maximumFractionDigits: 12 })
}
