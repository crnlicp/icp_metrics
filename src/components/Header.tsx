import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { fmtUsd, timeAgo } from '../lib/format'
import { LogoMark, Refresh } from './Icons'

export function Header({
  icpUsd,
  change24h,
  updatedAt,
  onRefresh,
}: {
  icpUsd: number | null
  change24h: number | null
  updatedAt: number | null
  onRefresh: () => void
}) {
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <motion.header
      className="topbar"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="brand">
        <LogoMark />
        <div>
          <strong>ICP Pulse</strong>
          <span>Burn · Mint · Inflation</span>
        </div>
      </div>
      <div className="topbar-right">
        {icpUsd != null && (
          <div className="price-chip" title="ICP / USD">
            <span className="muted">ICP</span>
            <strong>{fmtUsd(icpUsd)}</strong>
            {change24h != null && (
              <span className={change24h >= 0 ? 'up' : 'down'}>
                {change24h >= 0 ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
              </span>
            )}
          </div>
        )}
        <button className="live-chip" onClick={onRefresh} title="Refresh now">
          <span className="pulse-dot" />
          <span>Live</span>
          {updatedAt && <span className="muted hide-sm">· {timeAgo(updatedAt / 1000)}</span>}
          <Refresh width={14} height={14} />
        </button>
      </div>
    </motion.header>
  )
}
