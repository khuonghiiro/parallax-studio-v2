import { describe, expect, it } from 'vitest'
import { deformSkin, skinBones, skinWeights } from './layerSkinning'
import type { LayerRig } from '@shared/layerRig'

const rig: LayerRig = { duration: 2, loop: false, bones: [
  { id: 'root', name: 'Root', x: 0, y: 0, angle: 90, length: 50 },
  { id: 'tip', name: 'Tip', parentId: 'root', x: 0, y: 50, angle: 90, length: 50 },
  { id: 'other', name: 'Other', x: 0, y: 90, angle: 0, length: 100 }
], tracks: { tip: [{ time: 0, x: 0, y: 0, rotation: 60, easing: 'linear' }] } }
const binding = { boneId: 'root', x: 0, y: 0, rotation: 0, scale: 1 }

describe('2D mesh skinning', () => {
  it('normalizes weights and excludes unrelated branches', () => {
    const weights = skinWeights(0, 75, skinBones(rig, 'root'))
    expect(weights.map((w) => w.id)).not.toContain('other')
    expect(weights.reduce((s, w) => s + w.weight, 0)).toBeCloseTo(1)
  })
  it('preserves transformed rest geometry and never accumulates deformation', () => {
    const rest = { ...rig, tracks: {} }
    const points = new Float32Array([12, -40, 0, 0, -100, 0])
    const bind = { ...binding, x: 80, y: 20, rotation: 35, scale: 2, scaleX: -1, scaleY: 0.7 }
    deformSkin(points, bind, rest, 0).forEach((value, i) => expect(value).toBeCloseTo(points[i], 5))
    expect(deformSkin(points, binding, rig, 0)).toEqual(deformSkin(points, binding, rig, 0))
    expect([...points]).toEqual([12, -40, 0, 0, -100, 0])
  })
  it('bends the tip while keeping the root nearly fixed', () => {
    const result = deformSkin(new Float32Array([0, 0, 0, 0, -100, 0]), binding, rig, 0)
    expect(Math.abs(result[0])).toBeLessThan(0.1)
    expect(result[3]).toBeLessThan(-40)
    expect(result[4]).toBeGreaterThan(-80)
  })
})
