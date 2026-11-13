import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { fmtCompact, fmtDuration, fmtNumber, fmtPct, fmtPlain, fmtUsd } from '../lib/format'
import { BURN_SOURCES, DAY, icpBurnPerSecFor, type BurnSource, type Derived } from '../lib/metrics'
import {
  EMBER_PRESETS,
  FLARE_PRESETS,
  SPARK_PRESETS,
  DEFAULT_PARTICLE_UNIT,
  loadSimUnits,
  MAX_EMBERS_PER_SEC,
  MAX_FLARES_PER_SEC,
  MAX_SPARKS_PER_SEC,
  saveSimUnits,
  subscribeTicker,
  type SimUnits,
} from '../lib/ticker'
import { Flame, Gear, Sparkle } from './Icons'
import { SimSettings } from './SimSettings'
import { AnimatedNumber } from './Numbers'
import { ParticleField } from './ParticleField'

/** Chooses where the ICP burn figure comes from. Lives above the cards. */
export function BurnSourceToggle({ source, onSource }: { source: BurnSource; onSource: (s: BurnSource) => void }) {
  return (
    <div className="seg seg-sm" role="tablist" aria-label="ICP burn source">
      {BURN_SOURCES.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={source === k} onClick={() => onSource(k)}>
          {source === k && <motion.span layoutId="burn-src" className="seg-pill seg-pill-burn" />}
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}

const fmt4 = (n: number | null) => fmtNumber(n, 4)
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

export function Hero({ d, sinceMs, source }: { d: Derived; sinceMs: number; source: BurnSource }) {
  const r = d.rates
  const icpBurnPerSec = icpBurnPerSecFor(r, source)
  const mintPerSec = r.mintIcpPerSec ?? r.rewardsEstimateIcpPerSec ?? 0
  const usd = d.icpUsd

  // particle units: every ember / flare / spark stands for a fixed amount,
  // so the particles on screen are exactly the amount burned or minted
  const [units, setUnits] = useState<SimUnits>(loadSimUnits)
  const [settingsOpen, setSettingsOpen] = useState<'burn' | 'mint' | null>(null)
  const updateUnits = (patch: Partial<SimUnits>) =>
    setUnits((u) => {
      const next = { ...u, ...patch }
      saveSimUnits(next)
      return next
    })
  // unset (null) means the default size
  const autoEmberTc = DEFAULT_PARTICLE_UNIT
  const emberTc = units.emberTc ?? autoEmberTc
  const autoFlareIcp = DEFAULT_PARTICLE_UNIT
  const flareUnit = units.flareIcp ?? autoFlareIcp
  const autoSparkIcp = DEFAULT_PARTICLE_UNIT
  const sparkUnit = units.sparkIcp ?? autoSparkIcp

  const [burnHits, setBurnHits] = useState(0)
  const [mintHits, setMintHits] = useState(0)
  const burnStep = milestoneStep(r.tcPerSec)
  const mintStep = milestoneStep(mintPerSec)
  useMilestones(r.tcPerSec, sinceMs, burnStep, setBurnHits)
  useMilestones(mintPerSec, sinceMs, mintStep, setMintHits)

  return (
    <section className="hero">
      <motion.article
        className="panel panel-burn"
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <ParticleField
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
            <button className="icon-btn" onClick={() => setSettingsOpen('burn')} aria-label="Burn simulation settings" title="Simulation settings">
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
              <span className="kpi-card-foot">{usd ? `≈ ${fmtUsd(icpBurnPerSec * usd)} / s` : ' '}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-card-label">ICP burned / day</span>
              <div className="kpi-l">
                <AnimatedNumber value={icpBurnPerSec * DAY} format={fmtDay} />
                <span className="unit">ICP</span>
              </div>
              <span className="kpi-card-foot">{usd ? `≈ ${fmtUsd(icpBurnPerSec * DAY * usd)} / day` : ' '}</span>
            </div>
          </div>

          <div className="panel-foot">
            <dl className="burn-times">
              <div>
                <dt>1 TC burns in</dt>
                <dd>{fmtDuration(1 / r.tcPerSec)}</dd>
              </div>
              <div>
                <dt>1 ICP burns in</dt>
                <dd>{fmtDuration(1 / icpBurnPerSec)}</dd>
              </div>
            </dl>
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
          open={settingsOpen === 'burn'}
          onClose={() => setSettingsOpen(null)}
          tone="burn"
          eyebrow="Burn simulation"
          intro="Choose how much each particle represents. Particles spawn at the real burn rate, so a smaller amount means more particles."
          fields={[
            {
              key: 'ember',
              label: 'Cycle embers',
              unit: 'TC',
              noun: 'embers',
              presets: EMBER_PRESETS,
              current: units.emberTc,
              auto: autoEmberTc,
              ratePerSec: r.tcPerSec,
              cap: MAX_EMBERS_PER_SEC,
              detail: (n) => `${fmtCompact(n * 1e12, 2)} cycles`,
            },
            {
              key: 'flare',
              label: 'ICP flares',
              unit: 'ICP',
              noun: 'flares',
              presets: FLARE_PRESETS,
              current: units.flareIcp,
              auto: autoFlareIcp,
              ratePerSec: icpBurnPerSec,
              cap: MAX_FLARES_PER_SEC,
            },
          ]}
          onApply={([emberTc, flareIcp]) => updateUnits({ emberTc, flareIcp })}
        />
      </motion.article>

      <motion.article
        className="panel panel-mint"
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
      >
        <ParticleField variant="mint" particlesPerSec={mintPerSec / sparkUnit} className="field" />
        <div className="aura" aria-hidden />
        <div className="panel-body">
          <div className="panel-top">
            <span className="tag tag-mint">
              <Sparkle width={15} height={15} /> Mint
            </span>
            <Milestone n={mintHits} tone="mint" label={`✦ ${fmtNumber(mintHits * mintStep, 3)} ICP minted since you arrived`} />
            <button className="icon-btn" onClick={() => setSettingsOpen('mint')} aria-label="Mint simulation settings" title="Simulation settings">
              <Gear width={17} height={17} />
            </button>
          </div>

          <p className="kpi-label">ICP minted / second</p>
          <div className="kpi-xl kpi-xl-mint">
            <AnimatedNumber value={mintPerSec} format={fmt4} />
            <span className="unit">ICP/s</span>
          </div>
          <p className="kpi-sub">
            Ledger gross issuance, 30-day average{usd ? ` · ≈ ${fmtUsd(mintPerSec * usd)}/s` : ''}
          </p>

          <div className="kpi-pair">
            <div className="kpi-card">
              <span className="kpi-card-label">ICP minted / day</span>
              <div className="kpi-l">
                <AnimatedNumber value={mintPerSec * DAY} format={fmtDay} />
                <span className="unit">ICP</span>
              </div>
              <span className="kpi-card-foot">
                {usd ? `≈ ${fmtUsd(mintPerSec * DAY * usd)} / day` : `rewards est. ${fmtNumber((r.rewardsEstimateIcpPerSec ?? 0) * DAY, 3)}/day`}
              </span>
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
            <dl className="burn-times mint-times">
              <div>
                <dt>1 ICP mints in</dt>
                <dd>{fmtDuration(1 / mintPerSec)}</dd>
              </div>
            </dl>
            <span className="legend-note">
              <i className="dot dot-mint" /> 1 spark = {fmtPlain(sparkUnit)} ICP
            </span>
          </div>
        </div>
        <SimSettings
          open={settingsOpen === 'mint'}
          onClose={() => setSettingsOpen(null)}
          tone="mint"
          eyebrow="Mint simulation"
          intro="Choose how much new ICP each spark represents. Sparks appear at the real mint rate, so a smaller amount means more sparks."
          fields={[
            {
              key: 'spark',
              label: 'ICP sparks',
              unit: 'ICP',
              noun: 'sparks',
              presets: SPARK_PRESETS,
              current: units.sparkIcp,
              auto: autoSparkIcp,
              ratePerSec: mintPerSec,
              cap: MAX_SPARKS_PER_SEC,
            },
          ]}
          onApply={([sparkIcp]) => updateUnits({ sparkIcp })}
        />
      </motion.article>
    </section>
  )
}
