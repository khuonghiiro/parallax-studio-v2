import type { Composition } from '@shared/types'

/** Reference vertical FOV used to place the default camera and compute auto-scale. */
export const REFERENCE_FOV = 40

/** Distance at which a z=0 plane of comp height fills the frame with the reference FOV. */
export function referenceDistance(comp: Pick<Composition, 'height'>): number {
  return comp.height / 2 / Math.tan(((REFERENCE_FOV / 2) * Math.PI) / 180)
}

/** Scale multiplier that keeps a layer's apparent size constant when pushed to depth z. */
export function autoScaleFactor(z: number, comp: Pick<Composition, 'height'>): number {
  const d = referenceDistance(comp)
  return Math.max(0.01, (z + d) / d)
}

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Smooth deterministic pseudo-noise in roughly [-1, 1] (sum of incommensurate sines). */
export function smoothNoise(t: number, seed: number): number {
  const s = seed * 12.9898
  return (
    0.5 * Math.sin(t * 1.0 + s) +
    0.3 * Math.sin(t * 2.31 + s * 1.7) +
    0.2 * Math.sin(t * 4.67 + s * 2.3)
  )
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

export function snapToFrame(t: number, fps: number): number {
  return Math.round(t * fps) / fps
}

export function formatTimecode(t: number, fps: number): string {
  const totalFrames = Math.round(t * fps)
  const f = totalFrames % fps
  const totalSec = Math.floor(totalFrames / fps)
  const s = totalSec % 60
  const m = Math.floor(totalSec / 60)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(m)}:${pad(s)}:${pad(f)}`
}
