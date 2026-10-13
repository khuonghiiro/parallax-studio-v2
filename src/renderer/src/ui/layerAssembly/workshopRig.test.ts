import { describe, expect, it } from 'vitest'
import { applyRigAction, emptyRig, validateRig } from './workshopRig'
import type { LayerComposite } from './types'
import { evaluateRig, transformRigLayer } from '../../engine/layerRig'
import { deformSkin } from '../../engine/layerSkinning'
import { bakeWorkshopRig } from './bakeWorkshopRig'
import { createImageLayer } from '../../project/factory'
import { BUILTIN_COMPOSITES } from './layerAssemblyDefaultComposites'
import { createHumanoidBones, generateWaveHand } from './workshopRigPresets'

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

  it('bakes workshop rig into native ImageLayer keyframes', () => {
    let comp = applyRigAction(baseComposite, {
      action: 'apply-template',
      template: 'humanoid'
    })
    comp = applyRigAction(comp, {
      action: 'bind',
      boneId: 'bone-pelvis',
      layerIds: ['l-body']
    })
    comp = applyRigAction(comp, {
      action: 'apply-preset-animation',
      preset: 'idle'
    })

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
})
