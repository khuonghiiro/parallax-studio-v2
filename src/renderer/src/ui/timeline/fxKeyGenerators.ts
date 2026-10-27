import type { Animatable, Keyframe, Vec3 } from '@shared/types'
import { addKeyframe, evaluate } from '../../animation/keyframes'

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function resolveRestScale(target: Animatable<Vec3>, start: number): Vec3 {
  const orig = evaluate(target, start)
  const rest = target.value ?? [1, 1, 1]
  const sx = Math.abs(orig[0]) >= 0.05 ? orig[0] : Math.abs(rest[0]) >= 0.05 ? rest[0] : 1
  const sy = Math.abs(orig[1]) >= 0.05 ? orig[1] : Math.abs(rest[1]) >= 0.05 ? rest[1] : 1
  const sz = orig[2] || rest[2] || 1
  return [sx, sy, sz]
}

export function generateBlinkKeys(
  target: Animatable<number>,
  start: number,
  duration: number,
  blinks = 4,
  minVal = 0.05,
  tol = 1e-4
): Keyframe<number>[] {
  const keys: Keyframe<number>[] = []
  const evalVal = evaluate(target, start)
  const currentVal = evalVal >= 0.1 ? evalVal : Math.max(0.1, target.value ?? 1)
  const step = duration / blinks
  keys.push(addKeyframe(target, round3(start), currentVal, 'easeInOut', tol))

  for (let i = 0; i < blinks; i++) {
    const tMid = round3(start + i * step + step * 0.5)
    const tEnd = round3(start + (i + 1) * step)
    keys.push(addKeyframe(target, tMid, minVal, 'easeInOut', tol))
    keys.push(addKeyframe(target, tEnd, currentVal, 'easeInOut', tol))
  }
  return keys
}

export function generateBreatheKeys(
  target: Animatable<number>,
  start: number,
  duration: number,
  minVal = 0.2,
  tol = 1e-4
): Keyframe<number>[] {
  const keys: Keyframe<number>[] = []
  const evalVal = evaluate(target, start)
  const currentVal = evalVal >= 0.2 ? evalVal : Math.max(0.2, target.value ?? 1)
  keys.push(addKeyframe(target, round3(start), currentVal, 'easeInOut', tol))
  keys.push(addKeyframe(target, round3(start + duration * 0.5), minVal, 'easeInOut', tol))
  keys.push(addKeyframe(target, round3(start + duration), currentVal, 'easeInOut', tol))
  return keys
}

export function generateFadeKeys(
  target: Animatable<number>,
  start: number,
  duration: number,
  mode: 'in' | 'out',
  tol = 1e-4
): Keyframe<number>[] {
  const keys: Keyframe<number>[] = []
  if (mode === 'out') {
    const evalVal = evaluate(target, start)
    const currentVal = evalVal >= 0.1 ? evalVal : Math.max(0.1, target.value ?? 1)
    keys.push(addKeyframe(target, round3(start), currentVal, 'easeInOut', tol))
    keys.push(addKeyframe(target, round3(start + duration), 0, 'easeInOut', tol))
  } else {
    keys.push(addKeyframe(target, round3(start), 0, 'easeInOut', tol))
    keys.push(addKeyframe(target, round3(start + duration), 1, 'easeInOut', tol))
  }
  return keys
}

export function generateShakeKeys(
  target: Animatable<Vec3>,
  start: number,
  duration: number,
  intensity = 18,
  shakes = 5,
  tol = 1e-4
): Keyframe<Vec3>[] {
  const keys: Keyframe<Vec3>[] = []
  const orig = evaluate(target, start)
  keys.push(addKeyframe(target, round3(start), [...orig] as Vec3, 'easeInOut', tol))

  const count = Math.max(1, shakes)
  const step = duration / (count + 1)
  const basePatterns: [number, number][] = [
    [1.0, -0.4],
    [-0.85, 0.6],
    [0.6, -0.7],
    [-0.4, 0.3],
    [0.2, -0.15]
  ]

  for (let i = 0; i < count; i++) {
    const t = round3(start + (i + 1) * step)
    const decay = 1.0 - (i / count) * 0.65
    const pattern = basePatterns[i % basePatterns.length]
    const offX = Math.round(pattern[0] * intensity * decay * 10) / 10
    const offY = Math.round(pattern[1] * intensity * decay * 10) / 10
    const p: Vec3 = [orig[0] + offX, orig[1] + offY, orig[2]]
    keys.push(addKeyframe(target, t, p, 'easeInOut', tol))
  }

  keys.push(addKeyframe(target, round3(start + duration), [...orig] as Vec3, 'easeInOut', tol))
  return keys
}

export function generatePopInKeys(
  target: Animatable<Vec3>,
  start: number,
  duration: number,
  bounces = 2,
  bounceScale = 1.2,
  tol = 1e-4
): Keyframe<Vec3>[] {
  const keys: Keyframe<Vec3>[] = []
  const baseScale = resolveRestScale(target, start)

  keys.push(addKeyframe(target, round3(start), [0.001, 0.001, 1], 'easeOut', tol))

  const numBounces = Math.max(1, bounces)
  const riseRatio = Math.min(0.5, 0.3 + 0.15 / numBounces)
  const riseTime = duration * riseRatio
  const bounceWindow = duration - riseTime
  const stepTime = bounceWindow / (numBounces * 2)

  let peakExcess = Math.max(0.06, bounceScale - 1.0)

  for (let i = 0; i < numBounces; i++) {
    const tPeak = round3(start + riseTime + i * 2 * stepTime)
    const peakFactor = round3(1.0 + peakExcess)
    keys.push(
      addKeyframe(
        target,
        tPeak,
        [round3(baseScale[0] * peakFactor), round3(baseScale[1] * peakFactor), 1],
        'easeInOut',
        tol
      )
    )

    if (i < numBounces - 1) {
      const tValley = round3(start + riseTime + (i * 2 + 1) * stepTime)
      const valleyFactor = round3(1.0 - peakExcess * 0.4)
      keys.push(
        addKeyframe(
          target,
          tValley,
          [round3(baseScale[0] * valleyFactor), round3(baseScale[1] * valleyFactor), 1],
          'easeInOut',
          tol
        )
      )
    }

    peakExcess *= 0.35
  }

  keys.push(addKeyframe(target, round3(start + duration), baseScale, 'easeOut', tol))
  return keys
}

export function generatePulseKeys(
  target: Animatable<Vec3>,
  start: number,
  duration: number,
  pulses = 1,
  factor = 1.25,
  tol = 1e-4
): Keyframe<Vec3>[] {
  const keys: Keyframe<Vec3>[] = []
  const baseScale = resolveRestScale(target, start)

  const count = Math.max(1, pulses)
  const cycleDur = duration / count

  keys.push(addKeyframe(target, round3(start), baseScale, 'easeInOut', tol))

  for (let i = 0; i < count; i++) {
    const cycleStart = start + i * cycleDur
    const midT = round3(cycleStart + cycleDur * 0.45)
    const endT = round3(cycleStart + cycleDur)

    keys.push(
      addKeyframe(
        target,
        midT,
        [round3(baseScale[0] * factor), round3(baseScale[1] * factor), 1],
        'easeInOut',
        tol
      )
    )
    keys.push(addKeyframe(target, endT, baseScale, 'easeInOut', tol))
  }
  return keys
}
