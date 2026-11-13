import { motion } from 'motion/react'
import { fmtNumber, fmtPct } from '../lib/format'
import { DAY, type Derived } from '../lib/metrics'
import { reveal } from '../lib/motion'
import { Section } from './Section'

export function Balance({ d, icpBurnPerSec }: { d: Derived; icpBurnPerSec: number }) {
  const r = d.rates
  const mint = r.mintIcpPerSec
  if (mint == null || mint <= 0) return null

  const burnShare = icpBurnPerSec / (icpBurnPerSec + mint)
  const offset = icpBurnPerSec / mint
  const breakEven = d.breakEvenTcPerSec ?? 0
  const progress = breakEven > 0 ? Math.min(1, r.tcPerSec / breakEven) : 0
  const multiple = breakEven > 0 ? breakEven / r.tcPerSec : null
  const deflationary = offset >= 1

  return (
    <Section
      id="balance"
      eyebrow="Supply pressure"
      title="Burn vs. mint"
      aside={
        <span className={`badge ${deflationary ? 'badge-good' : 'badge-warn'}`}>
          {deflationary ? '▼ Net deflationary' : '▲ Net inflationary'}
        </span>
      }
    >
      <div className="balance-grid">
        <motion.div className="card" variants={reveal}>
          <p className="card-label">Daily flow</p>
          <div className="tug" role="img" aria-label={`Burn ${fmtNumber(icpBurnPerSec * DAY)} ICP vs mint ${fmtNumber(mint * DAY)} ICP per day`}>
            <motion.div
              className="tug-burn"
              initial={{ width: '50%' }}
              whileInView={{ width: `${burnShare * 100}%` }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 50, damping: 14, delay: 0.2 }}
            />
            <motion.div
              className="tug-mint"
              initial={{ width: '50%' }}
              whileInView={{ width: `${(1 - burnShare) * 100}%` }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 50, damping: 14, delay: 0.2 }}
            />
          </div>
          <div className="tug-legend">
            <span>
              <i className="dot dot-burn" /> Burned <b>{fmtNumber(icpBurnPerSec * DAY)}</b> ICP/day
            </span>
            <span>
              <i className="dot dot-mint" /> Minted <b>{fmtNumber(mint * DAY)}</b> ICP/day
            </span>
          </div>
          <p className="big-callout">
            Burn offsets <strong className="tone-burn">{fmtPct(offset, 1)}</strong> of new ICP issuance.
          </p>
        </motion.div>

        <motion.div className="card" variants={reveal}>
          <p className="card-label">Road to deflation</p>
          <div className="meter">
            <motion.div
              className="meter-fill"
              initial={{ width: 0 }}
              whileInView={{ width: `${progress * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            />
            <span className="meter-mark" style={{ left: '100%' }} />
          </div>
          <div className="tug-legend">
            <span>
              Now <b>{fmtNumber(r.tcPerSec, 3)}</b> TC/s
            </span>
            <span>
              Break-even <b>{fmtNumber(breakEven, 3)}</b> TC/s
            </span>
          </div>
          <p className="big-callout">
            {multiple != null && multiple > 1 ? (
              <>
                Cycle burn must grow <strong className="tone-mint">{fmtNumber(multiple, 2)}×</strong> for ICP to become net
                deflationary.
              </>
            ) : (
              <>Cycle burn already exceeds the issuance break-even.</>
            )}
          </p>
        </motion.div>
      </div>
    </Section>
  )
}
