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
})
