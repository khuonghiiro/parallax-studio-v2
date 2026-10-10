import { describe, expect, it } from 'vitest'
import { deformSkin, skinBones, skinWeights } from './layerSkinning'
import { evaluateRig, transformRigLayer } from './layerRig'
import { createHumanoidBones, createSimpleChainBones, generateSway, generateWalkCycle } from '../ui/layerAssembly/workshopRigPresets'
import type { LayerRig } from '@shared/layerRig'

const rig: LayerRig = { duration: 2, loop: false, bones: [
  { id: 'root', name: 'Root', x: 0, y: 0, angle: 90, length: 50 },
  { id: 'tip', name: 'Tip', parentId: 'root', x: 0, y: 50, angle: 90, length: 50 },
  { id: 'other', name: 'Other', x: 0, y: 90, angle: 0, length: 100 }
], tracks: { tip: [{ time: 0, x: 0, y: 0, rotation: 60, easing: 'linear' }] } }
const binding = { boneId: 'root', x: 0, y: 0, rotation: 0, scale: 1 }

describe('2D mesh skinning', () => {
  it('does not add sibling branches when including the immediate parent', () => {
    const humanoid = { bones: createHumanoidBones(), duration: 1, loop: false, tracks: {} }
    expect(skinBones(humanoid, 'bone-arm-l').map((b) => b.id).sort()).toEqual(
      ['bone-arm-l', 'bone-forearm-l', 'bone-hand-l', 'bone-torso'].sort())
  })
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
  it('correctly deforms relative to animated layer transform with bindPose', () => {
    const singleRig: LayerRig = {
      duration: 1,
      loop: false,
      bones: [{ id: 'b1', name: 'Bone 1', x: 10, y: 20, angle: 0, length: 50 }],
      tracks: { b1: [{ time: 0.5, x: 25, y: -15, rotation: 30, easing: 'linear' }] }
    }
    const restBind = { boneId: 'b1', x: 10, y: 20, rotation: 0, scale: 1 }
    const points = new Float32Array([5, 10, 0, -5, -10, 0])

    // When the layer is transformed by the bone at t=0.5:
    // It should keep the same local coordinates because all vertices belong to bone b1 (rigid follower)
    const animLayer = {
      ...restBind,
      x: 35, // moved with bone
      y: 5,
      rotation: 30,
      bindPose: { x: 10, y: 20, rotation: 0 }
    }
    const deformed = deformSkin(points, animLayer, singleRig, 0.5)
    expect(deformed[0]).toBeCloseTo(points[0], 2)
    expect(deformed[1]).toBeCloseTo(points[1], 2)
    expect(deformed[3]).toBeCloseTo(points[3], 2)
    expect(deformed[4]).toBeCloseTo(points[4], 2)
  })

  it('tests 3-bone chain sway deforming mesh vertices smoothly', () => {
    const bones = createSimpleChainBones()
    const rig = { bones, duration: 2.0, loop: true, tracks: generateSway(bones, 2.0) }
    const layer = {
      id: 'tree-trunk',
      boneId: 'bone-chain-root',
      bindingMode: 'soft' as const,
      x: 0,
      y: 40,
      scale: 1,
      rotation: 0
    }
    // Vertices along trunk from base to tip:
    const geom = new Float32Array([0, -80, 0, 0, 0, 0, 0, 80, 0])
    const transforms = evaluateRig(rig, 1.0)
    const transformed = transformRigLayer(layer, transforms)
    const deformed = deformSkin(geom, { ...transformed, bindPose: { x: layer.x, y: layer.y, rotation: layer.rotation } }, rig, 1.0)
    // Base vertex (near root) should have minimal relative displacement
    // Tip vertex (near tip bone) should curve significantly
    expect(Math.abs(deformed[0])).toBeLessThan(25)
    expect(Math.abs(deformed[6])).toBeGreaterThan(10)
  })
})
