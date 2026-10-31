import { describe, expect, it } from 'vitest'
import { applyRigAction, emptyRig, findMirrorBoneId, validateRig } from './workshopRig'
import type { LayerComposite } from './types'
import { evaluateRig, sampleBonePose, transformRigLayer } from '../../engine/layerRig'
import { deformSkin } from '../../engine/layerSkinning'
import { bakeWorkshopRig } from './bakeWorkshopRig'
import { createImageLayer } from '../../project/factory'
import { BUILTIN_COMPOSITES } from './layerAssemblyDefaultComposites'
import { createHumanoidBones, generateIdleBreathe, generateWaveHand } from './workshopRigPresets'
import { confirmPoseAndStep, setStepRecordFrames, setStepRecordSeconds } from './workshopStepRecord'
import { weldConnectedLimbBones, withSymmetricBoneAction } from './mohoRigHelpers'

describe('workshopRig & layerRig engine', () => {
  const baseComposite: LayerComposite = {
    id: 'test-comp',
    name: 'Test Rig Composite',
    category: 'character',
    width: 600,
    height: 600,
    layers: [
      {
        id: 'l-head',
        name: 'Đầu',
        x: 0,
        y: -50,
        z: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'l-body',
        name: 'Thân',
        x: 0,
        y: 20,
        z: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      }
    ]
  }

  it('adds and updates bones and prevents cycles', () => {
    let comp = applyRigAction(baseComposite, {
      action: 'add-bone',
      bone: { id: 'bone-root', name: 'Root', x: 0, y: 0, length: 60, angle: -90 }
    })
    expect(comp.rig?.bones.length).toBe(1)

    comp = applyRigAction(comp, {
      action: 'add-bone',
      bone: { id: 'bone-head', name: 'Head', parentId: 'bone-root', x: 0, y: -60, length: 50, angle: -90 }
    })
    expect(comp.rig?.bones.length).toBe(2)

    // Cannot create cycle
    expect(() => {
      const invalid = structuredClone(comp)
      invalid.rig!.bones[0].parentId = 'bone-head'
      validateRig(invalid)
    }).toThrow(/cycle/)
  })

  it('binds a soft branch without moving the rest pose and can unbind it', () => {
    const original = applyRigAction(baseComposite, { action: 'apply-template', template: 'simple-chain' })
    const bound = applyRigAction(original, { action: 'bind', boneId: original.rig!.bones[0].id,
      layerIds: ['l-head'], mode: 'soft' })
    expect(bound.layers[0].bindingMode).toBe('soft')
    expect(bound.layers[0].x).toBe(original.layers[0].x)
    expect(bound.layers[0].y).toBe(original.layers[0].y)
    expect(original.layers[0].boneId).toBeUndefined()
    const unbound = applyRigAction(bound, { action: 'bind', layerIds: ['l-head'] })
    expect(unbound.layers[0].boneId).toBeUndefined()
    expect(unbound.layers[0].bindingMode).toBeUndefined()
  })

  it('applies humanoid preset template and generates walk cycle keys', () => {
    let comp = applyRigAction(baseComposite, {
      action: 'apply-template',
      template: 'humanoid'
    })
    expect(comp.rig?.bones.length).toBe(15)

    comp = applyRigAction(comp, {
      action: 'apply-preset-animation',
      preset: 'walk'
    })
    expect(comp.rig?.duration).toBe(1.6)
    expect(Object.keys(comp.rig?.tracks ?? {}).length).toBeGreaterThan(5)

    // Evaluate transforms at time 0.4s
    const transforms = evaluateRig(comp.rig!, 0.4)
    expect(transforms.size).toBe(15)
    const pelvis = transforms.get('bone-pelvis')
    expect(pelvis).toBeDefined()
    expect(Number.isFinite(pelvis!.x)).toBe(true)
    expect(Number.isFinite(pelvis!.rotation)).toBe(true)
  })

  it('binds layers and transforms layer position and rotation based on bone pose', () => {
    let comp = applyRigAction(baseComposite, {
      action: 'add-bone',
      bone: { id: 'b-pivot', name: 'Pivot', x: 0, y: 0, length: 50, angle: 0 }
    })
    comp = applyRigAction(comp, {
      action: 'bind',
      boneId: 'b-pivot',
      layerIds: ['l-head']
    })
    expect(comp.layers[0].boneId).toBe('b-pivot')

    comp = applyRigAction(comp, {
      action: 'set-key',
      boneId: 'b-pivot',
      key: { time: 0, x: 0, y: 0, rotation: 90, easing: 'smooth' }
    })

    const transforms = evaluateRig(comp.rig!, 0)
    const posed = transformRigLayer(comp.layers[0], transforms)

    // Rotating (0, -50) 90 degrees clockwise around (0,0) yields (50, 0)
    expect(posed.x).toBeCloseTo(50, 1)
    expect(posed.y).toBeCloseTo(0, 1)
    expect(posed.rotation).toBeCloseTo(90, 1)
  })

  it('bakes workshop rig into native ImageLayer keyframes while keeping lower body grounded during idle breathe', () => {
    let comp = applyRigAction(baseComposite, {
      action: 'apply-template',
      template: 'humanoid'
    })
    comp = applyRigAction(comp, {
      action: 'bind',
      boneId: 'bone-torso',
      layerIds: ['l-body']
    })
    comp = applyRigAction(comp, {
      action: 'apply-preset-animation',
      preset: 'idle'
    })

    // Hông và hai chân phải bám cố định mặt đất (không nhấp nhô bay bổng) khi đứng thở tại t = 1.2s
    const midTransforms = evaluateRig(comp.rig!, 1.2)
    const restTransforms = evaluateRig(comp.rig!, 0, true)
    for (const groundedId of ['bone-pelvis', 'bone-thigh-l', 'bone-thigh-r', 'bone-shin-l', 'bone-shin-r', 'bone-foot-l', 'bone-foot-r']) {
      expect(midTransforms.get(groundedId)?.y).toBeCloseTo(restTransforms.get(groundedId)!.y, 3)
      expect(midTransforms.get(groundedId)?.rotation).toBeCloseTo(0, 3)
    }

    const compMeta = { name: 'Test Comp', background: '#000000', width: 1920, height: 1080, fps: 30, duration: 10 }
    const assetMeta = { id: 'asset-1', name: 'body.png', kind: 'image' as const, mime: 'image/png', width: 200, height: 200, path: 'assets/body.png', format: 'png' as const }
    const imageLayer = createImageLayer(assetMeta, compMeta, 0)
    bakeWorkshopRig(imageLayer, comp.layers[1], comp, 2.4, 30, 1.0, [0, 0, 0])

    expect(imageLayer.transform.position.keyframes.length).toBeGreaterThan(30)
    expect(imageLayer.transform.rotation.keyframes.length).toBeGreaterThan(30)
    expect(imageLayer.transform.position.value).toBeDefined()
  })

  it('evaluates soft 2d mesh skinning deformation properly without NaN or failure', () => {
    const chainComp = applyRigAction(baseComposite, { action: 'apply-template', template: 'simple-chain' })
    const bound = applyRigAction(chainComp, {
      action: 'bind',
      boneId: chainComp.rig!.bones[0].id,
      layerIds: ['l-head'],
      mode: 'soft'
    })
    expect(bound.layers[0].boneId).toBe(chainComp.rig!.bones[0].id)
    expect(bound.layers[0].bindingMode).toBe('soft')

    const restPositions = new Float32Array([
      -50, 50, 0,
      50, 50, 0,
      0, -50, 0
    ])

    // In rest pose
    const restSkin = deformSkin(restPositions, bound.layers[0], bound.rig!, 0)
    expect(restSkin.length).toBe(9)
    for (let i = 0; i < restSkin.length; i++) {
      expect(Number.isFinite(restSkin[i])).toBe(true)
    }

    // Set animation keyframe on the root bone to rotate it 45 deg
    const animatedComp = applyRigAction(bound, {
      action: 'set-key',
      boneId: chainComp.rig!.bones[0].id,
      key: { time: 0.5, x: 0, y: 0, rotation: 45, easing: 'smooth' }
    })

    const posedSkin = deformSkin(restPositions, animatedComp.layers[0], animatedComp.rig!, 0.5)
    expect(posedSkin.length).toBe(9)
    for (let i = 0; i < posedSkin.length; i++) {
      expect(Number.isFinite(posedSkin[i])).toBe(true)
    }
  })

  it('manages multiple animation clips and syncs active tracks', () => {
    let comp = applyRigAction(baseComposite, { action: 'apply-template', template: 'humanoid' })
    comp = applyRigAction(comp, { action: 'apply-preset-animation', preset: 'walk' })

    expect(comp.rig?.clips).toBeDefined()
    expect(comp.rig?.clips?.length).toBeGreaterThanOrEqual(1)
    const initialClipId = comp.rig?.activeClipId

    // Tạo clip mới
    comp = applyRigAction(comp, {
      action: 'add-clip',
      clip: {
        id: 'clip-custom-wave',
        name: 'Vẫy tay mới',
        duration: 2.0,
        loop: true,
        tracks: {
          'bone-arm-r': [{ time: 0, x: 0, y: 0, rotation: 0, easing: 'smooth' }]
        }
      }
    })
    expect(comp.rig?.clips?.length).toBe(2)
    expect(comp.rig?.activeClipId).toBe('clip-custom-wave')
    expect(comp.rig?.tracks['bone-arm-r']).toBeDefined()

    // Đổi tên clip
    comp = applyRigAction(comp, {
      action: 'rename-clip',
      clipId: 'clip-custom-wave',
      name: 'Vẫy tay đặc biệt'
    })
    expect(comp.rig?.clips?.find((c) => c.id === 'clip-custom-wave')?.name).toBe('Vẫy tay đặc biệt')

    // Nhân bản clip
    comp = applyRigAction(comp, {
      action: 'duplicate-clip',
      clipId: 'clip-custom-wave'
    })
    expect(comp.rig?.clips?.length).toBe(3)
    const dupeClip = comp.rig?.clips?.find((c) => c.name.includes('(Bản sao)'))
    expect(dupeClip).toBeDefined()

    // Chuyển lại clip ban đầu
    if (initialClipId) {
      comp = applyRigAction(comp, { action: 'switch-clip', clipId: initialClipId })
      expect(comp.rig?.activeClipId).toBe(initialClipId)
    }

    // Xóa clip
    comp = applyRigAction(comp, { action: 'delete-clip', clipId: 'clip-custom-wave' })
    expect(comp.rig?.clips?.some((c) => c.id === 'clip-custom-wave')).toBe(false)
  })

  it('inherits and retargets animation clip between armatures with different bone proportions', () => {
    // 1. Armature nguồn (Humanoid chuẩn)
    let srcComp = applyRigAction(baseComposite, { action: 'apply-template', template: 'humanoid' })
    srcComp = applyRigAction(srcComp, { action: 'apply-preset-animation', preset: 'wave' })
    const srcClip = srcComp.rig!.clips![0]
    const srcBones = srcComp.rig!.bones

    // 2. Armature đích (Nhân vật mới có tỉ lệ xương lớn hơn và tên tiếng Việt)
    const tgtComposite: LayerComposite = {
      ...baseComposite,
      id: 'target-hero',
      rig: {
        bones: [
          { id: 'b-pelvis', name: 'Khung xương hông chính', x: 0, y: 0, length: 70, angle: -90 },
          { id: 'b-torso', name: 'Ngực áo giáp', parentId: 'b-pelvis', x: 0, y: -70, length: 90, angle: -90 },
          { id: 'b-head', name: 'Đầu đội mũ', parentId: 'b-torso', x: 0, y: -90, length: 75, angle: -90 },
          { id: 'b-arm-r', name: 'Bắp tay phải giáp', parentId: 'b-torso', x: 45, y: -80, length: 65, angle: 70 },
          { id: 'b-forearm-r', name: 'Cẳng tay phải', parentId: 'b-arm-r', x: 50, y: 0, length: 65, angle: 0 }
        ],
        duration: 2.0,
        loop: true,
        tracks: {},
        clips: [],
        activeClipId: undefined
      }
    }

    // Áp dụng inherit-clip
    const retargetedComp = applyRigAction(tgtComposite, {
      action: 'inherit-clip',
      sourceClip: srcClip,
      sourceBones: srcBones,
      clipName: 'Động tác vẫy tay kế thừa'
    })

    expect(retargetedComp.rig?.clips?.length).toBe(1)
    const newClip = retargetedComp.rig!.clips![0]
    expect(newClip.name).toBe('Động tác vẫy tay kế thừa')
    expect(retargetedComp.rig?.activeClipId).toBe(newClip.id)

    // Các xương tay đích phải nhận được keyframe từ xương nguồn tương ứng
    expect(newClip.tracks['b-arm-r']).toBeDefined()
    expect(newClip.tracks['b-arm-r'].length).toBeGreaterThan(0)
    for (const kf of newClip.tracks['b-arm-r']) {
      expect(Number.isFinite(kf.rotation)).toBe(true)
      expect(Number.isFinite(kf.x)).toBe(true)
      expect(Number.isFinite(kf.y)).toBe(true)
    }
  })

  it('evaluates wave clip pose for humanoid composite', () => {
    const bones = createHumanoidBones()
    const waveTracks = generateWaveHand(bones, 1.8)
    const waveRig = {
      bones,
      tracks: waveTracks,
      duration: 1.8,
      loop: true,
      activeClipId: 'clip-wave',
      clips: [{ id: 'clip-wave', name: 'Wave', duration: 1.8, loop: true, presetKey: 'wave', tracks: waveTracks }]
    }
    const transforms = evaluateRig(waveRig, 0.8)
    const armTransform = transforms.get('bone-arm-r')
    expect(armTransform).toBeDefined()
    expect(Math.abs(armTransform!.rotation)).toBeGreaterThan(30)
  })

  it('supports set-pose batch keyframing across multiple bones with Moho easing', () => {
    let comp = applyRigAction(baseComposite, { action: 'apply-template', template: 'humanoid' })
    comp = applyRigAction(comp, {
      action: 'set-pose',
      time: 0.5,
      easing: 'ease-in-out',
      poses: [
        { boneId: 'bone-arm-l', rotation: 35, scaleX: 1.1, scaleY: 0.9 },
        { boneId: 'bone-arm-r', rotation: -40, scaleX: 1.2, scaleY: 1.2 }
      ]
    })

    const armL = comp.rig?.tracks['bone-arm-l']?.find((k) => Math.abs(k.time - 0.5) < 0.001)
    const armR = comp.rig?.tracks['bone-arm-r']?.find((k) => Math.abs(k.time - 0.5) < 0.001)

    expect(armL).toBeDefined()
    expect(armL?.rotation).toBe(35)
    expect(armL?.scaleX).toBe(1.1)
    expect(armL?.easing).toBe('ease-in-out')

    expect(armR).toBeDefined()
    expect(armR?.rotation).toBe(-40)
    expect(armR?.scaleX).toBe(1.2)
  })

  it('mirrors character poses symmetrically between left and right limb bones', () => {
    let comp = applyRigAction(baseComposite, { action: 'apply-template', template: 'humanoid' })
    // Đặt pose ban đầu cho tay trái và tay phải
    comp = applyRigAction(comp, {
      action: 'set-pose',
      time: 1.0,
      poses: [
        { boneId: 'bone-arm-l', rotation: 45, x: 10, y: 5 },
        { boneId: 'bone-arm-r', rotation: -20, x: -5, y: 15 }
      ]
    })

    // Thực hiện lật đối xứng dáng
    comp = applyRigAction(comp, { action: 'mirror-pose', time: 1.0 })

    const mirroredL = comp.rig?.tracks['bone-arm-l']?.find((k) => Math.abs(k.time - 1.0) < 0.001)
    const mirroredR = comp.rig?.tracks['bone-arm-r']?.find((k) => Math.abs(k.time - 1.0) < 0.001)

    // Tay trái nhận giá trị đối xứng của tay phải (-(-20) = 20 độ, -(-5) = 5 px, y = 15 px)
    expect(mirroredL).toBeDefined()
    expect(mirroredL?.rotation).toBe(20)
    expect(mirroredL?.x).toBe(5)
    expect(mirroredL?.y).toBe(15)

    // Tay phải nhận giá trị đối xứng của tay trái (-45 độ, -10 px, y = 5 px)
    expect(mirroredR).toBeDefined()
    expect(mirroredR?.rotation).toBe(-45)
    expect(mirroredR?.x).toBe(-10)
    expect(mirroredR?.y).toBe(5)
  })

  it('clears animation tracks globally and clears individual bone tracks', () => {
    let comp = applyRigAction(baseComposite, { action: 'apply-template', template: 'humanoid' })
    expect(Object.keys(comp.rig?.tracks || {}).length).toBeGreaterThan(0)

    // Xóa riêng track của một xương
    comp = applyRigAction(comp, { action: 'clear-bone-track', boneId: 'bone-pelvis' })
    expect(comp.rig?.tracks['bone-pelvis']).toBeUndefined()
    expect(Object.keys(comp.rig?.tracks || {}).length).toBeGreaterThan(0)

    // Xóa sạch toàn bộ animation
    comp = applyRigAction(comp, { action: 'clear-animation' })
    expect(Object.keys(comp.rig?.tracks || {}).length).toBe(0)
    expect(comp.rig?.clips?.[0].tracks).toEqual({})
  })

  it('keeps lower body planted on the ground during idle breathing while upper body breathes', () => {
    const bones = createHumanoidBones()
    const tracks = generateIdleBreathe(bones, 2.4, 'front')
    for (const lowerId of ['bone-pelvis', 'bone-thigh-l', 'bone-thigh-r', 'bone-shin-l', 'bone-shin-r', 'bone-foot-l', 'bone-foot-r']) {
      for (const kf of tracks[lowerId] ?? []) {
        expect(kf.y).toBe(0)
        expect(kf.rotation).toBe(0)
      }
    }
    const torsoYs = (tracks['bone-torso'] ?? []).map((k) => k.y)
    expect(torsoYs.some((y) => y < 0)).toBe(true)
  })

  it('supports Moho-style move-keys (1.0s -> 0.5s keeping 2.0s untouched & conflict-free shifts) and delete-keys', () => {
    let comp = applyRigAction(baseComposite, { action: 'apply-template', template: 'humanoid' })
    comp = applyRigAction(comp, { action: 'clear-animation' })
    comp = applyRigAction(comp, { action: 'settings', duration: 3.0 })

    for (const t of [0, 1.0, 2.0]) {
      comp = applyRigAction(comp, {
        action: 'set-pose',
        time: t,
        poses: [
          { boneId: 'bone-arm-l', rotation: t * 30 },
          { boneId: 'bone-arm-r', rotation: -t * 25 }
        ]
      })
    }

    // Retime key 1.0s -> 0.5s while keeping 0.0s and 2.0s intact
    comp = applyRigAction(comp, {
      action: 'move-keys',
      overwrite: true,
      moves: [
        { boneId: 'bone-arm-l', time: 1.0, targetTime: 0.5 },
        { boneId: 'bone-arm-r', time: 1.0, targetTime: 0.5 }
      ]
    })

    expect(comp.rig?.tracks['bone-arm-l']?.map((k) => k.time)).toEqual([0, 0.5, 2.0])
    expect(comp.rig?.tracks['bone-arm-r']?.map((k) => k.time)).toEqual([0, 0.5, 2.0])

    // Conflict-safe shift of adjacent keys [0.5, 2.0] -> [2.0, 2.5]
    comp = applyRigAction(comp, {
      action: 'move-keys',
      moves: [
        { boneId: 'bone-arm-l', time: 0.5, targetTime: 2.0 },
        { boneId: 'bone-arm-l', time: 2.0, targetTime: 2.5 }
      ]
    })
    expect(comp.rig?.tracks['bone-arm-l']?.map((k) => k.time)).toEqual([0, 2.0, 2.5])

    // Batch delete-keys across multiple bones
    comp = applyRigAction(comp, {
      action: 'delete-keys',
      keys: [
        { boneId: 'bone-arm-l', time: 2.0 },
        { boneId: 'bone-arm-r', time: 0.5 }
      ]
    })
    expect(comp.rig?.tracks['bone-arm-l']?.map((k) => k.time)).toEqual([0, 2.5])
    expect(comp.rig?.tracks['bone-arm-r']?.map((k) => k.time)).toEqual([0, 2.0])
  })

  it('retains posed posture in confirmPoseAndStep (Enter) at nextTime even when later keys exist', () => {
    let comp = applyRigAction(baseComposite, { action: 'apply-template', template: 'humanoid' })
    comp = applyRigAction(comp, { action: 'clear-animation' })
    comp = applyRigAction(comp, { action: 'settings', duration: 2.0, fps: 24 })

    // Pose thigh-l at t=0.0s (45 deg) while a later key exists at t=2.0s (0 deg)
    comp = applyRigAction(comp, {
      action: 'set-key',
      boneId: 'bone-thigh-l',
      key: { time: 0, rotation: 45 }
    })
    comp = applyRigAction(comp, {
      action: 'set-key',
      boneId: 'bone-thigh-l',
      key: { time: 2.0, rotation: 0 }
    })

    setStepRecordSeconds(0.5, 24)
    const stepped = confirmPoseAndStep(comp, 0)
    expect(stepped.nextTime).toBeCloseTo(0.5, 3)

    // At nextTime (0.5s), thigh-l must hold 45 deg across both 2D & 3D instead of snapping back toward 0 deg
    const sampled = sampleBonePose({ ...stepped.composite.rig!, loop: false }, 'bone-thigh-l', stepped.nextTime)
    expect(sampled.rotation).toBeCloseTo(45, 2)

    // Also supports +1F stepping
    setStepRecordFrames(1, 24)
    const oneFrameStep = confirmPoseAndStep(stepped.composite, stepped.nextTime)
    expect(oneFrameStep.nextTime).toBeCloseTo(0.5 + 1 / 24, 3)
  })

  it('mirrors bone edits across X=0 with withSymmetricBoneAction and welds single-child drifted limbs', () => {
    const bones = createHumanoidBones()
    const symmetric = withSymmetricBoneAction(
      bones,
      { action: 'update-bone' as const, boneId: 'bone-arm-l', patch: { x: -52, y: -96, length: 78, angle: 110, strength: 1.4 } },
      true,
      findMirrorBoneId
    )
    expect(symmetric.action).toBe('update-bones')
    if (symmetric.action === 'update-bones') {
      const twin = symmetric.patches.find((p) => p.boneId === 'bone-arm-r')
      expect(twin).toBeDefined()
      expect(twin?.patch.x).toBe(52)
      expect(twin?.patch.y).toBe(-96)
      expect(twin?.patch.length).toBe(78)
      expect(twin?.patch.angle).toBe(70)
      expect(twin?.patch.strength).toBe(1.4)
    }

    // Drift forearm-r 50px away from arm-r tail and verify weldConnectedLimbBones snaps arm-r tail onto forearm-r head
    const drifted = bones.map((b) => (b.id === 'bone-forearm-r' ? { ...b, x: b.x + 35, y: b.y + 20 } : b))
    const welded = weldConnectedLimbBones(drifted, 0.45)
    const armR = welded.find((b) => b.id === 'bone-arm-r')!
    const forearmR = welded.find((b) => b.id === 'bone-forearm-r')!
    const tailX = armR.x + Math.cos((armR.angle * Math.PI) / 180) * armR.length
    const tailY = armR.y + Math.sin((armR.angle * Math.PI) / 180) * armR.length
    expect(Math.hypot(tailX - forearmR.x, tailY - forearmR.y)).toBeLessThan(0.5)
  })
})
