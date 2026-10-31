import { describe, expect, it } from 'vitest'
import type { LayerBone, LayerRig } from '@shared/layerRig'
import type { LayerComposite } from './types'
import {
  buildMirroredBoneChain,
  classifyBoneSide,
  collectMasterPoseTimes,
  computeBoneDepthMap,
  computeBoneInfluenceRadius,
  computeStrengthFromPointerDistance,
  computeTweenSpans,
  createBoneFromCanvasDrag,
  mirrorAngleAcrossYAxis,
  mirrorBoneId,
  mirrorBoneName
} from './mohoRigHelpers'
import { applyRigAction } from './workshopRig'
import { skinWeights } from '../../engine/layerSkinning'

describe('mohoRigHelpers — Moho Pro Rigging & Adobe Animate Dope Sheet', () => {
  it('phân loại đúng bên giải phẫu xương Left / Right / Center', () => {
    expect(classifyBoneSide({ id: 'arm_l', name: 'Cánh tay', x: -10 })).toBe('left')
    expect(classifyBoneSide({ id: 'arm_l_lower', name: 'Cẳng tay', x: 0 })).toBe('left')
    expect(classifyBoneSide({ id: 'b1', name: 'Vai Trái', x: 0 })).toBe('left')
    expect(classifyBoneSide({ id: 'leg-r', name: 'Đùi Phải', x: 10 })).toBe('right')
    expect(classifyBoneSide({ id: 'b2', name: 'Bàn tay (R)', x: 0 })).toBe('right')
    expect(classifyBoneSide({ id: 'spine', name: 'Cột sống', x: 0 })).toBe('center')
    expect(classifyBoneSide({ id: 'custom-1', name: 'Nhánh', x: -65 })).toBe('left')
    expect(classifyBoneSide({ id: 'custom-2', name: 'Nhánh', x: 72 })).toBe('right')
  })

  it('tính độ sâu cây phân cấp xương an toàn ngay cả khi có chu trình', () => {
    const bones: LayerBone[] = [
      { id: 'hip', name: 'Hông', x: 0, y: 0, length: 60, angle: -90 },
      { id: 'chest', name: 'Ngực', parentId: 'hip', x: 0, y: -60, length: 70, angle: -90 },
      { id: 'head', name: 'Đầu', parentId: 'chest', x: 0, y: -130, length: 50, angle: -90 },
      { id: 'loopA', name: 'A', parentId: 'loopB', x: 0, y: 0, length: 20, angle: 0 },
      { id: 'loopB', name: 'B', parentId: 'loopA', x: 0, y: 0, length: 20, angle: 0 }
    ]
    const depths = computeBoneDepthMap(bones)
    expect(depths.get('hip')).toBe(0)
    expect(depths.get('chest')).toBe(1)
    expect(depths.get('head')).toBe(2)
    expect(depths.get('loopA')).toBe(1)
  })

  it('tính bán kính viên nang Bone Strength và quy đổi từ khoảng cách kéo chuột', () => {
    const bone = { length: 100, strength: 1, pin: false }
    expect(computeBoneInfluenceRadius(bone)).toBeCloseTo(28, 1)
    expect(computeBoneInfluenceRadius({ ...bone, strength: 2 })).toBeCloseTo(56, 1)
    expect(computeBoneInfluenceRadius({ length: 16, strength: 1.5, pin: true })).toBeCloseTo(33, 1)

    expect(computeStrengthFromPointerDistance({ length: 100 }, 56)).toBeCloseTo(2, 1)
    expect(computeStrengthFromPointerDistance({ length: 100 }, 1)).toBe(0.15)
    expect(computeStrengthFromPointerDistance({ length: 100 }, 400)).toBe(3.5)
  })

  it('tạo Pin Bone khi click nhẹ (< 12px) và tạo xương định hướng khi bấm-kéo trên khung 2D', () => {
    const root: LayerBone = { id: 'spine', name: 'Thân', x: 0, y: 0, length: 80, angle: -90 }

    const pin = createBoneFromCanvasDrag({ x: -30, y: -50 }, { x: -27, y: -48 }, root, 1, 'pin-1')
    expect(pin.pin).toBe(true)
    expect(pin.parentId).toBe('spine')
    expect(pin.x).toBe(-30)
    expect(pin.y).toBe(-50)

    const drawn = createBoneFromCanvasDrag({ x: 0, y: -80 }, { x: 100, y: -80 }, root, 2, 'arm-1')
    expect(drawn.pin).toBeUndefined()
    expect(drawn.parentId).toBe('spine')
    expect(drawn.length).toBe(100)
    expect(drawn.angle).toBe(0)
  })

  it('đối xứng Trái ⇄ Phải (mirror-bone) phản chiếu toạ độ X, góc và cây phân cấp nhánh con', () => {
    expect(mirrorBoneName('Cánh tay Trái')).toBe('Cánh tay Phải')
    expect(mirrorBoneName('Upper Arm_L')).toBe('Upper Arm_R')
    expect(mirrorBoneId('arm_l', new Set(['arm_l']))).toBe('arm_r')
    expect(mirrorBoneId('arm_l_hand', new Set(['arm_l_hand']))).toBe('arm_r_hand')
    expect(mirrorAngleAcrossYAxis(0)).toBe(180)
    expect(mirrorAngleAcrossYAxis(-90)).toBe(-90)
    expect(mirrorAngleAcrossYAxis(150)).toBe(30)

    const baseBones: LayerBone[] = [
      { id: 'chest', name: 'Ngực', x: 0, y: -60, length: 70, angle: -90 },
      { id: 'arm_l', name: 'Bắp tay Trái', parentId: 'chest', x: -45, y: -110, length: 65, angle: 160, strength: 1.25 },
      { id: 'forearm_l', name: 'Cẳng tay Trái', parentId: 'arm_l', x: -106, y: -88, length: 55, angle: 140, strength: 0.9 }
    ]

    const mirrored = buildMirroredBoneChain(baseBones, 'arm_l')
    expect(mirrored).toHaveLength(2)
    expect(mirrored[0]).toMatchObject({
      id: 'arm_r',
      name: 'Bắp tay Phải',
      parentId: 'chest',
      x: 45,
      y: -110,
      angle: 20,
      strength: 1.25
    })
    expect(mirrored[1]).toMatchObject({
      id: 'forearm_r',
      name: 'Cẳng tay Phải',
      parentId: 'arm_r',
      x: 106,
      y: -88,
      angle: 40,
      strength: 0.9
    })

    const comp: LayerComposite = {
      id: 'comp-test',
      name: 'Nhân vật Test',
      category: 'character',
      width: 600,
      height: 600,
      layers: [],
      rig: {
        duration: 2,
        loop: true,
        bones: baseBones,
        tracks: {}
      }
    }
    const updated = applyRigAction(comp, { action: 'mirror-bone', boneId: 'arm_l' })
    expect(updated.rig?.bones).toHaveLength(5)
    expect(updated.rig?.bones.some((b) => b.id === 'arm_r')).toBe(true)
    expect(updated.rig?.bones.some((b) => b.id === 'forearm_r')).toBe(true)
  })

  it('tính thanh khoảng nội suy Tween Span kiểu Adobe Animate và hàng tổng hợp Master Pose', () => {
    const spans = computeTweenSpans(
      [
        { time: 0, x: 0, y: 0, rotation: 0, easing: 'smooth' },
        { time: 0.5, x: 0, y: 0, rotation: 30, easing: 'hold' },
        { time: 1.5, x: 0, y: 0, rotation: -20, easing: 'linear' },
        { time: 2.0, x: 0, y: 0, rotation: 0, easing: 'smooth' }
      ],
      2.0
    )
    expect(spans).toHaveLength(3)
    expect(spans[0]).toMatchObject({ leftPct: 0, widthPct: 25, kind: 'motion', easing: 'smooth' })
    expect(spans[1]).toMatchObject({ leftPct: 25, widthPct: 50, kind: 'hold', easing: 'hold' })
    expect(spans[2]).toMatchObject({ leftPct: 75, widthPct: 25, kind: 'linear', easing: 'linear' })

    const rig: LayerRig = {
      duration: 2,
      loop: true,
      bones: [
        { id: 'b1', name: 'X1', x: 0, y: 0, length: 50, angle: 0 },
        { id: 'b2', name: 'X2', x: 50, y: 0, length: 50, angle: 0 }
      ],
      tracks: {
        b1: [
          { time: 0, x: 0, y: 0, rotation: 0, easing: 'smooth' },
          { time: 0.8, x: 0, y: 0, rotation: 20, easing: 'smooth' }
        ],
        b2: [
          { time: 0.0004, x: 0, y: 0, rotation: 5, easing: 'smooth' },
          { time: 1.4, x: 0, y: 0, rotation: -15, easing: 'smooth' }
        ]
      }
    }
    expect(collectMasterPoseTimes(rig)).toEqual([0, 0.8, 1.4])
  })

  it('tích hợp hệ số Moho Bone Strength vào trọng số uốn mềm Flexi-Bind Mesh (layerSkinning)', () => {

    const defaultBones: LayerBone[] = [
      { id: 'left', name: 'Trái', x: -50, y: 0, length: 40, angle: 0 },
      { id: 'right', name: 'Phải', x: 10, y: 0, length: 40, angle: 0 }
    ]
    const explicitUnitBones: LayerBone[] = defaultBones.map((b) => ({ ...b, strength: 1 }))

    const wDefault = skinWeights(0, 25, defaultBones)
    const wUnit = skinWeights(0, 25, explicitUnitBones)
    expect(wDefault).toEqual(wUnit)

    // Tăng strength xương phải lên 2.6x làm điểm ở giữa (x=0, y=25) nghiêng mạnh hơn về xương phải
    const boostedRightBones: LayerBone[] = [
      { ...defaultBones[0], strength: 0.5 },
      { ...defaultBones[1], strength: 2.6 }
    ]
    const wBoosted = skinWeights(0, 25, boostedRightBones)
    const defaultRightW = wDefault.find((w) => w.id === 'right')?.weight ?? 0
    const boostedRightW = wBoosted.find((w) => w.id === 'right')?.weight ?? 0
    expect(boostedRightW).toBeGreaterThan(defaultRightW)
  })
})
