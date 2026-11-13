import { motion } from 'motion/react'
import { fmtCompact, fmtNumber, fmtPct } from '../lib/format'
import { DAY, DAYS_PER_MONTH, rateForTimeframe, type Derived } from '../lib/metrics'
import { reveal } from '../lib/motion'
import { Section } from './Section'

function RateCard({
  title,
  annual,
  note,
  accent,
  hero,
}: {
  title: string
  annual: number | null
  note: string
  accent: string
  hero?: boolean
}) {
  const rows: [string, number | null][] = [
    ['Per day', annual == null ? null : rateForTimeframe(annual, DAY)],
    ['Per month', annual == null ? null : rateForTimeframe(annual, DAY * DAYS_PER_MONTH)],
    ['Per hour', annual == null ? null : rateForTimeframe(annual, 3600)],
  ]
  return (
    <motion.div className={`card rate-card ${hero ? 'rate-card-hero' : ''}`} variants={reveal} style={{ ['--accent' as string]: accent }}>
      <p className="card-label">{title}</p>
      <p className="rate-annual">
        {fmtPct(annual, 2)}
        <small>/ year</small>
      </p>
      <dl className="rate-rows">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className="mono">{fmtPct(v, 4)}</dd>
          </div>
        ))}
      </dl>
      <p className="card-note">{note}</p>
    </motion.div>
  )
}

export function Inflation({ d }: { d: Derived }) {
  const r = d.rates
  const vote = r.votingRewardsIcpPerSec ?? 0
  const np = r.nodeProviderIcpPerSec ?? 0
  const total = vote + np

  return (
    <Section id="inflation" eyebrow="Monetary policy" title="Inflation">
      <div className="rate-grid">
        <RateCard
          hero
          title="Net inflation"
          annual={d.inflation.netAnnual}
          accent="var(--mint)"
          note="(Minted − burned) ÷ supply · 30-day ledger trend"
        />
        <RateCard
          title="Gross issuance"
          annual={d.inflation.grossAnnual}
          accent="var(--violet)"
          note="New ICP minted ÷ supply, before burns"
        />
        <RateCard
          title="Realized (past 365 days)"
          annual={d.inflation.realized365}
          accent="var(--gold)"
          note="Actual total-supply change over the last year"
        />
      </div>

      {total > 0 && (
        <motion.div className="card sources" variants={reveal}>
          <div className="sources-head">
            <div>
              <p className="card-label">Where new ICP comes from · rewards estimate</p>
              <p className="sources-total">
                {fmtNumber(total * DAY)} <small>ICP / day committed</small>
                <span className="muted"> · {fmtPct(d.inflation.rewardsAnnual)} / yr</span>
              </p>
            </div>
          </div>
          <div className="stack" role="img" aria-label="Mint sources">
            <motion.div
              className="stack-seg seg-vote"
              initial={{ flexGrow: 0.0001 }}
              whileInView={{ flexGrow: vote }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.div
              className="stack-seg seg-np"
              initial={{ flexGrow: 0.0001 }}
              whileInView={{ flexGrow: np }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            />
          </div>
          <div className="sources-legend">
            <span>
              <i className="dot dot-vote" /> NNS voting rewards <b>{fmtNumber(vote * DAY)}</b> ICP/day ·{' '}
              {fmtPct(vote / total, 0)}
            </span>
            <span>
              <i className="dot dot-np" /> Node provider rewards <b>{fmtNumber(np * DAY)}</b> ICP/day · {fmtPct(np / total, 0)}
            </span>
          </div>
          <div className="mini-stats">
            {d.stakedRatio != null && (
              <div>
                <span>Supply staked</span>
                <b>{fmtPct(d.stakedRatio, 1)}</b>
              </div>
            )}
            {d.totalMaturityIcp != null && (
              <div>
                <span>Unminted maturity</span>
                <b>{fmtCompact(d.totalMaturityIcp)} ICP</b>
              </div>
            )}
            {d.maturityModulationPct != null && (
              <div>
                <span>Maturity modulation</span>
                <b>{d.maturityModulationPct > 0 ? '+' : ''}{d.maturityModulationPct.toFixed(2)}%</b>
              </div>
            )}
            <div>
              <span>1 ICP buys</span>
              <b>{fmtNumber(1 / d.icpPerTc, 3)} TC</b>
            </div>
          </div>
          <p className="card-note">
            Voting rewards accrue as neuron maturity and only become ICP on the ledger when disbursed, so the rewards estimate runs
            ahead of the ledger mint rate.
          </p>
        </motion.div>
      )}
    </Section>
  )
}
