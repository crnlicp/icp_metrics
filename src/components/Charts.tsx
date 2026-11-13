import { motion } from 'motion/react'
import { useId, useMemo, useRef, useState } from 'react'
import { fmtCompact, fmtNumber } from '../lib/format'
import type { Derived } from '../lib/metrics'
import { reveal } from '../lib/motion'
import { Section } from './Section'

interface Series {
  name: string
  color: string
  points: [number, number][] // [unix sec, value]
}

const W = 640
const H = 260
const PAD = { l: 52, r: 16, t: 16, b: 28 }

function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  const out: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v)
  if (out.at(-1)! < max) out.push(out.at(-1)! + step)
  return out
}

const fmtDate = (ts: number, withTime = false) =>
  new Date(ts * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })

function LineChart({
  series,
  yFormat,
  unit,
  withTime,
  area,
  label,
  clipOutliers,
}: {
  series: Series[]
  yFormat: (n: number) => string
  unit: string
  withTime?: boolean
  area?: boolean
  label: string
  clipOutliers?: boolean
}) {
  const gid = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const { x0, x1, ticks, yMax, paths, clippedPeak } = useMemo(() => {
    const all = series.flatMap((s) => s.points)
    const x0 = Math.min(...all.map((p) => p[0]))
    const x1 = Math.max(...all.map((p) => p[0]))
    const values = all.map((p) => p[1]).sort((a, b) => a - b)
    const max = values.at(-1)!
    // a single glitchy spike shouldn't flatten the whole series: cap the axis
    // near the 99th percentile and say so, rather than silently dropping it
    const p99 = values[Math.floor(values.length * 0.99) - 1] ?? max
    const cap = clipOutliers && max > p99 * 1.6 ? p99 * 1.35 : max
    const ticks = niceTicks(cap)
    const yMax = ticks.at(-1)!
    const clippedPeak = cap < max ? max : null
    const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0 || 1)) * (W - PAD.l - PAD.r)
    const sy = (y: number) => H - PAD.b - (Math.min(y, yMax) / yMax) * (H - PAD.t - PAD.b)
    const paths = series.map((s) => {
      const line = s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('')
      const last = s.points.at(-1)!
      const fill = `${line}L${sx(last[0]).toFixed(1)},${H - PAD.b}L${sx(s.points[0][0]).toFixed(1)},${H - PAD.b}Z`
      return { line, fill, end: [sx(last[0]), sy(last[1])] as const, sx, sy }
    })
    return { x0, x1, ticks, yMax, paths, clippedPeak }
  }, [series, clipOutliers])

  const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0 || 1)) * (W - PAD.l - PAD.r)
  const sy = (y: number) => H - PAD.b - (Math.min(y, yMax) / yMax) * (H - PAD.t - PAD.b)
  const ref = series[0].points

  const onMove = (e: React.PointerEvent) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const t = x0 + ((x - PAD.l) / (W - PAD.l - PAD.r)) * (x1 - x0)
    let best = 0
    for (let i = 1; i < ref.length; i++) if (Math.abs(ref[i][0] - t) < Math.abs(ref[best][0] - t)) best = i
    setHover(best)
  }

  const hx = hover != null ? sx(ref[hover][0]) : 0
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => x0 + f * (x1 - x0))

  return (
    <div className="chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`${gid}-g${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity="0.35" />
              <stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} className="grid" />
            <text x={PAD.l - 8} y={sy(t)} className="axis" textAnchor="end" dominantBaseline="middle">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={sx(t)} y={H - 8} className="axis" textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>
            {fmtDate(t)}
          </text>
        ))}
        {paths.map((p, i) => (
          <g key={series[i].name}>
            {area && (
              <motion.path
                d={p.fill}
                fill={`url(#${gid}-g${i})`}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, delay: 0.6 }}
              />
            )}
            <motion.path
              d={p.line}
              fill="none"
              stroke={series[i].color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1], delay: i * 0.15 }}
            />
            <motion.circle
              cx={p.end[0]}
              cy={p.end[1]}
              r={4}
              fill={series[i].color}
              stroke="var(--surface)"
              strokeWidth={2}
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.6 }}
            />
          </g>
        ))}
        {hover != null && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={PAD.t} y2={H - PAD.b} className="crosshair" />
            {series.map((s) => {
              const p = s.points[Math.min(hover, s.points.length - 1)]
              return <circle key={s.name} cx={sx(p[0])} cy={sy(p[1])} r={5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
            })}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="tooltip" style={{ left: `${(hx / W) * 100}%` }}>
          <span className="muted">{fmtDate(ref[hover][0], withTime)}</span>
          {series.map((s) => (
            <span key={s.name}>
              <i className="dot" style={{ background: s.color }} /> {s.name}{' '}
              <b>
                {fmtNumber(s.points[Math.min(hover, s.points.length - 1)][1], 4)} {unit}
              </b>
            </span>
          ))}
        </div>
      )}
      {clippedPeak != null && (
        <p className="chart-note">
          ▲ Axis capped; a brief spike peaked at {fmtNumber(clippedPeak, 3)} {unit}
        </p>
      )}
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.name}>
              <i className="dot" style={{ background: s.color }} /> {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Charts({ d, cycleSeries }: { d: Derived; cycleSeries: [number, number][] }) {
  const cyc: Series = useMemo(
    () => ({ name: 'Cycle burn', color: 'var(--burn-chart)', points: cycleSeries.map(([t, v]) => [t, v / 1e12]) }),
    [cycleSeries],
  )

  const cumulative = useMemo(() => {
    const last = d.daily.slice(-90)
    let b = 0
    let m = 0
    const burned: [number, number][] = []
    const minted: [number, number][] = []
    for (const f of last) {
      b += f.burnedIcp
      m += f.mintedIcp
      burned.push([f.ts, b])
      minted.push([f.ts, m])
    }
    return [
      { name: 'Minted', color: 'var(--mint-chart)', points: minted },
      { name: 'Burned', color: 'var(--burn-chart)', points: burned },
    ] as Series[]
  }, [d.daily])

  const hasCum = cumulative[0].points.length > 2
  const cumTotals = hasCum ? cumulative.map((s) => s.points.at(-1)![1]) : []

  return (
    <Section id="trends" eyebrow="History" title="Trends">
      <div className="chart-grid">
        {cyc.points.length > 2 && (
          <motion.div className="card" variants={reveal}>
            <div className="chart-head">
              <p className="card-label">Cycle burn rate · last 7 days</p>
              <p className="chart-headline">
                {fmtNumber(cyc.points.at(-1)![1], 3)} <small>TC/s now</small>
              </p>
            </div>
            <LineChart series={[cyc]} unit="TC/s" yFormat={(n) => fmtNumber(n, 2)} area withTime clipOutliers label="Hourly cycle burn rate, last 7 days" />
          </motion.div>
        )}
        {hasCum && (
          <motion.div className="card" variants={reveal}>
            <div className="chart-head">
              <p className="card-label">Cumulative ICP minted vs. burned · 90 days</p>
              <p className="chart-headline">
                <span className="tone-mint">{fmtCompact(cumTotals[0])}</span> <small>minted</small>{' '}
                <span className="tone-burn">{fmtCompact(cumTotals[1])}</span> <small>burned</small>
              </p>
            </div>
            <LineChart series={cumulative} unit="ICP" yFormat={(n) => fmtCompact(n, 1)} label="Cumulative ICP minted and burned over 90 days" />
          </motion.div>
        )}
      </div>
    </Section>
  )
}
