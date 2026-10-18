import { describe, expect, it } from 'vitest'
import { sampleBonePose } from '../../engine/layerRig'
import type { LayerComposite } from './types'
import { applyRigAction, ensureRigClips } from './workshopRig'
import { confirmPoseAndStep } from './workshopStepRecord'
import { ikChainIds } from './workshopIk'
import { boneDragAction, startBoneDrag } from './workshopBoneDrag'
import { applyMotionSketch, createSketchAnchor } from './workshopMotionSketch'
import { buildHumanoidBonesFromLandmarks, createScaledLandmarks } from './workshopMixamoAutoRig'

function makeCharacterComposite(): LayerComposite {
  const bones = buildHumanoidBonesFromLandmarks(createScaledLandmarks(1.0))
  return {
    id: 'comp-test',
    name: 'Nhân vật Test',
    category: 'character',
    icon: '🧑',
    width: 600,
    height: 600,
    layers: [
      {
        id: 'layer-1',
        name: 'Body',
        assetPath: 'test.png',
        z: 0,
        scale: 1,
        x: 0,
        y: 0,
        width: 300,
        height: 450,
        opacity: 1,
        rotation: 0,
        tiltX: 0,
        tiltY: 0,
        blur: 0,
        colorGrade: { brightness: 0, contrast: 0, saturation: 0, tint: '#ffffff', tintStrength: 0 },
        motion: { type: 'none', speed: 1, amplitude: 1, phase: 0, frequency: 1 },
        bindingMode: 'soft',
        boneId: 'bone-pelvis'
      }
    ],
    rig: {
      bones,
      tracks: {},
      duration: 2.0,
      loop: true
    }
  }
}

describe('workshopStepRecord & Sequential Animation Recording', () => {
  it('confirmPoseAndStep at t=0 after adjusting a bone preserves rest pose at 0s and commits Step 1 at +stepDuration', () => {
    let comp = makeCharacterComposite()
    // Người dùng dùng chuột trái xoay bắp tay phải lên -45 độ khi đầu phát đang ở 0.00s
    comp = applyRigAction(comp, {
      action: 'set-key',
      boneId: 'bone-arm-r',
      key: { time: 0, rotation: -45 }
    })

    // Nhấn Enter xác nhận vị trí bước 1 (stepDuration = 0.3s)
    const step1 = confirmPoseAndStep(comp, 0, 0.3)
    expect(step1.confirmedTime).toBeCloseTo(0.3, 3)
    expect(step1.nextTime).toBeCloseTo(0.6, 3)

    const rig1 = ensureRigClips(step1.composite.rig!).rig
    // Tại t = 0.00s, tay phải vẫn ở dáng nghỉ 0° để chuyển động mượt từ 0° -> -45°
    expect(sampleBonePose({ ...rig1, loop: false }, 'bone-arm-r', 0).rotation).toBeCloseTo(0, 2)
    // Tại t = 0.30s, tay phải đạt đúng góc -45° vừa xác nhận
    expect(sampleBonePose({ ...rig1, loop: false }, 'bone-arm-r', 0.3).rotation).toBeCloseTo(-45, 2)

    // Bước 2: tại nextTime = 0.60s, người dùng xoay tiếp cẳng tay phải -30° rồi nhấn Enter
    const comp2 = applyRigAction(step1.composite, {
      action: 'set-key',
      boneId: 'bone-forearm-r',
      key: { time: step1.nextTime, rotation: -30 }
    })
    const step2 = confirmPoseAndStep(comp2, step1.nextTime, 0.3)
    expect(step2.confirmedTime).toBeCloseTo(0.6, 3)
    expect(step2.nextTime).toBeCloseTo(0.9, 3)

    const rig2 = ensureRigClips(step2.composite.rig!).rig
    // Cẳng tay phải giữ nguyên 0° từ 0.00s -> 0.30s và chỉ xoay lên -30° từ 0.30s -> 0.60s
    expect(sampleBonePose({ ...rig2, loop: false }, 'bone-forearm-r', 0.3).rotation).toBeCloseTo(0, 2)
    expect(sampleBonePose({ ...rig2, loop: false }, 'bone-forearm-r', 0.6).rotation).toBeCloseTo(-30, 2)
  })

  it('ikChainIds stops before branching hub bones (torso and pelvis) when dragging limb bones', () => {
    const rig = makeCharacterComposite().rig!
    // Kéo bàn tay phải với chuỗi IK = 3: gồm bắp tay + cẳng tay + bàn tay, KHÔNG xoay ngực (bone-torso)
    expect(ikChainIds(rig, 'bone-hand-r', 3)).toEqual([
      'bone-arm-r',
      'bone-forearm-r',
      'bone-hand-r'
    ])
    // Kéo bắp tay phải với IK = 2: chỉ gồm bắp tay phải, KHÔNG kéo nghiêng ngực (bone-torso)
    expect(ikChainIds(rig, 'bone-arm-r', 2)).toEqual(['bone-arm-r'])
    // Kéo đùi phải với IK = 2: chỉ gồm đùi phải, KHÔNG kéo nghiêng hông (bone-pelvis)
    expect(ikChainIds(rig, 'bone-thigh-r', 2)).toEqual(['bone-thigh-r'])
  })

  it('startBoneDrag and boneDragAction automatically anchor t=0 rest pose when dragging at t > 0 on an unkeyed bone', () => {
    let comp = makeCharacterComposite()
    const rig = ensureRigClips(comp.rig!).rig
    const drag = startBoneDrag(rig, 'bone-arm-l', 0.5, false, 'rotate', { x: -80, y: -40 }, 2)
    const action = boneDragAction(drag, { x: -100, y: -90 }, false)
    comp = applyRigAction(comp, action)

    const updatedRig = ensureRigClips(comp.rig!).rig
    const armTrack = updatedRig.tracks['bone-arm-l'] ?? []
    expect(armTrack.some((k) => Math.abs(k.time) < 1e-4 && k.rotation === 0)).toBe(true)
    expect(armTrack.some((k) => Math.abs(k.time - 0.5) < 1e-4)).toBe(true)
  })

  it('Shift + Left-Click sequential realtime motion sketch anchors t=0 and records from startTime to endTime', () => {
    const comp = makeCharacterComposite()
    const rig = ensureRigClips(comp.rig!).rig
    // Giả sử động tác thứ 2 bắt đầu tại startTime = 0.8s trên xương bắp tay trái
    const anchor = createSketchAnchor(rig, 'bone-arm-l', 0.8, { x: -70, y: -40 }, 1)
    const samples = [
      { x: -70, y: -40, t: 0 },
      { x: -85, y: -70, t: 0.25 },
      { x: -95, y: -105, t: 0.5 }
    ]
    const res = applyMotionSketch(
      comp,
      anchor,
      samples,
      { mode: 'rotate', timing: 'live', duration: 0.5, loopBack: false, autoPlay: false, chain: 1 },
      0.8
    )
    expect(res.startTime).toBeCloseTo(0.8, 2)
    expect(res.endTime).toBeCloseTo(1.3, 2)
    const updatedRig = ensureRigClips(res.composite.rig!).rig
    // Phải giữ nguyên góc 0° từ 0.00s đến 0.80s trước khi thực hiện động tác thứ 2
    expect(sampleBonePose({ ...updatedRig, loop: false }, 'bone-arm-l', 0).rotation).toBeCloseTo(0, 1)
    expect(sampleBonePose({ ...updatedRig, loop: false }, 'bone-arm-l', 0.4).rotation).toBeCloseTo(0, 1)
  })
})
