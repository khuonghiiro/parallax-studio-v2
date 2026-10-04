import type { EaseName } from '@shared/types'

/** Solve a CSS-style cubic-bezier(x1, y1, x2, y2) for y given x in [0, 1]. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t
  const sampleDX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx

  const solveT = (x: number): number => {
    // Newton-Raphson, falling back to bisection.
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x
      if (Math.abs(err) < 1e-6) return t
      const d = sampleDX(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 30; i++) {
      const v = sampleX(t)
      if (Math.abs(v - x) < 1e-6) break
      if (v < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return t
  }

  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    return sampleY(solveT(x))
  }
}

const EASES: Record<EaseName, (x: number) => number> = {
  linear: (x) => x,
  easeIn: cubicBezier(0.42, 0, 1, 1),
  easeOut: cubicBezier(0, 0, 0.58, 1),
  easeInOut: cubicBezier(0.42, 0, 0.58, 1),
  easeInOutStrong: cubicBezier(0.83, 0, 0.17, 1),
  hold: (x) => (x >= 1 ? 1 : 0)
}

export const EASE_LABELS: Record<EaseName, string> = {
  linear: 'Linear',
  easeIn: 'Ease In',
  easeOut: 'Ease Out',
  easeInOut: 'Easy Ease',
  easeInOutStrong: 'Strong Ease',
  hold: 'Hold'
}

export function ease(name: EaseName, x: number): number {
  return (EASES[name] ?? EASES.linear)(x)
}
