import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { fmtCompact, fmtNumber, fmtPct, fmtPlain, fmtUsd } from '../lib/format'
import { DAY, type Derived } from '../lib/metrics'
import { loadSimUnits, niceUnit, saveSimUnits, subscribeTicker, type SimUnits } from '../lib/ticker'
import { Flame, Gear, Sparkle } from './Icons'
import { SimSettings } from './SimSettings'
import { AnimatedNumber } from './Numbers'
import { ParticleField, type ParticleFieldHandle } from './ParticleField'

export type BurnSource = 'ledger' | 'cycles'

const fmt4 = (n: number | null) => fmtNumber(n, 4)
const fmt3 = (n: number | null) => fmtNumber(n, 3)
const fmtDay = (n: number | null) => (n == null ? '—' : n >= 100 ? Math.round(n).toLocaleString('en-US') : fmtNumber(n, 3))

/** Fires a callback every time the session total crosses another `step`. */
function useMilestones(ratePerSec: number, sinceMs: number, step: number, onHit: (n: number) => void) {
  const cb = useRef(onHit)
  useEffect(() => {
    cb.current = onHit
  })
  useEffect(() => {
    if (!(ratePerSec > 0)) return
    let lastN = Math.floor(((Date.now() - sinceMs) / 1000) * ratePerSec / step)
    return subscribeTicker((now) => {
      const n = Math.floor((((now - sinceMs) / 1000) * ratePerSec) / step)
      if (n > lastN) {
        lastN = n
        cb.current(n)
      }
    })
  }, [ratePerSec, sinceMs, step])
}

const milestoneStep = (rate: number) => 10 ** Math.round(Math.log10(Math.max(rate, 1e-9) * 10))

function Milestone({ n, label, tone }: { n: number; label: string; tone: 'burn' | 'mint' }) {
  return (
    <div className="milestones" aria-live="polite">
      <AnimatePresence>
        {n > 0 && (
          <motion.span
            key={n}
            className={`milestone ${tone}`}
            initial={{ opacity: 0, y: 14, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -22, scale: 0.96 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Hero({
  d,
  sinceMs,
  source,
  onSource,
}: {
  d: Derived
  sinceMs: number
  source: BurnSource
  onSource: (s: BurnSource) => void
}) {
  const r = d.rates
  const icpBurnPerSec = source === 'ledger' ? (r.ledgerBurnIcpPerSec ?? r.cycleImpliedIcpPerSec) : r.cycleImpliedIcpPerSec
  const mintPerSec = r.mintIcpPerSec ?? r.rewardsEstimateIcpPerSec ?? 0
  const usd = d.icpUsd

  // particle units: every ember / spark stands for a fixed amount
  const [units, setUnits] = useState<SimUnits>(loadSimUnits)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const autoEmberTc = niceUnit(r.tcPerSec, 45)
  const emberTc = units.emberTc ?? autoEmberTc
  const sparkUnit = niceUnit(mintPerSec, 30)
  // ICP burn flares are rarer and bigger: aim for a couple per second
  const autoFlareIcp = niceUnit(icpBurnPerSec, 2.5)
  const flareUnit = units.flareIcp ?? autoFlareIcp

  const burnField = useRef<ParticleFieldHandle>(null)
  const mintField = useRef<ParticleFieldHandle>(null)
  const [burnHits, setBurnHits] = useState(0)
  const [mintHits, setMintHits] = useState(0)
  const burnStep = milestoneStep(r.tcPerSec)
  const mintStep = milestoneStep(mintPerSec)

  useMilestones(r.tcPerSec, sinceMs, burnStep, (n) => {
    setBurnHits(n)
    burnField.current?.burst(45)
  })
  useMilestones(mintPerSec, sinceMs, mintStep, (n) => {
    setMintHits(n)
    mintField.current?.burst(28)
  })

  return (
    <section className="hero">
      <motion.article
        className="panel panel-burn"
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <ParticleField
          ref={burnField}
          variant="burn"
          particlesPerSec={r.tcPerSec / emberTc}
          flaresPerSec={icpBurnPerSec / flareUnit}
          className="field"
        />
        <div className="heat" aria-hidden />
        <div className="panel-body">
          <div className="panel-top">
            <span className="tag tag-burn">
              <Flame width={15} height={15} /> Burn
            </span>
            <Milestone n={burnHits} tone="burn" label={`🔥 ${fmtNumber(burnHits * burnStep, 3)} TC burned since you arrived`} />
            <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Simulation settings" title="Simulation settings">
              <Gear width={17} height={17} />
            </button>
          </div>

          <p className="kpi-label">Cycle burn rate</p>
          <div className="kpi-xl">
            <AnimatedNumber value={r.tcPerSec} format={fmt4} />
            <span className="unit">TC/s</span>
          </div>
          <p className="kpi-sub">
            {fmtCompact(r.cyclesPerSec)} cycles every second
            {r.cyclesPerSec7dAvg != null && (
              <>
                {' '}
                · 7-day avg <b>{fmtNumber(r.cyclesPerSec7dAvg / 1e12, 3)} TC/s</b>
              </>
            )}
          </p>

          <div className="kpi-pair">
            <div className="kpi-card">
              <span className="kpi-card-label">ICP burned / second</span>
              <div className="kpi-l">
                <AnimatedNumber value={icpBurnPerSec} format={fmt4} />
                <span className="unit">ICP</span>
              </div>
              <span className="kpi-card-foot">{usd ? `≈ ${fmtUsd(icpBurnPerSec * usd)} / s` : ' '}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card-label">ICP burned / day</span>
              <div className="kpi-l">
                <AnimatedNumber value={icpBurnPerSec * DAY} format={fmtDay} />
                <span className="unit">ICP</span>
              </div>
              <span className="kpi-card-foot">{usd ? `≈ ${fmtUsd(icpBurnPerSec * DAY * usd)} / day` : ' '}</span>
            </div>
          </div>

          <div className="panel-foot">
            <div className="seg seg-sm" role="tablist" aria-label="ICP burn source">
              {(
                [
                  ['cycles', 'Live · from cycles'],
                  ['ledger', 'Ledger · 7d'],
                ] as const
              ).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={source === k} onClick={() => onSource(k)}>
                  {source === k && <motion.span layoutId="burn-src" className="seg-pill seg-pill-burn" />}
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <div className="legend-stack">
              <span className="legend-note">
                <i className="dot dot-burn" /> 1 ember = {fmtPlain(emberTc)} TC
              </span>
              <span className="legend-note">
                <i className="dot dot-flare" /> 1 flare = {fmtPlain(flareUnit)} ICP
              </span>
            </div>
          </div>
        </div>
        <SimSettings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          units={units}
          onApply={(u) => {
            setUnits(u)
            saveSimUnits(u)
          }}
          auto={{ emberTc: autoEmberTc, flareIcp: autoFlareIcp }}
          tcPerSec={r.tcPerSec}
          icpBurnPerSec={icpBurnPerSec}
        />
      </motion.article>

      <motion.article
        className="panel panel-mint"
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
      >
        <ParticleField ref={mintField} variant="mint" particlesPerSec={mintPerSec / sparkUnit} className="field" />
        <div className="aura" aria-hidden />
        <div className="panel-body">
          <div className="panel-top">
            <span className="tag tag-mint">
              <Sparkle width={15} height={15} /> Mint
            </span>
            <Milestone n={mintHits} tone="mint" label={`✦ ${fmtNumber(mintHits * mintStep, 3)} ICP minted since you arrived`} />
          </div>

          <p className="kpi-label">ICP minted / day</p>
          <div className="kpi-xl kpi-xl-mint">
            <AnimatedNumber value={mintPerSec * DAY} format={fmtDay} />
            <span className="unit">ICP</span>
          </div>
          <p className="kpi-sub">
            Ledger gross issuance, 30-day average{usd ? ` · ≈ ${fmtUsd(mintPerSec * DAY * usd)}/day` : ''}
          </p>

          <div className="kpi-pair">
            <div className="kpi-card">
              <span className="kpi-card-label">ICP minted / second</span>
              <div className="kpi-l">
                <AnimatedNumber value={mintPerSec} format={fmt3} />
                <span className="unit">ICP</span>
              </div>
              <span className="kpi-card-foot">rewards est. {fmtNumber(r.rewardsEstimateIcpPerSec, 3)}/s</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card-label">Net inflation / year</span>
              <div className="kpi-l">
                <AnimatedNumber value={d.inflation.netAnnual} format={(n) => fmtPct(n, 2)} />
              </div>
              <span className="kpi-card-foot">gross {fmtPct(d.inflation.grossAnnual)}</span>
            </div>
          </div>

          <div className="panel-foot">
            <span className="legend-note">
              <i className="dot dot-mint" /> 1 spark ≈ {fmtNumber(sparkUnit, 2)} ICP
            </span>
          </div>
        </div>
      </motion.article>
    </section>
  )
}
