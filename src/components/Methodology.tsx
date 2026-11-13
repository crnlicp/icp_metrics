import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Chevron } from './Icons'
import { reveal } from '../lib/motion'
import { Section } from './Section'

const ITEMS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Cycle burn rate',
    a: (
      <>
        Network-wide cycles consumed per second by all canisters, from <code>ic-api /metrics/cycle-burn-rate</code>. 1 TC = 10¹²
        cycles = 1 XDR (SDR). Refreshed every 5 seconds (as fast as the upstream metric updates).
      </>
    ),
  },
  {
    q: 'ICP burn rate',
    a: (
      <>
        <b>Ledger · 7d</b> (default): actual ICP destroyed on the ledger (ICP→cycles conversions and fees), the 7-day trailing
        average of <code>ledger-api /icp-burned/series</code>.
        <br />
        <b>From cycles · live</b>: current cycle burn × ICP-per-TC at today’s ICP/XDR rate. It shows what the burn is worth now,
        while ICP is only burned when cycles are bought.
      </>
    ),
  },
  {
    q: 'ICP mint rate',
    a: (
      <>
        Total supply only changes through mints and burns, so <code>minted = Δsupply + Δburned</code>. Both series come from the
        ledger API, averaged over 30 days because maturity disbursements arrive in lumps. A second estimate adds daily NNS voting
        rewards (<code>/metrics/last-reward-event</code>) to monthly node-provider rewards (
        <code>/timeseries/reward-node-providers</code>). Voting rewards are paid as maturity, so that estimate shows the issuance
        already committed, not ICP that exists today.
      </>
    ),
  },
  {
    q: 'Inflation',
    a: (
      <>
        <b>Net</b> = (minted − burned) ÷ supply, annualised. <b>Gross</b> = minted ÷ supply. <b>Realized</b> = actual compound change
        in total supply over the last 365 days. Shorter timeframes scale the annual rate linearly.
      </>
    ),
  },
  {
    q: 'Break-even',
    a: <>The cycle burn rate at which ICP burned for cycles equals ICP minted: mint ICP/s × XDR-per-ICP = TC/s.</>,
  },
  {
    q: 'Simulation',
    a: (
      <>
        Every ember and spark stands for a fixed amount (shown under each panel), so the on-screen spawn rate matches the real
        rate. Counters extrapolate from the last data point. Animations pause off-screen and respect “reduce motion”.
      </>
    ),
  },
]

export function Methodology() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <Section id="method" eyebrow="Transparency" title="How it’s calculated">
      <motion.div className="accordion" variants={reveal}>
        {ITEMS.map((it, i) => (
          <div key={it.q} className={`acc-item ${open === i ? 'open' : ''}`}>
            <button className="acc-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span>{it.q}</span>
              <motion.span animate={{ rotate: open === i ? 180 : 0 }}>
                <Chevron width={18} height={18} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div
                  className="acc-a"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p>{it.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </motion.div>
    </Section>
  )
}
