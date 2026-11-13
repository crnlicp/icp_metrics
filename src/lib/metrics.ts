import type { GovernanceSnapshot, Point } from './api'

/* ------------------------------------------------------------------
 * Units
 *   cycles      : raw cycles. 1 TC (trillion cycles) = 1e12 cycles = 1 XDR.
 *   e8s         : 1 ICP = 1e8 e8s.
 *   xdrPermyriad: XDR per ICP × 1e4  → ICP per TC = 1e4 / xdrPermyriad.
 * ------------------------------------------------------------------ */

export const E8S = 1e8
export const TC = 1e12
export const DAY = 86_400
export const DAYS_PER_YEAR = 365.25
export const DAYS_PER_MONTH = DAYS_PER_YEAR / 12 // 30.4375

export type TimeframeKey = 'second' | 'hour' | 'day' | 'month' | 'year'

export const TIMEFRAMES: { key: TimeframeKey; label: string; short: string; seconds: number }[] = [
  { key: 'second', label: 'Per second', short: 's', seconds: 1 },
  { key: 'hour', label: 'Per hour', short: 'h', seconds: 3600 },
  { key: 'day', label: 'Per day', short: 'day', seconds: DAY },
  { key: 'month', label: 'Per month', short: 'mo', seconds: DAY * DAYS_PER_MONTH },
  { key: 'year', label: 'Per year', short: 'yr', seconds: DAY * DAYS_PER_YEAR },
]

export interface RawData {
  cycleBurnNow: Point // cycles/s
  cycleBurnSeries: Point[] // hourly cycles/s
  xdrPermyriad: number
  icpUsd: number | null
  icpUsdChange24h: number | null
  supplySeries: Point[] // e8s, daily
  burnedSeries: Point[] // cumulative e8s, daily
  supplyLatest: Point | null
  burnedLatest: Point | null
  rewardEvents: Point[] // e8s per daily reward event
  npRewards: Point[] // e8s per monthly node-provider distribution
  governance: GovernanceSnapshot | null
  maturityModulationBp: number | null
}

/* ---------------- series helpers ---------------- */

/** Last point with t <= ts (series must be sorted ascending). */
export function valueAt(series: Point[], ts: number): Point | null {
  let found: Point | null = null
  for (const p of series) {
    if (p[0] <= ts) found = p
    else break
  }
  return found
}

/**
 * Average per-day rate of change of a cumulative series over the trailing
 * `days` window, using the real timestamps of the bracketing points.
 */
export function trailingRatePerDay(series: Point[], days: number): number | null {
  if (series.length < 2) return null
  const end = series.at(-1)!
  const start = valueAt(series, end[0] - days * DAY) ?? series[0]
  const spanDays = (end[0] - start[0]) / DAY
  if (spanDays <= 0) return null
  return (end[1] - start[1]) / spanDays
}

/** Per-day change between the last two points of a daily cumulative series (the last complete day). */
export function lastDayRate(series: Point[]): number | null {
  if (series.length < 2) return null
  const [a, b] = series.slice(-2)
  const spanDays = (b[0] - a[0]) / DAY
  return spanDays > 0 ? (b[1] - a[1]) / spanDays : null
}

export function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

const dayKey = (ts: number) => Math.floor(ts / DAY)

/** Per-day differences of a cumulative series, keyed by UTC day. */
export function dailyDiffs(series: Point[]): Map<number, number> {
  const out = new Map<number, number>()
  // keep the last point for each UTC day so irregular samples don't double count
  const byDay = new Map<number, Point>()
  for (const p of series) byDay.set(dayKey(p[0]), p)
  const days = [...byDay.keys()].sort((a, b) => a - b)
  for (let i = 1; i < days.length; i++) {
    if (days[i] - days[i - 1] !== 1) continue
    out.set(days[i], byDay.get(days[i])![1] - byDay.get(days[i - 1])![1])
  }
  return out
}

export interface DailyFlow {
  ts: number // start of UTC day, seconds
  burnedIcp: number
  mintedIcp: number
  netIcp: number
}

/**
 * Daily gross mint is derived from the ledger identity
 *   Δsupply = minted − burned   ⇒   minted = Δsupply + burned
 * (total supply only changes through mints and burns, incl. fees).
 */
export function dailyFlows(supply: Point[], burned: Point[]): DailyFlow[] {
  const dS = dailyDiffs(supply)
  const dB = dailyDiffs(burned)
  const out: DailyFlow[] = []
  for (const [day, ds] of dS) {
    const db = dB.get(day)
    if (db === undefined) continue
    out.push({ ts: day * DAY, burnedIcp: db / E8S, mintedIcp: (ds + db) / E8S, netIcp: ds / E8S })
  }
  return out.sort((a, b) => a.ts - b.ts)
}

/* ---------------- derived metrics ---------------- */

export interface Rates {
  /** per-second rates — multiply by TIMEFRAMES[].seconds for other frames */
  cyclesPerSec: number
  tcPerSec: number
  cyclesPerSec7dAvg: number | null
  /** ICP-equivalent of the current cycle burn (cycles priced at today's XDR rate) */
  cycleImpliedIcpPerSec: number
  /** ICP actually burned on the ledger (7-day trailing average) */
  ledgerBurnIcpPerSec: number | null
  /** ICP burned on the ledger during the last complete UTC day (what the ICP dashboard shows) */
  ledgerBurnIcpPerSecLastDay: number | null
  ledgerBurnIcpPerSec30d: number | null
  /** ICP actually minted on the ledger, 30-day trailing average */
  mintIcpPerSec: number | null
  mintIcpPerSec90d: number | null
  /** reward-based mint estimate (maturity + node providers) */
  votingRewardsIcpPerSec: number | null
  nodeProviderIcpPerSec: number | null
  rewardsEstimateIcpPerSec: number | null
  netIcpPerSec: number | null
}

export interface Derived {
  rates: Rates
  icpPerTc: number
  xdrPerIcp: number
  icpUsd: number | null
  icpUsdChange24h: number | null
  supplyIcp: number | null
  supplyTs: number | null
  totalBurnedIcp: number | null
  totalBurnedTs: number | null
  inflation: {
    grossAnnual: number | null // ledger mint / supply
    netAnnual: number | null // (mint − burn) / supply
    realized365: number | null // actual supply change over the past year
    rewardsAnnual: number | null // reward-driven issuance commitment / supply
  }
  /** share of new issuance cancelled by burn (0..∞) */
  burnToMint: number | null
  /** cycle burn rate (TC/s) required for burn to fully offset ledger minting */
  breakEvenTcPerSec: number | null
  stakedRatio: number | null
  totalMaturityIcp: number | null
  maturityModulationPct: number | null
  daily: DailyFlow[]
}

export function derive(raw: RawData): Derived {
  const icpPerTc = 1e4 / raw.xdrPermyriad
  const xdrPerIcp = raw.xdrPermyriad / 1e4

  const cyclesPerSec = raw.cycleBurnNow[1]
  const tcPerSec = cyclesPerSec / TC
  const cyclesPerSec7dAvg = mean(raw.cycleBurnSeries.map((p) => p[1]))

  const perSec = (perDayE8s: number | null) => (perDayE8s == null ? null : perDayE8s / E8S / DAY)

  const ledgerBurnIcpPerSec = perSec(trailingRatePerDay(raw.burnedSeries, 7))
  const ledgerBurnIcpPerSec30d = perSec(trailingRatePerDay(raw.burnedSeries, 30))
  const ledgerBurnIcpPerSecLastDay = perSec(lastDayRate(raw.burnedSeries))

  const mintOver = (days: number) => {
    const s = trailingRatePerDay(raw.supplySeries, days)
    const b = trailingRatePerDay(raw.burnedSeries, days)
    return s == null || b == null ? null : perSec(s + b)
  }
  const mintIcpPerSec = mintOver(30)
  const mintIcpPerSec90d = mintOver(90)

  // Voting rewards: one event per day; skipped days roll over into the next,
  // so the mean over the window is the true daily average.
  const recentEvents = raw.rewardEvents.filter((p) => p[0] >= (raw.rewardEvents.at(-1)?.[0] ?? 0) - 30 * DAY)
  const votingPerDayE8s = mean(recentEvents.map((p) => p[1]))
  const votingRewardsIcpPerSec = perSec(votingPerDayE8s)

  const lastNp = raw.npRewards.at(-1)?.[1]
  const nodeProviderIcpPerSec = lastNp == null ? null : lastNp / E8S / (DAYS_PER_MONTH * DAY)
  const rewardsEstimateIcpPerSec =
    votingRewardsIcpPerSec == null && nodeProviderIcpPerSec == null
      ? null
      : (votingRewardsIcpPerSec ?? 0) + (nodeProviderIcpPerSec ?? 0)

  const netIcpPerSec =
    mintIcpPerSec == null || ledgerBurnIcpPerSec30d == null ? null : mintIcpPerSec - ledgerBurnIcpPerSec30d

  const supplyPoint = raw.supplyLatest ?? raw.supplySeries.at(-1) ?? null
  const supplyIcp = supplyPoint ? supplyPoint[1] / E8S : null
  const burnedPoint = raw.burnedLatest ?? raw.burnedSeries.at(-1) ?? null

  const yearly = (perSec: number | null) =>
    perSec == null || !supplyIcp ? null : (perSec * DAY * DAYS_PER_YEAR) / supplyIcp

  let realized365: number | null = null
  if (raw.supplySeries.length > 1) {
    const end = raw.supplySeries.at(-1)!
    const start = valueAt(raw.supplySeries, end[0] - 365 * DAY)
    if (start && end[0] - start[0] > 300 * DAY) {
      const years = (end[0] - start[0]) / (DAY * DAYS_PER_YEAR)
      realized365 = Math.pow(end[1] / start[1], 1 / years) - 1
    }
  }

  const g = raw.governance
  return {
    rates: {
      cyclesPerSec,
      tcPerSec,
      cyclesPerSec7dAvg,
      cycleImpliedIcpPerSec: tcPerSec * icpPerTc,
      ledgerBurnIcpPerSec,
      ledgerBurnIcpPerSecLastDay,
      ledgerBurnIcpPerSec30d,
      mintIcpPerSec,
      mintIcpPerSec90d,
      votingRewardsIcpPerSec,
      nodeProviderIcpPerSec,
      rewardsEstimateIcpPerSec,
      netIcpPerSec,
    },
    icpPerTc,
    xdrPerIcp,
    icpUsd: raw.icpUsd,
    icpUsdChange24h: raw.icpUsdChange24h,
    supplyIcp,
    supplyTs: supplyPoint?.[0] ?? null,
    totalBurnedIcp: burnedPoint ? burnedPoint[1] / E8S : null,
    totalBurnedTs: burnedPoint?.[0] ?? null,
    inflation: {
      grossAnnual: yearly(mintIcpPerSec),
      netAnnual: yearly(netIcpPerSec),
      realized365,
      rewardsAnnual: yearly(rewardsEstimateIcpPerSec),
    },
    burnToMint:
      mintIcpPerSec && ledgerBurnIcpPerSec30d != null ? ledgerBurnIcpPerSec30d / mintIcpPerSec : null,
    breakEvenTcPerSec: mintIcpPerSec == null ? null : mintIcpPerSec / icpPerTc,
    stakedRatio: g?.totalStakedE8s && supplyIcp ? g.totalStakedE8s / E8S / supplyIcp : null,
    totalMaturityIcp: g?.totalMaturityE8s ? g.totalMaturityE8s / E8S : null,
    maturityModulationPct: raw.maturityModulationBp == null ? null : raw.maturityModulationBp / 100,
    daily: dailyFlows(raw.supplySeries, raw.burnedSeries),
  }
}

/** Simple (non-compounded) inflation for a timeframe from an annual rate. */
export const rateForTimeframe = (annual: number, seconds: number) => (annual * seconds) / (DAY * DAYS_PER_YEAR)

/** Where the headline ICP burn figure comes from. */
export type BurnSource = 'cycles' | 'ledger1d' | 'ledger'

export const BURN_SOURCES: [BurnSource, string][] = [
  ['cycles', 'Live · from cycles'],
  ['ledger1d', 'Ledger · last day'],
  ['ledger', 'Ledger · 7d avg'],
]

/** ICP burned per second for the chosen source; falls back to the cycle-implied rate. */
export function icpBurnPerSecFor(r: Rates, source: BurnSource): number {
  const ledger = source === 'ledger' ? r.ledgerBurnIcpPerSec : source === 'ledger1d' ? r.ledgerBurnIcpPerSecLastDay : null
  return ledger ?? r.cycleImpliedIcpPerSec
}
