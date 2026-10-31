import { describe, expect, it } from 'vitest'
import type { LayerBone, LayerRig } from '@shared/layerRig'
import type { LayerComposite } from './types'
import {
  buildMirroredBoneChain,
  classifyBoneSide,
  collectMasterPoseTimes,
  computeBoneDepthMap,
  computeBoneInfluenceRadius,
  computeBoneTail,
  computeStrengthFromPointerDistance,
  computeTweenSpans,
  createBoneFromCanvasDrag,
  findPrimaryConnectedChild,
  isBoneTailCoincidentWithChild,
  mirrorAngleAcrossYAxis,
  mirrorBoneId,
  mirrorBoneName,
  weldConnectedLimbBones
} from './mohoRigHelpers'
import { applyRigAction } from './workshopRig'
import {
  createFullHumanoidBones,
  createHumanoidBones,
  generateBow,
  generateJump,
  generateLand
} from './workshopRigPresets'
import { CUTOUT_FRONT_BONES, CUTOUT_QUARTER_BONES } from './templates/humanoidTemplates'
import { createQuadrupedBones } from './templates/creatureRigPresets'
import { skinWeights } from '../../engine/layerSkinning'
import { evaluateRig } from '../../engine/layerRig'

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

  it('hàn khít 100% khớp ngọn xương cha trùng khớp gốc xương con cho mọi khung xương nhân vật/sinh vật', () => {
    const skeletons = [
      CUTOUT_FRONT_BONES,
      CUTOUT_QUARTER_BONES,
      createHumanoidBones(),
      createFullHumanoidBones(),
      createQuadrupedBones()
    ]
    for (const bones of skeletons) {
      const tf = evaluateRig({ bones, duration: 2, loop: true, tracks: {} }, 0, true)
      for (const parent of bones) {
        const primaryChild = findPrimaryConnectedChild(parent, bones)
        if (!primaryChild) continue
        const tail = computeBoneTail(parent)
        const gap = Math.hypot(tail.x - primaryChild.x, tail.y - primaryChild.y)
        expect(gap).toBeLessThanOrEqual(1.2)
        expect(isBoneTailCoincidentWithChild(parent, bones, tf)).toBe(true)
      }
    }

    // Kiểm tra hàn khớp tự động (snap-joints) khi xương bị lệch 18px như ảnh chụp người dùng
    const misaligned: LayerBone[] = [
      { id: 'arm_r', name: 'Bắp tay phải', x: 72, y: -110, length: 111, angle: 77 },
      { id: 'forearm_r', name: 'Cẳng tay phải', parentId: 'arm_r', x: 115, y: -2, length: 82, angle: 87 }
    ]
    const welded = weldConnectedLimbBones(misaligned)
    const weldedTail = computeBoneTail(welded[0])
    const weldedTf = evaluateRig({ bones: welded, duration: 2, loop: true, tracks: {} }, 0, true)
    expect(Math.hypot(weldedTail.x - welded[1].x, weldedTail.y - welded[1].y)).toBeLessThan(0.8)
    expect(isBoneTailCoincidentWithChild(welded[0], welded, weldedTf)).toBe(true)
  })

  it('sinh động tác mẫu chính diện 0° đối xứng Trái/Phải và foreshortening 2.5D (không nghiêng 90°)', () => {
    const bones = createHumanoidBones()
    const bowFront = generateBow(bones, 2.0, 'front')
    expect(bowFront['bone-torso']?.[1]?.rotation).toBe(0)
    expect(bowFront['bone-torso']?.[1]?.scaleY).toBeLessThan(0.9)
    expect(bowFront['bone-arm-l']?.[1]?.rotation).toBe(-(bowFront['bone-arm-r']?.[1]?.rotation ?? 0))

    const jumpFront = generateJump(bones, 1.4, 'front')
    expect(jumpFront['bone-torso']?.[1]?.rotation).toBe(0)
    expect(jumpFront['bone-arm-l']?.[1]?.rotation).toBe(-(jumpFront['bone-arm-r']?.[1]?.rotation ?? 0))
    expect(jumpFront['bone-thigh-l']?.[1]?.rotation).toBe(-(jumpFront['bone-thigh-r']?.[1]?.rotation ?? 0))

    const landFront = generateLand(bones, 1.2, 'front')
    expect(landFront['bone-torso']?.[1]?.rotation).toBe(0)
    expect(landFront['bone-arm-l']?.[1]?.rotation).toBe(-(landFront['bone-arm-r']?.[1]?.rotation ?? 0))
  })

  it('hỗ trợ FPS, co giãn tỷ lệ keyframe (scaleKeys) và chèn khung giữ dáng F5 (hold-frames)', () => {
    let comp: LayerComposite = {
      id: 'comp-timing',
      name: 'Timing Studio',
      category: 'character',
      width: 600,
      height: 600,
      layers: [],
      rig: {
        duration: 2.0,
        loop: true,
        fps: 30,
        bones: [{ id: 'arm', name: 'Tay', x: 0, y: 0, length: 80, angle: 90 }],
        tracks: {
          arm: [
            { time: 0, x: 0, y: 0, rotation: 0, easing: 'smooth' },
            { time: 1.0, x: 0, y: 0, rotation: 40, easing: 'smooth' },
            { time: 2.0, x: 0, y: 0, rotation: 0, easing: 'smooth' }
          ]
        }
      }
    }

    // Đổi FPS và co giãn thời lượng gấp đôi (2s -> 4s) kèm scaleKeys
    comp = applyRigAction(comp, { action: 'settings', fps: 24, duration: 4.0, scaleKeys: true })
    expect(comp.rig?.fps).toBe(24)
    expect(comp.rig?.duration).toBe(4.0)
    expect(comp.rig?.tracks.arm[1].time).toBeCloseTo(2.0, 3)
    expect(comp.rig?.tracks.arm[2].time).toBeCloseTo(4.0, 3)

    // Rút ngắn thời lượng không bật scaleKeys vẫn an toàn không văng lỗi validateRig
    comp = applyRigAction(comp, { action: 'settings', duration: 2.5, scaleKeys: false })
    expect(comp.rig?.duration).toBe(2.5)
    expect(comp.rig?.tracks.arm.every((k) => k.time <= 2.5)).toBe(true)

    // Chèn giữ khung F5 (+0.5s tại t = 1.0) đẩy các keyframe phía sau lùi lại 0.5s
    comp = applyRigAction(comp, { action: 'hold-frames', time: 1.0, holdSeconds: 0.5 })
    expect(comp.rig?.duration).toBeCloseTo(3.0, 3)
    expect(comp.rig?.tracks.arm.some((k) => Math.abs(k.time - 2.5) < 0.01 && k.rotation === 40)).toBe(true)
  })
})
