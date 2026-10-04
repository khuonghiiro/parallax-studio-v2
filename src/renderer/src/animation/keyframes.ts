import { nanoid } from 'nanoid'
import type { Animatable, AnimValue, EaseName, Keyframe } from '@shared/types'
import { ease } from './easing'

export function anim<T extends AnimValue>(value: T): Animatable<T> {
  return { value, keyframes: [] }
}

export function isAnimated(a: Animatable<AnimValue>): boolean {
  return a.keyframes.length > 0
}

function lerpValue<T extends AnimValue>(a: T, b: T, u: number): T {
  if (typeof a === 'number') return (a + ((b as number) - a) * u) as T
  const av = a as number[]
  const bv = b as number[]
  return [av[0] + (bv[0] - av[0]) * u, av[1] + (bv[1] - av[1]) * u, av[2] + (bv[2] - av[2]) * u] as T
}

/** Evaluate an animatable property at time t (seconds). Pure function. */
export function evaluate<T extends AnimValue>(a: Animatable<T>, t: number): T {
  const ks = a.keyframes
  if (ks.length === 0) return a.value
  if (t <= ks[0].t) return ks[0].value
  const last = ks[ks.length - 1]
  if (t >= last.t) return last.value
  // Binary search for the segment [i, i+1] containing t.
  let lo = 0
  let hi = ks.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (ks[mid].t <= t) lo = mid
    else hi = mid
  }
  const k0 = ks[lo]
  const k1 = ks[hi]
  const span = k1.t - k0.t
  const u = span <= 0 ? 1 : (t - k0.t) / span
  return lerpValue(k0.value, k1.value, ease(k0.ease, u))
}

function sortKeys<T>(a: Animatable<T>): void {
  a.keyframes.sort((x, y) => x.t - y.t)
}

/** Find a keyframe at time t within tolerance (e.g. half a frame). */
export function keyAt<T>(a: Animatable<T>, t: number, tolerance: number): Keyframe<T> | undefined {
  return a.keyframes.find((k) => Math.abs(k.t - t) <= tolerance)
}

/**
 * After-Effects-style value set: if the property is animated, create/update a keyframe
 * at time t; otherwise set the static value. Mutates (use inside an immer producer).
 */
export function setValueAt<T extends AnimValue>(a: Animatable<T>, t: number, value: T, tolerance: number): void {
  if (a.keyframes.length === 0) {
    a.value = value
    return
  }
  const existing = keyAt(a, t, tolerance)
  if (existing) existing.value = value
  else {
    a.keyframes.push({ id: nanoid(8), t, value, ease: 'easeInOut' })
    sortKeys(a)
  }
}

/** Toggle animation on/off (the AE stopwatch). */
export function toggleAnimated<T extends AnimValue>(a: Animatable<T>, t: number): void {
  if (a.keyframes.length > 0) {
    a.value = evaluate(a, t)
    a.keyframes = []
  } else {
    a.keyframes = [{ id: nanoid(8), t, value: a.value, ease: 'easeInOut' }]
  }
}

export function addKeyframe<T extends AnimValue>(
  a: Animatable<T>,
  t: number,
  value: T,
  easeName: EaseName = 'easeInOut',
  tolerance = 1e-4
): Keyframe<T> {
  const existing = keyAt(a, t, tolerance)
  if (existing) {
    existing.value = value
    existing.ease = easeName
    return existing
  }
  const k: Keyframe<T> = { id: nanoid(8), t, value, ease: easeName }
  a.keyframes.push(k)
  sortKeys(a)
  return k
}

export function removeKeyframe<T>(a: Animatable<T>, id: string): boolean {
  const i = a.keyframes.findIndex((k) => k.id === id)
  if (i < 0) return false
  const [removed] = a.keyframes.splice(i, 1)
  if (a.keyframes.length === 0) a.value = removed.value
  return true
}

export function moveKeyframe<T>(a: Animatable<T>, id: string, t: number): boolean {
  const k = a.keyframes.find((x) => x.id === id)
  if (!k) return false
  k.t = Math.max(0, t)
  sortKeys(a)
  return true
}
