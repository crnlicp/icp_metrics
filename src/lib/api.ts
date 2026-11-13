// Thin client for the public IC dashboard APIs (CORS-enabled, no auth).
// IC API:     https://ic-api.internetcomputer.org/api/v3/swagger
// Ledger API: https://ledger-api.internetcomputer.org/swagger-ui/

export const IC_API = 'https://ic-api.internetcomputer.org/api/v3'
export const LEDGER_API = 'https://ledger-api.internetcomputer.org'

/** [unix seconds, value] */
export type Point = [number, number]

const DAY = 86_400

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return (await res.json()) as T
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number.parseFloat(String(v)))
const toPoints = (rows: [unknown, unknown][]): Point[] =>
  rows.map(([t, v]) => [num(t), num(v)] as Point).filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v))

const qs = (p: Record<string, number | string>) =>
  Object.entries(p)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')

const now = () => Math.floor(Date.now() / 1000)

/* ---------------- fast-changing data ---------------- */

/** Current network-wide cycle burn rate, cycles per second. */
export async function fetchCycleBurnNow(signal?: AbortSignal): Promise<Point> {
  const d = await getJson<{ cycle_burn_rate: [unknown, unknown][] }>(`${IC_API}/metrics/cycle-burn-rate`, signal)
  return toPoints(d.cycle_burn_rate).at(-1)!
}

/** Hourly cycle burn rate for the last `days` days (cycles/s). */
export async function fetchCycleBurnSeries(days = 7, signal?: AbortSignal): Promise<Point[]> {
  const end = now()
  const d = await getJson<{ cycle_burn_rate: [unknown, unknown][] }>(
    `${IC_API}/metrics/cycle-burn-rate?${qs({ start: end - days * DAY, end, step: 3600 })}`,
    signal,
  )
  return toPoints(d.cycle_burn_rate)
}

/** XDR per ICP, expressed in permyriad (1e-4 XDR). 1 XDR buys 1 trillion cycles. */
export async function fetchXdrPermyriad(signal?: AbortSignal): Promise<number> {
  const d = await getJson<{ icp_xdr_conversion_rates: [unknown, unknown][] }>(`${IC_API}/icp-xdr-conversion-rates`, signal)
  return toPoints(d.icp_xdr_conversion_rates).at(-1)![1]
}

export async function fetchIcpUsd(signal?: AbortSignal): Promise<number> {
  const d = await getJson<{ icp_usd_rate: [unknown, unknown][] }>(`${IC_API}/icp-usd-rate`, signal)
  return toPoints(d.icp_usd_rate).at(-1)![1]
}

export async function fetchIcpUsdChange24h(signal?: AbortSignal): Promise<number | null> {
  const d = await getJson<Record<string, unknown>>(`${IC_API}/icp-usd-percent-change-24h`, signal)
  const v = Object.values(d)[0]
  if (Array.isArray(v)) {
    const last = Array.isArray(v[0]) ? (v.at(-1) as unknown[]) : v
    return num(last[1])
  }
  return null
}

/* ---------------- ledger (actual mint / burn) ---------------- */

/** Total ICP supply (e8s), daily, for the last `days` days. */
export async function fetchSupplySeries(days = 400, signal?: AbortSignal): Promise<Point[]> {
  const end = now()
  const rows = await getJson<[unknown, unknown][]>(
    `${LEDGER_API}/supply/total/series?${qs({ start: end - days * DAY, end, step: DAY })}`,
    signal,
  )
  return toPoints(rows)
}

/** Cumulative ICP burned (e8s), daily — includes ICP→cycles conversions. */
export async function fetchBurnedSeries(days = 400, signal?: AbortSignal): Promise<Point[]> {
  const end = now()
  const rows = await getJson<[unknown, unknown][]>(
    `${LEDGER_API}/icp-burned/series?${qs({ start: end - days * DAY, end, step: DAY })}`,
    signal,
  )
  return toPoints(rows)
}

export async function fetchSupplyLatest(signal?: AbortSignal): Promise<Point> {
  const row = await getJson<[unknown, unknown]>(`${LEDGER_API}/supply/total/latest`, signal)
  return [num(row[0]), num(row[1])]
}

export async function fetchBurnedLatest(signal?: AbortSignal): Promise<Point> {
  const row = await getJson<[unknown, unknown]>(`${LEDGER_API}/icp-burned/latest`, signal)
  return [num(row[0]), num(row[1])]
}

/* ---------------- rewards (minting drivers) ---------------- */

/** Daily NNS voting-reward events (e8s of maturity distributed per event). */
export async function fetchRewardEvents(days = 30, signal?: AbortSignal): Promise<Point[]> {
  const end = now()
  const d = await getJson<{ last_reward_event: [unknown, unknown][] }>(
    `${IC_API}/metrics/last-reward-event?${qs({ start: end - days * DAY, end, step: DAY })}`,
    signal,
  )
  return toPoints(d.last_reward_event)
}

/** Monthly node-provider reward totals (e8s). API returns [value, timestamp] — normalised here. */
export async function fetchNodeProviderRewards(days = 120, signal?: AbortSignal): Promise<Point[]> {
  const end = now()
  const d = await getJson<{ reward_node_providers: [unknown, unknown][] }>(
    `${IC_API}/timeseries/reward-node-providers?${qs({ start: end - days * DAY, end, step: 259_200 })}`,
    signal,
  )
  return d.reward_node_providers
    .map(([v, t]) => [num(t), num(v)] as Point)
    .filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v))
    .sort((a, b) => a[0] - b[0])
}

export interface GovernanceSnapshot {
  totalStakedE8s: number | null
  totalMaturityE8s: number | null
  totalStakedMaturityE8s: number | null
  neuronsTotal: number | null
}

export async function fetchGovernance(signal?: AbortSignal): Promise<GovernanceSnapshot> {
  const d = await getJson<{ metrics: { name: string; subsets: { metric: object; value: [unknown, unknown] }[] }[] }>(
    `${IC_API}/governance-metrics`,
    signal,
  )
  const pick = (name: string) => {
    const m = d.metrics.find((x) => x.name === name)
    return m?.subsets[0] ? num(m.subsets[0].value[1]) : null
  }
  return {
    totalStakedE8s: pick('governance_total_staked_e8s'),
    totalMaturityE8s: pick('governance_total_maturity_e8s_equivalent'),
    totalStakedMaturityE8s: pick('governance_total_staked_maturity_e8s_equivalent'),
    neuronsTotal: pick('governance_neurons_total'),
  }
}

/** Latest maturity modulation in basis points (e.g. -256 = -2.56%). */
export async function fetchMaturityModulation(signal?: AbortSignal): Promise<number | null> {
  const d = await getJson<{ neuron_maturity_modulations: [unknown, unknown][] }>(`${IC_API}/neuron-maturity-modulations`, signal)
  return toPoints(d.neuron_maturity_modulations).at(-1)?.[1] ?? null
}
