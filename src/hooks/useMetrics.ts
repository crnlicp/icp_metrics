import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as api from '../lib/api'
import { derive, type Derived, type RawData } from '../lib/metrics'

// The cycle burn metric updates roughly every 5 s upstream; prices every few
// minutes; the XDR rate daily. Poll each no faster than it actually changes.
const LIVE_MS = 5_000 // cycle burn rate
const FAST_MS = 60_000 // prices + XDR rate
const SLOW_MS = 15 * 60_000 // ledger series, rewards, governance

type Status = 'loading' | 'ready' | 'error'

async function settle<T>(p: Promise<T>, fallback: T, errors: string[], label: string): Promise<T> {
  try {
    return await p
  } catch (e) {
    if ((e as Error).name !== 'AbortError') errors.push(`${label}: ${(e as Error).message}`)
    return fallback
  }
}

export function useMetrics() {
  const [raw, setRaw] = useState<RawData | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [errors, setErrors] = useState<string[]>([])
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const rawRef = useRef<RawData | null>(null)

  const loadFast = useCallback(async (signal?: AbortSignal) => {
    const errs: string[] = []
    const [cycleBurnNow, xdr, usd, chg] = await Promise.all([
      settle(api.fetchCycleBurnNow(signal), null, errs, 'cycle burn'),
      settle(api.fetchXdrPermyriad(signal), null, errs, 'xdr rate'),
      settle(api.fetchIcpUsd(signal), null, errs, 'icp price'),
      settle(api.fetchIcpUsdChange24h(signal), null, errs, 'price change'),
    ])
    return { cycleBurnNow, xdr, usd, chg, errs }
  }, [])

  const loadAll = useCallback(
    async (signal?: AbortSignal) => {
      const errs: string[] = []
      const [fast, series, supply, burned, supplyLatest, burnedLatest, rewards, np, gov, mod] = await Promise.all([
        loadFast(signal),
        settle(api.fetchCycleBurnSeries(7, signal), [], errs, 'cycle series'),
        settle(api.fetchSupplySeries(400, signal), [], errs, 'supply'),
        settle(api.fetchBurnedSeries(400, signal), [], errs, 'burned'),
        settle(api.fetchSupplyLatest(signal), null, errs, 'supply latest'),
        settle(api.fetchBurnedLatest(signal), null, errs, 'burned latest'),
        settle(api.fetchRewardEvents(35, signal), [], errs, 'reward events'),
        settle(api.fetchNodeProviderRewards(120, signal), [], errs, 'node providers'),
        settle(api.fetchGovernance(signal), null, errs, 'governance'),
        settle(api.fetchMaturityModulation(signal), null, errs, 'maturity modulation'),
      ])
      errs.push(...fast.errs)
      if (signal?.aborted) return
      if (!fast.cycleBurnNow || !fast.xdr) {
        setErrors(errs)
        setStatus(rawRef.current ? 'ready' : 'error')
        return
      }
      const next: RawData = {
        cycleBurnNow: fast.cycleBurnNow,
        cycleBurnSeries: series,
        xdrPermyriad: fast.xdr,
        icpUsd: fast.usd,
        icpUsdChange24h: fast.chg,
        supplySeries: supply,
        burnedSeries: burned,
        supplyLatest,
        burnedLatest,
        rewardEvents: rewards,
        npRewards: np,
        governance: gov,
        maturityModulationBp: mod,
      }
      rawRef.current = next
      setRaw(next)
      setErrors(errs)
      setStatus('ready')
      setUpdatedAt(Date.now())
    },
    [loadFast],
  )

  const refreshFast = useCallback(async () => {
    if (!rawRef.current) return
    const f = await loadFast()
    if (!f.cycleBurnNow || !rawRef.current) return
    const prev = rawRef.current
    const series = prev.cycleBurnSeries
    const last = series.at(-1)
    const next: RawData = {
      ...prev,
      cycleBurnNow: f.cycleBurnNow,
      // append the fresh sample so the trend line stays current
      cycleBurnSeries: last && f.cycleBurnNow[0] - last[0] >= 3600 ? [...series.slice(1), f.cycleBurnNow] : series,
      xdrPermyriad: f.xdr ?? prev.xdrPermyriad,
      icpUsd: f.usd ?? prev.icpUsd,
      icpUsdChange24h: f.chg ?? prev.icpUsdChange24h,
    }
    rawRef.current = next
    setRaw(next)
    setUpdatedAt(Date.now())
  }, [loadFast])

  // cycle burn only: one small request every LIVE_MS, skipped while one is in flight
  const liveBusy = useRef(false)
  const refreshLive = useCallback(async () => {
    if (!rawRef.current || liveBusy.current) return
    liveBusy.current = true
    try {
      const now = await api.fetchCycleBurnNow()
      const prev = rawRef.current
      if (!prev || now[0] === prev.cycleBurnNow[0]) return
      const last = prev.cycleBurnSeries.at(-1)
      const next: RawData = {
        ...prev,
        cycleBurnNow: now,
        cycleBurnSeries:
          last && now[0] - last[0] >= 3600 ? [...prev.cycleBurnSeries.slice(1), now] : prev.cycleBurnSeries,
      }
      rawRef.current = next
      setRaw(next)
      setUpdatedAt(Date.now())
    } catch {
      /* transient: next tick retries */
    } finally {
      liveBusy.current = false
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    loadAll(ctrl.signal)
    const live = setInterval(() => document.visibilityState === 'visible' && refreshLive(), LIVE_MS)
    const fast = setInterval(() => document.visibilityState === 'visible' && refreshFast(), FAST_MS)
    const slow = setInterval(() => document.visibilityState === 'visible' && loadAll(), SLOW_MS)
    return () => {
      ctrl.abort()
      clearInterval(live)
      clearInterval(fast)
      clearInterval(slow)
    }
  }, [loadAll, refreshFast, refreshLive])

  const derived: Derived | null = useMemo(() => (raw ? derive(raw) : null), [raw])

  return { raw, derived, status, errors, updatedAt, reload: () => loadAll() }
}
