import { describe, expect, it } from 'vitest'
import type { LayerRig } from '@shared/layerRig'
import { sampleBonePose } from './layerRig'

function rig(times: number[], values: number[], loop = true): LayerRig {
  return { bones: [], duration: 2, loop, tracks: { root: times.map((time, i) =>
    ({ time, x: values[i], y: 0, rotation: values[i], easing: 'smooth' })) } }
}

describe('bone interpolation velocity', () => {
  const epsilon = 0.00001
  const x = (r: LayerRig, t: number) => sampleBonePose(r, 'root', t).x
  it('does not halve the velocity at a duplicated loop endpoint', () => {
    const r = rig([0, 0.5, 1, 1.5, 2], [0, 10, 0, -10, 0])
    expect((x(r, epsilon) - x(r, -epsilon)) / (2 * epsilon)).toBeCloseTo(20, 2)
  })
  it('keeps velocity continuous across unevenly spaced smooth keys', () => {
    const r = rig([0, 0.2, 1.1, 2], [0, 8, 12, 0], false)
    const before = (x(r, 0.2) - x(r, 0.2 - epsilon)) / epsilon
    const after = (x(r, 0.2 + epsilon) - x(r, 0.2)) / epsilon
    expect(before).toBeCloseTo(after, 2)
  })
  it('retains distinct endpoints and hold keys', () => {
    const r = rig([0, 1, 2], [0, 20, 40], false)
    expect(x(r, 2)).toBe(40)
    r.tracks.root[0].easing = 'hold'
    expect(x(r, 0.9)).toBe(0)
  })

  it('correctly calculates cubic ease-in, ease-out and ease-in-out curves', () => {
    const rIn: LayerRig = {
      bones: [],
      duration: 1,
      loop: false,
      tracks: {
        root: [
          { time: 0, x: 0, y: 0, rotation: 0, easing: 'ease-in' },
          { time: 1, x: 100, y: 0, rotation: 100, easing: 'ease-in' }
        ]
      }
    }
    // Midpoint t=0.5: t^3 = 0.125 -> x = 12.5
    expect(x(rIn, 0.5)).toBeCloseTo(12.5, 1)

    const rOut: LayerRig = {
      bones: [],
      duration: 1,
      loop: false,
      tracks: {
        root: [
          { time: 0, x: 0, y: 0, rotation: 0, easing: 'ease-out' },
          { time: 1, x: 100, y: 0, rotation: 100, easing: 'ease-out' }
        ]
      }
    }
    // Midpoint t=0.5: 1 - (1-0.5)^3 = 0.875 -> x = 87.5
    expect(x(rOut, 0.5)).toBeCloseTo(87.5, 1)

    const rInOut: LayerRig = {
      bones: [],
      duration: 1,
      loop: false,
      tracks: {
        root: [
          { time: 0, x: 0, y: 0, rotation: 0, easing: 'ease-in-out' },
          { time: 1, x: 100, y: 0, rotation: 100, easing: 'ease-in-out' }
        ]
      }
    }
    // Midpoint t=0.5: 0.5 -> x = 50
    expect(x(rInOut, 0.5)).toBeCloseTo(50, 1)
  })

  it('clamps smooth spline tangents at action reversal peaks without overshoot whip-back', () => {
    const slash: LayerRig = {
      bones: [],
      duration: 1.5,
      loop: true,
      tracks: {
        root: [
          { time: 0, x: 0, y: 0, rotation: 0, easing: 'smooth' },
          { time: 0.48, x: 0, y: 0, rotation: -124, easing: 'smooth' },
          { time: 0.81, x: 0, y: 0, rotation: 48, easing: 'smooth' },
          { time: 1.14, x: 0, y: 0, rotation: 32, easing: 'smooth' },
          { time: 1.5, x: 0, y: 0, rotation: 0, easing: 'smooth' }
        ]
      }
    }
    for (let t = 0; t <= 1.5; t += 0.01) {
      const rot = sampleBonePose(slash, 'root', t).rotation
      expect(rot).toBeGreaterThanOrEqual(-124.001)
      expect(rot).toBeLessThanOrEqual(48.001)
    }
    // Settle segment 0.81s (48°) -> 1.14s (32°) must decrease monotonically without whipping past +48°
    let prev = sampleBonePose(slash, 'root', 0.81).rotation
    for (let t = 0.83; t <= 1.14; t += 0.02) {
      const cur = sampleBonePose(slash, 'root', t).rotation
      expect(cur).toBeLessThanOrEqual(prev + 1e-5)
      prev = cur
    }
  })
})
