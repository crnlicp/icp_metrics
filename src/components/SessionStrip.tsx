import { motion } from 'motion/react'
import { tickerDecimals } from '../lib/format'
import type { Derived } from '../lib/metrics'
import { Clock } from './Icons'
import { Elapsed, LiveValue } from './Numbers'
import { reveal, stagger } from '../lib/motion'

export function SessionStrip({ d, sinceMs, icpBurnPerSec }: { d: Derived; sinceMs: number; icpBurnPerSec: number }) {
  const r = d.rates
  const mint = r.mintIcpPerSec ?? 0
  const net = mint - icpBurnPerSec
  // all-time odometers extrapolate from the latest ledger snapshot
  const burnedSince = d.totalBurnedTs != null ? d.totalBurnedTs * 1000 : sinceMs
  const supplySince = d.supplyTs != null ? d.supplyTs * 1000 : sinceMs

  return (
    <motion.section className="session" initial="hidden" animate="show" variants={stagger}>
      <motion.div className="session-clock" variants={reveal}>
        <Clock width={16} height={16} />
        <span>While you've been here</span>
        <b className="mono">
          <Elapsed sinceMs={sinceMs} />
        </b>
      </motion.div>
      <div className="session-grid">
        <motion.div className="stat" variants={reveal}>
          <span className="stat-label">Cycles burned</span>
          <span className="stat-value mono tone-burn">
            <LiveValue ratePerSec={r.tcPerSec} sinceMs={sinceMs} decimals={tickerDecimals(r.tcPerSec)} />
            <small> TC</small>
          </span>
        </motion.div>
        <motion.div className="stat" variants={reveal}>
          <span className="stat-label">ICP burned</span>
          <span className="stat-value mono tone-burn">
            <LiveValue ratePerSec={icpBurnPerSec} sinceMs={sinceMs} decimals={tickerDecimals(icpBurnPerSec)} />
            <small> ICP</small>
          </span>
        </motion.div>
        <motion.div className="stat" variants={reveal}>
          <span className="stat-label">ICP minted</span>
          <span className="stat-value mono tone-mint">
            <LiveValue ratePerSec={mint} sinceMs={sinceMs} decimals={tickerDecimals(mint)} />
            <small> ICP</small>
          </span>
        </motion.div>
        <motion.div className="stat" variants={reveal}>
          <span className="stat-label">Net new supply</span>
          <span className="stat-value mono">
            {net >= 0 ? '+' : ''}
            <LiveValue ratePerSec={net} sinceMs={sinceMs} decimals={tickerDecimals(Math.abs(net))} />
            <small> ICP</small>
          </span>
        </motion.div>
        {d.totalBurnedIcp != null && (
          <motion.div className="stat stat-wide" variants={reveal}>
            <span className="stat-label">All-time ICP burned · live estimate</span>
            <span className="stat-value mono tone-burn">
              <LiveValue base={d.totalBurnedIcp} ratePerSec={icpBurnPerSec} sinceMs={burnedSince} decimals={2} />
            </span>
          </motion.div>
        )}
        {d.supplyIcp != null && (
          <motion.div className="stat stat-wide" variants={reveal}>
            <span className="stat-label">Total ICP supply · live estimate</span>
            <span className="stat-value mono">
              <LiveValue base={d.supplyIcp} ratePerSec={net} sinceMs={supplySince} decimals={2} />
            </span>
          </motion.div>
        )}
      </div>
    </motion.section>
  )
}
