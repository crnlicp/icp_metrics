import { useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { MAX_EMBERS_PER_SEC, MAX_FLARES_PER_SEC } from '../lib/ticker'

/**
 * Canvas 2D particle simulation.
 *  - burn: embers rise from the bottom, cooling yellow → orange → red.
 *  - mint: sparks materialise near the top and drift down.
 * Each particle represents a fixed amount (chosen by the parent), so the
 * spawn rate *is* the real on-chain rate: there are no decorative extras, and
 * every particle fades out at the end of its life. Pauses when offscreen.
 */

export type Variant = 'burn' | 'mint'

/** An ICP-burn flare: ignites mid-card, swells, then explodes into shards. */
interface Flare {
  x: number
  y: number
  age: number
  life: number
  size: number
  phase: number
}
interface Shard {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  sprite: number
}
interface Ring {
  x: number
  y: number
  age: number
  life: number
  r: number
}

interface P {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  phase: number
  sprite: number
  spark: boolean
}

const BURN_RAMP = ['#fff3b0', '#ffd166', '#ffb347', '#ff8c42', '#ff6b35', '#f04a23', '#c9301c', '#7a1d12']
// ICP-burn flares: hot magenta so they read apart from the cycle embers
const FLARE_RAMP = ['#fff0f6', '#ffb3d1', '#ff6fae', '#f43f7a', '#e11d74', '#9d174d']
const MINT_RAMP = ['#e0fbff', '#7ef0ff', '#29d3f0', '#38bdf8', '#818cf8', '#a78bfa', '#c084fc']

function makeSprites(ramp: string[]): HTMLCanvasElement[] {
  return ramp.map((c) => {
    const s = 64
    const cv = document.createElement('canvas')
    cv.width = cv.height = s
    const g = cv.getContext('2d')!
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.18, c)
    grad.addColorStop(0.45, c + '55')
    grad.addColorStop(1, c + '00')
    g.fillStyle = grad
    g.fillRect(0, 0, s, s)
    return cv
  })
}

export function ParticleField({
  variant,
  particlesPerSec,
  flaresPerSec = 0,
  className,
}: {
  variant: Variant
  particlesPerSec: number
  flaresPerSec?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rateRef = useRef(particlesPerSec)
  const flareRateRef = useRef(flaresPerSec)
  const reduce = useReducedMotion()

  useEffect(() => {
    rateRef.current = particlesPerSec
    flareRateRef.current = flaresPerSec
  }, [particlesPerSec, flaresPerSec])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || reduce) return
    const ctx = canvas.getContext('2d', { alpha: true })!
    const sprites = makeSprites(variant === 'burn' ? BURN_RAMP : MINT_RAMP)
    const particles: P[] = []
    const flareSprites = makeSprites(FLARE_RAMP)
    const flares: Flare[] = []
    const shards: Shard[] = []
    const rings: Ring[] = []
    let flareAcc = 0
    const mobile = window.matchMedia('(max-width: 640px)').matches
    // room for the capped spawn rate × the longest life, so no particle is ever dropped
    const MAX = 1100
    let w = 0
    let h = 0
    let dpr = 1
    let acc = 0
    let raf = 0
    let last = performance.now()
    let visible = true

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = r.width
      h = r.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const spawn = () => {
      if (particles.length >= MAX) return
      if (variant === 'burn') {
        // bias spawn toward the centre for a natural flame column
        const u = (Math.random() + Math.random() + Math.random()) / 3
        particles.push({
          x: u * w,
          y: h + 6,
          vx: (Math.random() - 0.5) * 18,
          vy: -(35 + Math.random() * 95),
          age: 0,
          life: 2.2 + Math.random() * 2.8,
          size: Math.random() < 0.08 ? 10 + Math.random() * 14 : 2 + Math.random() * 4.5,
          phase: Math.random() * Math.PI * 2,
          sprite: 0,
          spark: Math.random() < 0.12,
        })
      } else {
        // new ICP materialises near the top and drifts down into the card
        particles.push({
          x: Math.random() * w,
          y: h * Math.random() * 0.35 - 6,
          vx: (Math.random() - 0.5) * 8,
          vy: 12 + Math.random() * 26,
          age: 0,
          life: 2.2 + Math.random() * 2.6,
          size: Math.random() < 0.1 ? 9 + Math.random() * 8 : 2.5 + Math.random() * 4,
          phase: Math.random() * Math.PI * 2,
          sprite: Math.floor(Math.random() * sprites.length),
          spark: Math.random() < 0.3,
        })
      }
    }

    const spawnFlare = () => {
      if (flares.length > 24) return
      // middle band of the card, away from the ember column at the bottom
      flares.push({
        x: w * (0.15 + Math.random() * 0.7),
        y: h * (0.3 + Math.random() * 0.3),
        age: 0,
        life: 1.1 + Math.random() * 0.8,
        size: 9 + Math.random() * 6,
        phase: Math.random() * Math.PI * 2,
      })
    }

    const explode = (f: Flare) => {
      const n = (mobile ? 14 : 22) + Math.floor(Math.random() * 8)
      for (let i = 0; i < n && shards.length < 400; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4
        const v = 70 + Math.random() * 120
        shards.push({
          x: f.x,
          y: f.y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          age: 0,
          life: 0.6 + Math.random() * 0.7,
          size: 2 + Math.random() * 3,
          sprite: 1 + Math.floor(Math.random() * (flareSprites.length - 1)),
        })
      }
      rings.push({ x: f.x, y: f.y, age: 0, life: 0.55, r: 34 + f.size * 2 })
    }

    const drawFlares = (dt: number, t: number) => {
      for (let i = flares.length - 1; i >= 0; i--) {
        const f = flares[i]
        f.age += dt
        const k = f.age / f.life
        if (k >= 1) {
          explode(f)
          flares.splice(i, 1)
          continue
        }
        f.y -= 8 * dt
        // swell with a quickening pulse as it nears ignition
        const pulse = 1 + 0.18 * Math.sin(t * 0.012 * (1 + k * 3) + f.phase)
        const s = f.size * (0.3 + k * 0.9) * pulse * 4
        ctx.globalAlpha = Math.min(1, k * 3) * 0.95
        ctx.drawImage(flareSprites[Math.min(2, Math.floor(k * 3))], f.x - s / 2, f.y - s / 2, s, s)
        ctx.globalAlpha = Math.min(1, k * 3) * 0.35
        ctx.drawImage(flareSprites[3], f.x - s, f.y - s, s * 2, s * 2)
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]
        r.age += dt
        const k = r.age / r.life
        if (k >= 1) {
          rings.splice(i, 1)
          continue
        }
        ctx.globalAlpha = 0.55 * (1 - k)
        ctx.strokeStyle = '#ff8fc0'
        ctx.lineWidth = 2 * (1 - k) + 0.5
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r * (0.25 + 0.75 * (1 - Math.pow(1 - k, 3))), 0, Math.PI * 2)
        ctx.stroke()
      }
      for (let i = shards.length - 1; i >= 0; i--) {
        const p = shards[i]
        p.age += dt
        const k = p.age / p.life
        if (k >= 1) {
          shards.splice(i, 1)
          continue
        }
        p.vx *= 1 - 2.4 * dt
        p.vy = p.vy * (1 - 2.4 * dt) + 40 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        const s = p.size * (1 - k * 0.6) * 4
        ctx.globalAlpha = 1 - k
        ctx.drawImage(flareSprites[Math.min(flareSprites.length - 1, p.sprite + Math.floor(k * 2))], p.x - s / 2, p.y - s / 2, s, s)
      }
    }

    const draw = (dt: number, t: number) => {
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      if (variant === 'burn') drawFlares(dt, t)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.age += dt
        const k = p.age / p.life
        if (k >= 1 || p.y < -30 || p.y > h + 30) {
          particles.splice(i, 1)
          continue
        }
        if (variant === 'burn') {
          p.vx += Math.sin(t * 0.002 + p.phase) * 14 * dt
          p.vy *= 1 - 0.15 * dt
          p.x += p.vx * dt
          p.y += p.vy * dt
          const sprite = sprites[Math.min(sprites.length - 1, Math.floor(k * sprites.length))]
          const flicker = 0.75 + 0.25 * Math.sin(t * 0.02 + p.phase * 7)
          const alpha = (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9) * flicker * (p.size > 9 ? 0.18 : 0.95)
          const s = p.size * (1 - k * 0.5) * 4
          ctx.globalAlpha = Math.max(0, alpha)
          ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s)
        } else {
          p.vx *= 1 - 1.2 * dt
          p.vy = p.vy * (1 - 1.2 * dt) + 18 * dt
          p.x += p.vx * dt + Math.sin(t * 0.001 + p.phase) * 0.15
          p.y += p.vy * dt
          const pop = k < 0.12 ? easeOutBack(k / 0.12) : 1
          const alpha = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88
          const s = p.size * pop * 4
          ctx.globalAlpha = Math.max(0, alpha * (p.size > 9 ? 0.25 : 0.9))
          ctx.drawImage(sprites[p.sprite], p.x - s / 2, p.y - s / 2, s, s)
          if (p.spark && k < 0.5) {
            // four-point twinkle when the token materialises
            const L = p.size * 3.2 * (1 - k * 2)
            ctx.globalAlpha = 0.7 * (1 - k * 2)
            ctx.strokeStyle = '#d6f8ff'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(p.x - L, p.y)
            ctx.lineTo(p.x + L, p.y)
            ctx.moveTo(p.x, p.y - L)
            ctx.lineTo(p.x, p.y + L)
            ctx.stroke()
          }
        }
        if (variant === 'burn' && p.spark && k < 0.6) {
          ctx.globalAlpha = 0.9 * (1 - k)
          ctx.fillStyle = '#fff6d5'
          ctx.fillRect(p.x, p.y, 1.2, 1.2)
        }
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      // rAF timestamps can precede performance.now() taken at setup: never let dt go negative
      const dt = Math.max(0, Math.min(0.05, (t - last) / 1000))
      last = t
      if (!visible) return
      acc += Math.min(rateRef.current, MAX_EMBERS_PER_SEC) * dt
      while (acc >= 1) {
        spawn()
        acc -= 1
      }
      if (variant === 'burn') {
        flareAcc += Math.min(flareRateRef.current, MAX_FLARES_PER_SEC) * dt
        while (flareAcc >= 1) {
          spawnFlare()
          flareAcc -= 1
        }
      }
      draw(dt, t)
    }

    resize()
    // pre-warm so the field isn't empty on first paint
    for (let i = 0; i < 90; i++) {
      for (let j = 0; j < Math.min(rateRef.current, MAX_EMBERS_PER_SEC) / 30; j++) spawn()
      draw(1 / 30, i * 33)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(canvas)
    const onVis = () => {
      last = performance.now()
    }
    document.addEventListener('visibilitychange', onVis)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [variant, reduce])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

function easeOutBack(x: number) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
