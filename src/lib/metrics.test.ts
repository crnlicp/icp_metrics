import { describe, expect, it } from 'vitest'
import type { Point } from './api'
import { DAY, E8S, dailyFlows, derive, rateForTimeframe, trailingRatePerDay, valueAt, type RawData } from './metrics'
import { fmtCompact, fmtNumber, fmtPct, tickerDecimals } from './format'

const T0 = 1_700_006_400 // a UTC midnight
const linear = (days: number, start: number, perDay: number): Point[] =>
  Array.from({ length: days + 1 }, (_, i) => [T0 + i * DAY, start + i * perDay] as Point)

function raw(overrides: Partial<RawData> = {}): RawData {
  return {
    cycleBurnNow: [T0, 50e9], // 0.05 TC/s
    cycleBurnSeries: [
      [T0, 40e9],
      [T0 + 3600, 60e9],
    ],
    xdrPermyriad: 20_000, // 2 XDR per ICP → 0.5 ICP per TC
    icpUsd: 3,
    icpUsdChange24h: 1,
    // supply grows 10,000 ICP/day net; burned grows 2,000 ICP/day
    supplySeries: linear(400, 500_000_000 * E8S, 10_000 * E8S),
    burnedSeries: linear(400, 1_000_000 * E8S, 2_000 * E8S),
    supplyLatest: null,
    burnedLatest: null,
    rewardEvents: [
      [T0, 30_000 * E8S],
      [T0 + DAY, 0],
      [T0 + 2 * DAY, 60_000 * E8S],
    ],
    npRewards: [[T0, 304_375 * E8S]], // 10,000 ICP/day over an average month
    governance: { totalStakedE8s: 250_000_000 * E8S, totalMaturityE8s: 1e6 * E8S, totalStakedMaturityE8s: 0, neuronsTotal: 10 },
    maturityModulationBp: -256,
    ...overrides,
  }
}

describe('series helpers', () => {
  it('valueAt returns the last point not after ts', () => {
    const s: Point[] = [
      [10, 1],
      [20, 2],
      [30, 3],
    ]
    expect(valueAt(s, 25)).toEqual([20, 2])
    expect(valueAt(s, 5)).toBeNull()
    expect(valueAt(s, 30)).toEqual([30, 3])
  })

  it('trailingRatePerDay uses real timestamps', () => {
    expect(trailingRatePerDay(linear(10, 0, 5), 7)).toBeCloseTo(5)
    // window longer than series falls back to first point
    expect(trailingRatePerDay(linear(3, 0, 5), 30)).toBeCloseTo(5)
    expect(trailingRatePerDay([[0, 1]], 7)).toBeNull()
  })

  it('dailyFlows derives mint = Δsupply + Δburned', () => {
    const flows = dailyFlows(linear(3, 0, 10 * E8S), linear(3, 0, 2 * E8S))
    expect(flows).toHaveLength(3)
    expect(flows[0]).toMatchObject({ burnedIcp: 2, mintedIcp: 12, netIcp: 10 })
  })

  it('dailyFlows skips gaps instead of attributing multi-day deltas to one day', () => {
    const s: Point[] = [
      [T0, 0],
      [T0 + DAY, 10],
      [T0 + 3 * DAY, 30],
    ]
    expect(dailyFlows(s, s)).toHaveLength(1)
  })
})

describe('derive', () => {
  const d = derive(raw())

  it('converts cycles to TC and ICP', () => {
    expect(d.rates.tcPerSec).toBeCloseTo(0.05)
    expect(d.icpPerTc).toBeCloseTo(0.5)
    expect(d.rates.cycleImpliedIcpPerSec).toBeCloseTo(0.025)
    expect(d.rates.cyclesPerSec7dAvg).toBeCloseTo(50e9)
  })

  it('computes ledger burn and gross mint', () => {
    expect(d.rates.ledgerBurnIcpPerSec! * DAY).toBeCloseTo(2_000)
    expect(d.rates.mintIcpPerSec! * DAY).toBeCloseTo(12_000)
    expect(d.rates.netIcpPerSec! * DAY).toBeCloseTo(10_000)
    expect(d.burnToMint).toBeCloseTo(2_000 / 12_000)
  })

  it('estimates reward-driven minting', () => {
    expect(d.rates.votingRewardsIcpPerSec! * DAY).toBeCloseTo(30_000)
    expect(d.rates.nodeProviderIcpPerSec! * DAY).toBeCloseTo(10_000)
    expect(d.rates.rewardsEstimateIcpPerSec! * DAY).toBeCloseTo(40_000)
  })

  it('computes inflation rates against the latest supply', () => {
    const supply = 500_000_000 + 400 * 10_000
    expect(d.supplyIcp).toBeCloseTo(supply)
    expect(d.inflation.netAnnual).toBeCloseTo((10_000 * 365.25) / supply)
    expect(d.inflation.grossAnnual).toBeCloseTo((12_000 * 365.25) / supply)
    expect(d.inflation.realized365).toBeGreaterThan(0.007)
    expect(d.inflation.realized365).toBeLessThan(0.0075)
  })

  it('computes break-even cycle burn', () => {
    // 12,000 ICP/day minted × 2 TC/ICP = 24,000 TC/day
    expect(d.breakEvenTcPerSec! * DAY).toBeCloseTo(24_000)
    expect(d.maturityModulationPct).toBeCloseTo(-2.56)
    expect(d.stakedRatio).toBeCloseTo(250e6 / 504e6)
  })

  it('tolerates missing optional data', () => {
    const e = derive(raw({ rewardEvents: [], npRewards: [], governance: null, supplySeries: [], burnedSeries: [] }))
    expect(e.rates.mintIcpPerSec).toBeNull()
    expect(e.rates.rewardsEstimateIcpPerSec).toBeNull()
    expect(e.inflation.netAnnual).toBeNull()
    expect(e.daily).toEqual([])
  })

  it('scales annual rate to a timeframe', () => {
    expect(rateForTimeframe(0.0365, DAY * 365.25)).toBeCloseTo(0.0365)
    expect(rateForTimeframe(0.0365, DAY)).toBeCloseTo(0.0365 / 365.25)
  })
})

describe('format', () => {
  it('formats numbers sensibly', () => {
    expect(fmtNumber(0.0530004)).toBe('0.05300')
    expect(fmtNumber(2384.4)).toBe('2,384')
    expect(fmtNumber(null)).toBe('—')
    expect(fmtCompact(53_000_364_828)).toBe('53.00B')
    expect(fmtPct(0.0365)).toBe('3.65%')
    expect(fmtPct(0.01, 2, true)).toBe('+1.00%')
  })

  it('picks ticker decimals so digits move', () => {
    expect(tickerDecimals(0.025)).toBe(3)
    expect(tickerDecimals(2000)).toBe(0)
  })
})
