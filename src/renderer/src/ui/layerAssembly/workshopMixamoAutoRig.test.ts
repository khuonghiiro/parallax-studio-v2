import { describe, expect, it } from 'vitest'
import {
  MIXAMO_CORE_LANDMARK_IDS,
  MIXAMO_RING_GROUPS,
  autoBindLayersToMixamoBones,
  autoDetectLandmarksFromComposite,
  buildHumanoidBonesFromLandmarks,
  buildMixamoClipForBones,
  buildStarterPresetClipsForBones,
  createScaledLandmarks,
  extractLandmarksFromBones,
  moveLandmarkPoint,
  syncDerivedLandmarksFromCore8
} from './workshopMixamoAutoRig'
import { applyRigAction, emptyRig } from './workshopRig'
import type { LayerComposite } from './types'

function createSampleComposite(): LayerComposite {
  return {
    id: 'comp-test',
    name: 'Nhân vật thử nghiệm',
    category: 'character',
    width: 400,
    height: 500,
    layers: [
      {
        id: 'layer-char',
        name: 'Nhân vật nhỏ',
        x: 0,
        y: 10,
        z: 0,
        scale: 0.6,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      }
    ],
    rig: emptyRig()
  }
}

describe('workshopMixamoAutoRig & clip deletion', () => {
  it('tạo bộ 15 xương nhỏ hơn khi chọn tỉ lệ nhân vật nhỏ (0.6)', () => {
    const stdLm = createScaledLandmarks(1.0)
    const smallLm = createScaledLandmarks(0.6)

    const stdBones = buildHumanoidBonesFromLandmarks(stdLm)
    const smallBones = buildHumanoidBonesFromLandmarks(smallLm)

    expect(stdBones).toHaveLength(15)
    expect(smallBones).toHaveLength(15)

    const stdThigh = stdBones.find((b) => b.id === 'bone-thigh-l')!
    const smallThigh = smallBones.find((b) => b.id === 'bone-thigh-l')!
    expect(smallThigh.length).toBeLessThan(stdThigh.length)
  })

  it('đối xứng gương Trái/Phải khi kéo điểm landmark bên trái', () => {
    const lm = createScaledLandmarks(1.0)
    const moved = moveLandmarkPoint(lm, 'wristL', { x: -80, y: 15 }, true)
    expect(moved.wristL).toEqual({ x: -80, y: 15 })
    expect(moved.wristR).toEqual({ x: 80, y: 15 })
  })

  it('khôi phục lại landmarks từ bộ xương hiện có', () => {
    const lm = createScaledLandmarks(0.8)
    const bones = buildHumanoidBonesFromLandmarks(lm)
    const extracted = extractLandmarksFromBones(bones)
    expect(extracted).not.toBeNull()
    expect(extracted!.pelvis).toEqual(lm.pelvis)
    expect(extracted!.neck).toEqual(lm.neck)
  })

  it('co giãn biên độ bước chân theo tỉ lệ chân xương nhỏ/lớn', () => {
    const smallBones = buildHumanoidBonesFromLandmarks(createScaledLandmarks(0.5))
    const stdBones = buildHumanoidBonesFromLandmarks(createScaledLandmarks(1.0))

    const smallClip = buildMixamoClipForBones({
      preset: 'walk',
      bones: smallBones,
      name: 'Walk Small',
      viewAngle: 'front',
      duration: 1.6,
      loop: true
    })
    const stdClip = buildMixamoClipForBones({
      preset: 'walk',
      bones: stdBones,
      name: 'Walk Std',
      viewAngle: 'front',
      duration: 1.6,
      loop: true
    })

    const smallPelvisKeys = smallClip.tracks['bone-pelvis'] ?? []
    const stdPelvisKeys = stdClip.tracks['bone-pelvis'] ?? []
    const maxSmallY = Math.max(...smallPelvisKeys.map((k) => Math.abs(k.y)))
    const maxStdY = Math.max(...stdPelvisKeys.map((k) => Math.abs(k.y)))
    expect(maxSmallY).toBeLessThan(maxStdY)
  })

  it('cho phép xoá động tác cuối cùng và xoá hết toàn bộ động tác về tư thế tĩnh', () => {
    let comp = createSampleComposite()
    comp = applyRigAction(comp, { action: 'apply-template', template: 'humanoid' })
    expect(comp.rig!.clips!.length).toBe(1)
    expect(Object.keys(comp.rig!.tracks).length).toBeGreaterThan(0)

    // Xoá clip duy nhất -> phải xoá sạch tracks về Tư thế tĩnh
    const activeId = comp.rig!.activeClipId!
    comp = applyRigAction(comp, { action: 'delete-clip', clipId: activeId })
    expect(comp.rig!.clips).toHaveLength(1)
    expect(comp.rig!.clips![0].name).toBe('Tư thế tĩnh')
    expect(Object.keys(comp.rig!.tracks)).toHaveLength(0)

    // Thêm 2 động tác rồi bấm Xoá hết (delete-all-clips)
    const bones = comp.rig!.bones
    const clip1 = buildMixamoClipForBones({
      preset: 'walk',
      bones,
      name: 'Đi bộ',
      viewAngle: 'front',
      duration: 1.6,
      loop: true
    })
    const clip2 = buildMixamoClipForBones({
      preset: 'run',
      bones,
      name: 'Chạy',
      viewAngle: 'side',
      duration: 1.0,
      loop: true
    })
    comp = applyRigAction(comp, { action: 'add-clip', clip: clip1 })
    comp = applyRigAction(comp, { action: 'add-clip', clip: clip2 })
    expect(comp.rig!.clips).toHaveLength(2)

    comp = applyRigAction(comp, { action: 'delete-all-clips' })
    expect(comp.rig!.clips).toHaveLength(1)
    expect(comp.rig!.clips![0].name).toBe('Tư thế tĩnh')
    expect(Object.keys(comp.rig!.tracks)).toHaveLength(0)
  })

  it('áp dụng apply-mixamo-rig-motion tự tạo xương theo điểm và tự gắn layer uốn mềm', () => {
    let comp = createSampleComposite()
    const lm = autoDetectLandmarksFromComposite(comp)
    const bones = buildHumanoidBonesFromLandmarks(lm)
    const clip = buildMixamoClipForBones({
      preset: 'wave',
      bones,
      name: 'Vẫy tay chào',
      viewAngle: 'front',
      duration: 1.8,
      loop: true
    })

    comp = applyRigAction(comp, {
      action: 'apply-mixamo-rig-motion',
      bones,
      clip,
      autoBindSoft: true
    })

    expect(comp.rig!.bones).toHaveLength(15)
    expect(comp.rig!.activeClipId).toBe(clip.id)
    expect(comp.layers[0].boneId).toBe('bone-pelvis')
    expect(comp.layers[0].bindingMode).toBe('soft')
  })

  it('autoBindLayersToMixamoBones nhận diện tên layer bộ phận khi có nhiều layer', () => {
    const bones = buildHumanoidBonesFromLandmarks(createScaledLandmarks(1))
    const bound = autoBindLayersToMixamoBones(
      [
        {
          id: 'l1',
          name: 'Đầu nhân vật',
          x: 0,
          y: -100,
          z: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
        },
        {
          id: 'l2',
          name: 'Thân áo',
          x: 0,
          y: 0,
          z: 1,
          scale: 1,
          rotation: 0,
          opacity: 1,
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
        }
      ],
      bones
    )
    expect(bound[0].boneId).toBe('bone-head')
    expect(bound[1].boneId).toBe('bone-torso')
  })

  it('định nghĩa đúng 7 nhóm giải phẫu Mixamo (có đủ Hai Vai & Cổ chân) với 12 vòng tròn chính và không ghi đè Vai/Cổ chân khi kéo khớp khác', () => {
    expect(MIXAMO_RING_GROUPS.map((g) => g.title)).toEqual([
      'CHIN',
      'SHOULDERS',
      'ELBOWS',
      'WRISTS',
      'GROIN',
      'KNEES',
      'ANKLES'
    ])
    expect(MIXAMO_CORE_LANDMARK_IDS).toHaveLength(12)

    const lm = createScaledLandmarks(1.0)
    // Kéo Vai trái (shoulderL) rộng ra và Cổ chân trái (ankleL) dài xuống
    const withCustomShoulder = moveLandmarkPoint(lm, 'shoulderL', { x: -55, y: -68 }, true, true)
    expect(withCustomShoulder.shoulderL).toEqual({ x: -55, y: -68 })
    expect(withCustomShoulder.shoulderR).toEqual({ x: 55, y: -68 })

    const withCustomAnkle = moveLandmarkPoint(withCustomShoulder, 'ankleL', { x: -28, y: 195 }, true, true)
    expect(withCustomAnkle.ankleL).toEqual({ x: -28, y: 195 })
    expect(withCustomAnkle.ankleR).toEqual({ x: 28, y: 195 })

    // Khi kéo Đầu gối (kneeL) hoặc Khuỷu tay (elbowL), tuyệt đối KHÔNG ghi đè lại Vai hay Cổ chân đã chỉnh
    const afterKneeMove = moveLandmarkPoint(withCustomAnkle, 'kneeL', { x: -30, y: 118 }, true, true)
    expect(afterKneeMove.shoulderL).toEqual({ x: -55, y: -68 })
    expect(afterKneeMove.ankleL).toEqual({ x: -28, y: 195 })

    // Di chuyển Cằm (neck) lên cao -> Đỉnh đầu (headTop) và Ngực (chest) tự động dời theo
    const movedChin = moveLandmarkPoint(afterKneeMove, 'neck', { x: 0, y: -110 }, true, true)
    expect(movedChin.headTop.y).toBeLessThan(lm.headTop.y)
    expect(movedChin.chest.y).toBeLessThan(lm.chest.y)
    expect(movedChin.shoulderL).toEqual({ x: -55, y: -68 })
    expect(movedChin.ankleL).toEqual({ x: -28, y: 195 })

    // Hàm syncDerivedLandmarksFromCore8 vẫn hoạt động cho khởi tạo nhanh
    const synced8 = syncDerivedLandmarksFromCore8({ ...lm, neck: { x: 0, y: -110 } })
    expect(synced8.headTop.y).toBeLessThan(lm.headTop.y)
  })

  it('sinh trọn bộ 7 động tác mẫu chuẩn khi gắn xương tự động từ 12 điểm giải phẫu Mixamo', () => {
    let comp = createSampleComposite()
    const bones = buildHumanoidBonesFromLandmarks(createScaledLandmarks(0.75))
    const clips = buildStarterPresetClipsForBones(bones, 'front')
    expect(clips).toHaveLength(7)

    comp = applyRigAction(comp, {
      action: 'apply-mixamo-rig-motion',
      bones,
      clips,
      replaceClips: true,
      autoBindSoft: true
    })
    expect(comp.rig!.bones).toHaveLength(15)
    expect(comp.rig!.clips).toHaveLength(7)
    expect(comp.rig!.activeClipId).toBe(clips[0].id)
  })
})


