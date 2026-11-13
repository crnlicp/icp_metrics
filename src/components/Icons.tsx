import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
})

export const Flame = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.2 1-3.8 2.2-5 .3 1.6 1.1 2.6 2.3 3 0-3.6-.8-6.4.5-9Z" />
  </svg>
)

export const Sparkle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="M12 8.5 13.2 11l2.3 1-2.3 1L12 15.5 10.8 13l-2.3-1 2.3-1Z" fill="currentColor" stroke="none" />
  </svg>
)

export const Scale = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0L7 7ZM17 7l-3 7a3 3 0 0 0 6 0l-3-7ZM8 21h8" />
  </svg>
)

export const Trend = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
  </svg>
)

export const Clock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export const Info = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
)

export const Chevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const Refresh = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
  </svg>
)

/** Generic infinity mark used as the app logo. */
export const LogoMark = (p: SVGProps<SVGSVGElement>) => (
  <svg width={36} height={20} viewBox="0 0 72 40" fill="none" aria-hidden {...p}>
    <defs>
      <linearGradient id="inf-a" x1="0" x2="1">
        <stop offset="0" stopColor="#f15a24" />
        <stop offset="0.45" stopColor="#fbb03b" />
        <stop offset="0.55" stopColor="#29abe2" />
        <stop offset="1" stopColor="#7b3fe4" />
      </linearGradient>
    </defs>
    <path
      d="M36 20c-5-6-10-13-18-13a13 13 0 0 0 0 26c8 0 13-7 18-13Zm0 0c5 6 10 13 18 13a13 13 0 0 0 0-26c-8 0-13 7-18 13Z"
      stroke="url(#inf-a)"
      strokeWidth="5.5"
      strokeLinecap="round"
    />
  </svg>
)

export const Gear = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
)

export const Close = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
