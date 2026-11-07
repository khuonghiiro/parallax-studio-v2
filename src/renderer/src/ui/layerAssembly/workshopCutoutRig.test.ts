import { describe, it, expect } from 'vitest'
import type { AssembledLayerItem, LayerComposite } from './types'
import {
  analyzeCutoutParts,
  autoRigAllCutoutParts,
  createBoneForSingleLayer
} from './workshopCutoutRig'
import { applyRigAction } from './workshopRig'

function createSampleChibiLayers(): AssembledLayerItem[] {
  return [
    { id: 'l1', name: 'Mảnh #1 (332×329)', x: -13, y: -234, z: 2, scale: 0.53, rotation: 0, opacity: 1, motion: { type: 'none', speed: 1, amplitude: 10, anchor: 'center' } },
    { id: 'l2', name: 'Mảnh #2 (315×452)', x: -17, y: -246, z: 14, scale: 0.53, rotation: 0, opacity: 1, motion: { type: 'none', speed: 1, amplitude: 10, anchor: 'center' } },
    { id: 'l3', name: 'Mảnh #3 (245×289)', x: -13, y: -210, z: 14, scale: 0.53, rotation: 0, opacity: 1, motion: { type: 'none', speed: 1, amplitude: 10, anchor: 'center' } },
    { id: 'l4', name: 'Mảnh #4 (387×726)', x: -14, y: -6, z: -2, scale: 0.4, rotation: 0, opacity: 1, motion: { type: 'none', speed: 1, amplitude: 10, anchor: 'center' } },
    { id: 'l5', name: 'Mảnh #5 (199×567)', x: -88, y: 25, z: 0, scale: 0.51, rotation: 0, opacity: 1, motion: { type: 'none', speed: 1, amplitude: 10, anchor: 'center' } },
    { id: 'l6', name: 'Mảnh #6 (199×566)', x: 63, y: 30, z: 0, scale: 0.51, rotation: 0, opacity: 1, motion: { type: 'none', speed: 1, amplitude: 10, anchor: 'center' } },
    { id: 'l7', name: 'Mảnh #7 (141×411)', x: -45, y: 165, z: 0, scale: 0.53, rotation: 0, opacity: 1, motion: { type: 'none', speed: 1, amplitude: 10, anchor: 'center' } },
    { id: 'l8', name: 'Mảnh #8 (141×410)', x: 23, y: 166, z: 0, scale: 0.53, rotation: 0, opacity: 1, motion: { type: 'none', speed: 1, amplitude: 10, anchor: 'center' } },
    { id: 'l9', name: 'Mảnh #9 (123×344)', x: 6, y: 62, z: -60, scale: 0.53, rotation: 0, opacity: 1, motion: { type: 'none', speed: 1, amplitude: 10, anchor: 'center' } },
    { id: 'l10', name: 'Mảnh #10 (59×322)', x: 6, y: 15, z: -45, scale: 0.53, rotation: 0, opacity: 1, motion: { type: 'none', speed: 1, amplitude: 10, anchor: 'center' } }
  ]
}

function createSampleComposite(): LayerComposite {
  return {
    id: 'comp-sample-chibi',
    name: 'Nhân vật Chibi',
    category: 'character',
    width: 600,
    height: 860,
    layers: createSampleChibiLayers()
  }
}

describe('workshopCutoutRig', () => {
  it('phân tích chính xác vai trò giải phẫu theo không gian của các mảnh ghép', () => {
    const layers = createSampleChibiLayers()
    const parts = analyzeCutoutParts(layers)

    expect(parts.length).toBe(10)

    const torso = parts.find((p) => p.layer.id === 'l4')
    expect(torso?.role).toBe('torso')

    const head = parts.find((p) => p.layer.id === 'l3')
    expect(head?.role).toBe('head')

    const armL = parts.find((p) => p.layer.id === 'l5')
    expect(armL?.role).toBe('arm_left')

    const armR = parts.find((p) => p.layer.id === 'l6')
    expect(armR?.role).toBe('arm_right')

    const legL = parts.find((p) => p.layer.id === 'l7')
    expect(legL?.role).toBe('leg_left')

    const legR = parts.find((p) => p.layer.id === 'l8')
    expect(legR?.role).toBe('leg_right')
  })

  it('1-Click Auto-Rig: tự động dựng cây xương hoàn chỉnh và gán cho 100% các mảnh', () => {
    const comp = createSampleComposite()
    const rigged = autoRigAllCutoutParts(comp)

    const unbound = rigged.layers.filter((l) => !l.boneId)
    if (unbound.length > 0) {
      console.log('Unbound layers:', unbound.map((l) => ({ id: l.id, name: l.name })))
    }

    expect(rigged.rig).toBeDefined()
    expect(rigged.rig?.bones.length).toBeGreaterThanOrEqual(6)

    const boneTorso = rigged.rig?.bones.find((b) => b.id === 'bone-torso')
    const boneHead = rigged.rig?.bones.find((b) => b.id === 'bone-head')
    const boneArmL = rigged.rig?.bones.find((b) => b.id === 'bone-arm-l')
    const boneArmR = rigged.rig?.bones.find((b) => b.id === 'bone-arm-r')

    expect(boneTorso).toBeDefined()
    expect(boneHead?.parentId).toBe('bone-torso')
    expect(boneArmL?.parentId).toBe('bone-torso')
    expect(boneArmR?.parentId).toBe('bone-torso')

    expect(unbound.length).toBe(0)
    expect(rigged.rig?.clips && rigged.rig.clips.length > 0).toBe(true)
  })

  it('tạo xương đơn lẻ cho 1 mảnh và tự động gán vào mảnh đó', () => {
    const comp = createSampleComposite()
    const result = createBoneForSingleLayer('l3', comp, undefined, 'rigid')

    const l3 = result.layers.find((l) => l.id === 'l3')
    expect(l3?.boneId).toBeDefined()
    expect(l3?.bindingMode).toBe('rigid')

    const bone = result.rig?.bones.find((b) => b.id === l3?.boneId)
    expect(bone).toBeDefined()
  })

  it('hỗ trợ RigAction auto-rig-cutout-parts và reparent-bone qua applyRigAction', () => {
    const comp = createSampleComposite()
    const rigged = applyRigAction(comp, { action: 'auto-rig-cutout-parts' })

    expect(rigged.rig?.bones.length).toBeGreaterThan(0)

    const reparented = applyRigAction(rigged, {
      action: 'reparent-bone',
      boneId: 'bone-arm-l',
      newParentId: 'bone-head'
    })

    const armL = reparented.rig?.bones.find((b) => b.id === 'bone-arm-l')
    expect(armL?.parentId).toBe('bone-head')
  })
})
