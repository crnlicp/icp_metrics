import { MotionConfig, motion } from 'motion/react'
import { useState } from 'react'
import { Balance } from './components/Balance'
import { Charts } from './components/Charts'
import { Header } from './components/Header'
import { Hero, type BurnSource } from './components/Hero'
import { Inflation } from './components/Inflation'
import { Methodology } from './components/Methodology'
import { SessionStrip } from './components/SessionStrip'
import { Timeframes } from './components/Timeframes'
import { useMetrics } from './hooks/useMetrics'

function Skeleton() {
  return (
    <div className="hero" aria-busy="true" aria-label="Loading metrics">
      {[0, 1].map((i) => (
        <div key={i} className="panel skeleton">
          <div className="sk sk-sm" />
          <div className="sk sk-xl" />
          <div className="sk sk-md" />
          <div className="sk-row">
            <div className="sk sk-card" />
            <div className="sk sk-card" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const { raw, derived: d, status, errors, updatedAt, reload } = useMetrics()
  const [sinceMs] = useState(() => Date.now())
  const [source, setSource] = useState<BurnSource>('cycles')

  const icpBurnPerSec = d
    ? source === 'ledger'
      ? (d.rates.ledgerBurnIcpPerSec ?? d.rates.cycleImpliedIcpPerSec)
      : d.rates.cycleImpliedIcpPerSec
    : 0

  return (
    <MotionConfig reducedMotion="user">
      <div className="bg" aria-hidden>
        <div className="blob blob-a" />
        <div className="blob blob-b" />
        <div className="blob blob-c" />
        <div className="grain" />
      </div>
      <div className="wrap">
        <Header icpUsd={d?.icpUsd ?? null} change24h={d?.icpUsdChange24h ?? null} updatedAt={updatedAt} onRefresh={reload} />

        <motion.div className="intro" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
          <h1>
            The Internet Computer, <span className="grad-burn">burning</span> and <span className="grad-mint">minting</span> in real
            time.
          </h1>
        </motion.div>

        {status === 'error' && !d && (
          <div className="card error">
            <p>Couldn’t reach the IC dashboard APIs.</p>
            <button className="btn" onClick={reload}>
              Retry
            </button>
          </div>
        )}

        {!d && status === 'loading' && <Skeleton />}

        {d && raw && (
          <>
            <Hero d={d} sinceMs={sinceMs} source={source} onSource={setSource} />
            <SessionStrip d={d} sinceMs={sinceMs} icpBurnPerSec={icpBurnPerSec} />
            <Balance d={d} icpBurnPerSec={icpBurnPerSec} />
            <Timeframes d={d} icpBurnPerSec={icpBurnPerSec} />
            <Inflation d={d} />
            <Charts d={d} cycleSeries={raw.cycleBurnSeries} />
            <Methodology />
          </>
        )}

        {errors.length > 0 && d && (
          <p className="warn-note" title={errors.join('\n')}>
            Some data sources didn’t respond ({errors.length}). Values from them are hidden or estimated.
          </p>
        )}

        <footer className="footer">
          <span>
            Data:{' '}
            <a href="https://ic-api.internetcomputer.org/api/v3/swagger" target="_blank" rel="noreferrer">
              IC API
            </a>{' '}
            ·{' '}
            <a href="https://ledger-api.internetcomputer.org/swagger-ui/" target="_blank" rel="noreferrer">
              Ledger API
            </a>
          </span>
          <span className="muted">Served from an ICP canister · not financial advice</span>
        </footer>
      </div>
    </MotionConfig>
  )
}
