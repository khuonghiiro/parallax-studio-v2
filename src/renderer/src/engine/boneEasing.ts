import type { BoneBezier } from '@shared/layerRig'

/** Invert the Bezier X axis, then evaluate Y. Y may overshoot for anticipation/bounce. */
export function cubicBezierProgress(progress: number, curve: BoneBezier = [0.25, 0.1, 0.25, 1]): number {
  if (progress <= 0 || progress >= 1) return Math.max(0, Math.min(1, progress))
  const [x1, y1, x2, y2] = curve
  const at = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3
  let low = 0, high = 1
  for (let i = 0; i < 28; i++) {
    const mid = (low + high) / 2
    if (at(mid, x1, x2) < progress) low = mid
    else high = mid
  }
  return at((low + high) / 2, y1, y2)
}
