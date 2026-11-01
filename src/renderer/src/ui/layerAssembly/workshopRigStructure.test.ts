import { describe, expect, it } from 'vitest'
import type { LayerComposite } from './types'
import { applyRigAction } from './workshopRig'
import { computeBoneTail } from './mohoRigHelpers'
import { buildIkChain, solveCcd } from './workshopIk'
import { boneDragAction, startBoneDrag } from './workshopBoneDrag'
import { clampBoneRotation, mirrorAngleLimits } from './boneConstraints'

const base: LayerComposite = {
  id: 'structure-comp',
  name: 'Structure',
  category: 'character',
  width: 600,
  height: 600,
  layers: [
    { id: 'l-1', name: 'Mảnh', x: 0, y: 0, z: 0, scale: 1, rotation: 0, opacity: 1, motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' } }
  ]
}

const withRoot = () =>
  applyRigAction(base, { action: 'add-bone', bone: { id: 'root', name: 'Thân', x: 0, y: 0, length: 40, angle: -90 } })

describe('Dựng kết cấu xương thủ công (Moho / Adobe Animate)', () => {
  it('add-bone-chain tạo chuỗi N đốt nối khít từ ngọn xương cha', () => {
    const next = applyRigAction(withRoot(), {
      action: 'add-bone-chain', parentId: 'root', angle: 0, length: 120, segments: 4, namePrefix: 'Đuôi', idPrefix: 'tail'
    })
    const chain = next.rig!.bones.filter((b) => b.id.startsWith('tail-'))
    expect(chain.map((b) => b.name)).toEqual(['Đuôi 1', 'Đuôi 2', 'Đuôi 3', 'Đuôi 4'])
    expect(chain[0].parentId).toBe('root')
    expect(chain[0].y).toBeCloseTo(-40)
    for (let i = 1; i < chain.length; i++) {
      const tail = computeBoneTail(chain[i - 1])
      expect(chain[i].parentId).toBe(chain[i - 1].id)
      expect(Math.hypot(tail.x - chain[i].x, tail.y - chain[i].y)).toBeLessThan(0.05)
    }
  })

  it('subdivide-bone chia xương thành các đốt đều và chuyển xương con sang đốt cuối', () => {
    let comp = applyRigAction(withRoot(), {
      action: 'add-bone', bone: { id: 'head', name: 'Đầu', parentId: 'root', x: 0, y: -40, length: 20, angle: -90 }
    })
    comp = applyRigAction(comp, { action: 'subdivide-bone', boneId: 'root', segments: 3 })
    const ids = comp.rig!.bones.map((b) => b.id)
    expect(ids).toEqual(['root', 'root-d2', 'root-d3', 'head'])
    expect(comp.rig!.bones[0].length).toBeCloseTo(40 / 3)
    expect(comp.rig!.bones.find((b) => b.id === 'head')!.parentId).toBe('root-d3')
    expect(comp.rig!.bones[0].name).toBe('Thân 1')
  })

  it('radial-array-bone nhân chi quanh khớp gốc và đối xứng sang bên phải (chân nhện)', () => {
    let comp = applyRigAction(withRoot(), {
      action: 'add-bone-chain', parentId: 'root', start: { x: -10, y: -20 }, angle: -150, length: 90, segments: 3, idPrefix: 'leg', namePrefix: 'Chân Trái'
    })
    comp = applyRigAction(comp, { action: 'radial-array-bone', boneId: 'leg-1', count: 4, stepAngle: -25, mirror: true })
    const bones = comp.rig!.bones
    expect(bones).toHaveLength(1 + 3 * 4 * 2)
    const copy = bones.find((b) => b.id === 'leg-1-a2')!
    expect(copy.angle).toBeCloseTo(-175)
    expect(copy.x).toBeCloseTo(-10)
    expect(bones.find((b) => b.id === 'leg-2-a2')!.parentId).toBe('leg-1-a2')
    expect(bones.filter((b) => b.x > 5).length).toBe(12)
  })

  it('giới hạn quá số xương tối đa báo lỗi rõ ràng', () => {
    expect(() => applyRigAction(withRoot(), { action: 'add-bone-chain', parentId: 'root', length: 100, segments: 16 })).not.toThrow()
    let comp = withRoot()
    for (let i = 0; i < 7; i++) comp = applyRigAction(comp, { action: 'add-bone-chain', length: 100, segments: 16 })
    expect(() => applyRigAction(comp, { action: 'add-bone-chain', length: 100, segments: 16 })).toThrow(/128/)
  })
})

describe('Giới hạn góc khớp (Constrain Rotation)', () => {
  it('kẹp góc, phản chiếu giới hạn và kiểm tra hợp lệ', () => {
    expect(clampBoneRotation({ minAngle: -10, maxAngle: 40 }, 90)).toBe(40)
    expect(clampBoneRotation({}, 90)).toBe(90)
    expect(mirrorAngleLimits({ minAngle: -10, maxAngle: 40 })).toEqual({ minAngle: -40, maxAngle: 10 })
    expect(() =>
      applyRigAction(withRoot(), { action: 'update-bone', boneId: 'root', patch: { minAngle: 30, maxAngle: -30 } })
    ).toThrow(/angle limit/)
    const cleared = applyRigAction(
      applyRigAction(withRoot(), { action: 'update-bone', boneId: 'root', patch: { minAngle: -30, maxAngle: 30 } }),
      { action: 'update-bone', boneId: 'root', patch: { minAngle: undefined, maxAngle: undefined } }
    )
    expect('minAngle' in cleared.rig!.bones[0]).toBe(false)
  })

  it('IK CCD và xoay FK không vượt giới hạn khớp', () => {
    let comp = applyRigAction(withRoot(), {
      action: 'add-bone-chain', parentId: 'root', angle: 0, length: 100, segments: 2, idPrefix: 'arm'
    })
    comp = applyRigAction(comp, { action: 'update-bone', boneId: 'arm-2', patch: { minAngle: 0, maxAngle: 20 } })
    const rig = comp.rig!
    const chain = buildIkChain(rig, 'arm-2', 2, 0)
    expect(chain.limits?.[1]).toEqual([0, 20])
    const deltas = solveCcd(chain, { x: 0, y: -40 }, undefined, 60)
    expect(chain.baseRotations[1] + deltas[1]).toBeGreaterThanOrEqual(-1e-6)
    expect(chain.baseRotations[1] + deltas[1]).toBeLessThanOrEqual(20 + 1e-6)

    const drag = startBoneDrag(rig, 'arm-2', 0, false, 'rotate', { x: 100, y: -40 })
    const action = boneDragAction(drag, { x: 50, y: 60 }, false) as { action: string; operations?: Array<{ key: { rotation?: number } }> }
    const rotation = action.action === 'batch' ? action.operations!.at(-1)!.key.rotation : (action as any).key.rotation
    expect(rotation).toBeLessThanOrEqual(20)
    expect(rotation).toBeGreaterThanOrEqual(0)
  })
})
