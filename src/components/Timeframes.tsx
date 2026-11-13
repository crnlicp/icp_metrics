import { motion } from 'motion/react'
import { useState } from 'react'
import { fmtNumber, fmtPct, fmtUsd } from '../lib/format'
import { TIMEFRAMES, type BurnSource, type Derived, type TimeframeKey } from '../lib/metrics'
import { AnimatedNumber } from './Numbers'
import { reveal } from '../lib/motion'
import { Section } from './Section'

const fmtAmt = (n: number | null) => fmtNumber(n, 4)
const fmtSigned = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${fmtNumber(n, 4)}`)
const fmtP = (n: number | null) => fmtPct(n, 3, true)

export function Timeframes({ d, icpBurnPerSec, source }: { d: Derived; icpBurnPerSec: number; source: BurnSource }) {
  const [tf, setTf] = useState<TimeframeKey>('day')
  const frame = TIMEFRAMES.find((t) => t.key === tf)!
  const k = frame.seconds
  const r = d.rates
  const mint = r.mintIcpPerSec
  const net = mint == null ? null : mint - icpBurnPerSec
  const usd = d.icpUsd

  const tiles: {
    label: string
    value: number | null
    unit: string
    tone: 'burn' | 'mint' | 'neutral'
    fmt: (n: number | null) => string
    foot?: string
  }[] = [
    { label: 'Cycles burned', value: r.tcPerSec * k, unit: 'TC', tone: 'burn', fmt: fmtAmt, foot: `${fmtNumber(r.cyclesPerSec * k, 3)} cycles` },
    {
      label: 'ICP burned',
      value: icpBurnPerSec * k,
      unit: 'ICP',
      tone: 'burn',
      fmt: fmtAmt,
      foot: usd ? `≈ ${fmtUsd(icpBurnPerSec * k * usd)}` : undefined,
    },
    {
      label: 'ICP minted',
      value: mint == null ? null : mint * k,
      unit: 'ICP',
      tone: 'mint',
      fmt: fmtAmt,
      foot: usd && mint ? `≈ ${fmtUsd(mint * k * usd)}` : undefined,
    },
    { label: 'Net supply change', value: net == null ? null : net * k, unit: 'ICP', tone: 'neutral', fmt: fmtSigned },
    {
      label: 'Net inflation',
      value: net == null || !d.supplyIcp ? null : (net * k) / d.supplyIcp,
      unit: '',
      tone: 'neutral',
      fmt: fmtP,
      foot: `of ${fmtNumber(d.supplyIcp, 3)} ICP supply`,
    },
    // the counterpart to the headline burn: actual ledger burn when the live
    // cycle figure is selected, the cycle-implied figure otherwise
    source === 'cycles'
      ? {
          label: 'Ledger ICP burned',
          value: r.ledgerBurnIcpPerSec == null ? null : r.ledgerBurnIcpPerSec * k,
          unit: 'ICP',
          tone: 'burn',
          fmt: fmtAmt,
          foot: 'actually destroyed on the ledger · 7-day avg',
        }
      : {
          label: 'Cycle burn in ICP',
          value: r.cycleImpliedIcpPerSec * k,
          unit: 'ICP',
          tone: 'burn',
          fmt: fmtAmt,
          foot: 'live cycle burn priced at today’s XDR rate',
        },
  ]

  return (
    <Section
      id="timeframes"
      eyebrow="Every timeframe"
      title="Rates at a glance"
      aside={
        <div className="seg" role="tablist" aria-label="Timeframe">
          {TIMEFRAMES.map((t) => (
            <button key={t.key} role="tab" aria-selected={tf === t.key} onClick={() => setTf(t.key)}>
              {tf === t.key && <motion.span layoutId="tf-pill" className="seg-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span>{t.label.replace('Per ', '')}</span>
            </button>
          ))}
        </div>
      }
    >
      <div className="tile-grid">
        {tiles.map((t) => (
          <motion.div key={t.label} className={`tile tile-${t.tone}`} variants={reveal} whileHover={{ y: -4 }}>
            <span className="tile-label">
              {t.label} <span className="muted">/ {frame.short}</span>
            </span>
            <span className="tile-value">
              <AnimatedNumber value={t.value} format={t.fmt} />
              {t.unit && <small>{t.unit}</small>}
            </span>
            <span className="tile-foot">{t.foot ?? ' '}</span>
          </motion.div>
        ))}
      </div>
    </Section>
  )
}
