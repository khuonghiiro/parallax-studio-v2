import { describe, expect, it } from 'vitest'
import type { LayerComposite } from './types'
import type { LayerBone } from '@shared/layerRig'
import { evaluateRig } from '../../engine/layerRig'
import {
  findCutoutLayerAtStroke,
  getBoundLayersForBone,
  inferHumanoidBoneRoles,
  resolveSpineParentForStroke,
  syncSpineStyleRigAndSlots
} from './spineRigWorkflow'
import { scaleAndMoveLayerWithBoundBones } from './workshopParts'
import { boneDragAction, startBoneDrag } from './workshopBoneDrag'
import { getBoneDistinctColor } from './WorkshopBoneItemSvg'
import { applyRigAction } from './workshopRig'

const USER_HAND_DRAWN_BONES: LayerBone[] = [
  { id: 'bone-6188cm0', name: 'Xương 1', x: -7, y: -158, length: 91, angle: -90 },
  { id: 'bone-5shpepy', name: 'Xương 2', parentId: 'bone-6188cm0', x: -10, y: -121, length: 241, angle: 90 },
  { id: 'bone-fwgs72r', name: 'Xương 3', parentId: 'bone-5shpepy', x: -56, y: -103, length: 59, angle: 108 },
  { id: 'bone-ke9urqr', name: 'Xương 4', parentId: 'bone-fwgs72r', x: -74, y: -47, length: 51, angle: 119 },
  { id: 'bone-br4nqcj', name: 'Xương 5', parentId: 'bone-ke9urqr', x: -98, y: -2, length: 36, angle: 132 },
  { id: 'bone-b87b4i9', name: 'Xương 6', parentId: 'bone-5shpepy', x: -43, y: 66, length: 74, angle: 90 },
  { id: 'bone-fb802p1', name: 'Xương 7', parentId: 'bone-b87b4i9', x: -43, y: 140, length: 65, angle: 90 },
  { id: 'bone-pnd20i2', name: 'Xương 8', parentId: 'bone-fb802p1', x: -43, y: 205, length: 42, angle: 90 },
  { id: 'bone-l3o2cxr', name: 'Xương 9', parentId: 'bone-5shpepy', x: 21, y: 74, length: 69, angle: 90 },
  { id: 'bone-13n76z2', name: 'Xương 10', parentId: 'bone-l3o2cxr', x: 21, y: 143, length: 65, angle: 90 },
  { id: 'bone-48x18v0', name: 'Xương 11', parentId: 'bone-13n76z2', x: 21, y: 208, length: 41, angle: 90 },
  { id: 'bone-nuu4pcj', name: 'Xương 12', parentId: 'bone-5shpepy', x: 31, y: -98, length: 68, angle: 71 },
  { id: 'bone-1qmvou0', name: 'Xương 13', parentId: 'bone-nuu4pcj', x: 53, y: -34, length: 40, angle: 63 },
  { id: 'bone-n3wacyp', name: 'Xương 14', parentId: 'bone-1qmvou0', x: 71, y: 2, length: 42, angle: 47 }
]

function createUserCutoutComposite(): LayerComposite {
  return {
    id: 'comp-user-test',
    name: 'nhân vật mới',
    category: 'character',
    description: 'Nhân vật cắt mảnh của user',
    width: 600,
    height: 860,
    layers: [
      {
        id: 'layer-1',
        name: 'Mảnh #1 (332×329)',
        x: -13,
        y: -234,
        z: 2,
        scale: 0.56,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'layer-2',
        name: 'Mảnh #2 (315×452)',
        x: -17,
        y: -246,
        z: 14,
        scale: 0.53,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'layer-3',
        name: 'Mảnh #3 (245×289)',
        x: -13,
        y: -210,
        z: 14,
        scale: 0.54,
        rotation: 0,
        opacity: 1,
        boneId: 'bone-6188cm0',
        bindingMode: 'rigid',
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'layer-4',
        name: 'Mảnh #4 (387×726)',
        x: -14,
        y: -6,
        z: -2,
        scale: 0.4,
        rotation: 0,
        opacity: 1,
        boneId: 'bone-5shpepy',
        bindingMode: 'rigid',
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'layer-5',
        name: 'Mảnh #5 (199×567)',
        x: -88,
        y: 25,
        z: 0,
        scale: 0.51,
        rotation: 0,
        opacity: 1,
        boneId: 'bone-fwgs72r',
        bindingMode: 'rigid',
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'layer-6',
        name: 'Mảnh #6 (199×566)',
        x: 63,
        y: 30,
        z: 0,
        scale: 0.51,
        rotation: 0,
        opacity: 1,
        boneId: 'bone-nuu4pcj',
        bindingMode: 'rigid',
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'layer-7',
        name: 'Mảnh #7 (141×411)',
        x: -45,
        y: 165,
        z: 0,
        scale: 0.54,
        rotation: 0,
        opacity: 1,
        boneId: 'bone-b87b4i9',
        bindingMode: 'rigid',
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'layer-8',
        name: 'Mảnh #8 (141×410)',
        x: 23,
        y: 166,
        z: 0,
        scale: 0.54,
        rotation: 0,
        opacity: 1,
        boneId: 'bone-l3o2cxr',
        bindingMode: 'rigid',
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'layer-9',
        name: 'Mảnh #9 (123×344)',
        x: 6,
        y: 62,
        z: -60,
        scale: 0.53,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'layer-10',
        name: 'Mảnh #10 (59×322)',
        x: 6,
        y: 15,
        z: -45,
        scale: 0.53,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      }
    ],
    rig: {
      bones: USER_HAND_DRAWN_BONES.map((b) => ({ ...b })),
      duration: 1.4,
      loop: true,
      tracks: {},
      activeClipId: 'clip-walk',
      clips: [
        { id: 'clip-walk', name: '🚶 Bước đi (Walk)', duration: 1.4, loop: true, tracks: {} },
        { id: 'clip-idle', name: '🧘 Đứng thở (Idle)', duration: 2.4, loop: true, tracks: {} }
      ]
    }
  }
}

describe('spineRigWorkflow (Spine 2D Trial style)', () => {
  it('infers all 14 hand-drawn generic bones ("Xương 1" .. "Xương 14") into exact anatomical roles', () => {
    const roles = inferHumanoidBoneRoles(USER_HAND_DRAWN_BONES)
    expect(roles.head).toBe('bone-6188cm0')
    expect(roles.torso).toBe('bone-5shpepy')
    expect(roles.armL).toBe('bone-fwgs72r')
    expect(roles.forearmL).toBe('bone-ke9urqr')
    expect(roles.handL).toBe('bone-br4nqcj')
    expect(roles.armR).toBe('bone-nuu4pcj')
    expect(roles.forearmR).toBe('bone-1qmvou0')
    expect(roles.handR).toBe('bone-n3wacyp')
    expect(roles.thighL).toBe('bone-b87b4i9')
    expect(roles.shinL).toBe('bone-fb802p1')
    expect(roles.footL).toBe('bone-pnd20i2')
    expect(roles.thighR).toBe('bone-l3o2cxr')
    expect(roles.shinR).toBe('bone-13n76z2')
    expect(roles.footR).toBe('bone-48x18v0')
  })

  it('auto-hits cutout layers and resolves Spine parent when drawing bones on the 2D canvas', () => {
    const comp = createUserCutoutComposite()
    // Drawing a bone on Left Arm (Mảnh #5) while Left Hand (bone-br4nqcj) or Right Hand (bone-n3wacyp) is focused:
    // If drawing on Right Arm (Mảnh #6) while Left Hand is selected, it should NOT parent Right Arm to Left Hand!
    // Instead, it should parent to the Torso Hub (bone-5shpepy).
    const handLeft = comp.rig!.bones.find((b) => b.id === 'bone-br4nqcj')!
    const unboundLayers = comp.layers.map((l) => (l.id === 'layer-6' ? { ...l, boneId: undefined } : l))
    const hitRightArm = findCutoutLayerAtStroke(unboundLayers, { x: 35, y: -90 }, { x: 55, y: -30 })
    expect(hitRightArm?.id).toBe('layer-6')

    const resolved = resolveSpineParentForStroke(
      comp.rig!.bones,
      unboundLayers,
      { x: 35, y: -90 },
      { x: 55, y: -30 },
      handLeft
    )
    expect(resolved.parentBone?.id).toBe('bone-5shpepy')
    expect(resolved.hitLayer?.id).toBe('layer-6')
  })

  it('synchronizes the user composite in 1 click (sync-spine-rig): normalizes root, binds all 10 layers + 14 bones, and rebuilds empty preset clips', () => {
    const comp = createUserCutoutComposite()
    const synced = applyRigAction(comp, { action: 'sync-spine-rig' })
    const rig = synced.rig!

    // 1. Root bone is Torso (bone-5shpepy), Head (bone-6188cm0) is child of Torso
    const torso = rig.bones.find((b) => b.id === 'bone-5shpepy')!
    const head = rig.bones.find((b) => b.id === 'bone-6188cm0')!
    expect(torso.parentId).toBeUndefined()
    expect(head.parentId).toBe('bone-5shpepy')

    // 2. Every single layer (all 10 layers) has a bound boneId
    for (const layer of synced.layers) {
      expect(layer.boneId).toBeTruthy()
    }
    // Hair layers #1, #2 bound to Head bone
    expect(synced.layers.find((l) => l.id === 'layer-1')?.boneId).toBe('bone-6188cm0')
    expect(synced.layers.find((l) => l.id === 'layer-2')?.boneId).toBe('bone-6188cm0')
    // Waist ornaments #9, #10 bound to Torso bone (not leg!)
    expect(synced.layers.find((l) => l.id === 'layer-9')?.boneId).toBe('bone-5shpepy')
    expect(synced.layers.find((l) => l.id === 'layer-10')?.boneId).toBe('bone-5shpepy')

    // 3. Multi-bone limbs (#5, #6, #7, #8) have extraBoneIds populated and soft mesh binding
    const leftArm = synced.layers.find((l) => l.id === 'layer-5')!
    expect(leftArm.bindingMode).toBe('soft')
    expect(leftArm.extraBoneIds).toEqual(['bone-ke9urqr', 'bone-br4nqcj'])

    const rightArm = synced.layers.find((l) => l.id === 'layer-6')!
    expect(rightArm.bindingMode).toBe('soft')
    expect(rightArm.extraBoneIds).toEqual(['bone-1qmvou0', 'bone-n3wacyp'])

    // 4. Every bone (all 14 bones) shows bound Slot/Mesh layers in getBoundLayersForBone
    for (const bone of rig.bones) {
      const bound = getBoundLayersForBone(bone.id, synced.layers, rig.bones)
      expect(bound.length).toBeGreaterThan(0)
    }

    // 5. Preset clips that had empty tracks are now populated with keyframe tracks
    const walkClip = rig.clips?.find((c) => c.id === 'clip-walk')!
    const idleClip = rig.clips?.find((c) => c.id === 'clip-idle')!
    expect(Object.keys(walkClip.tracks).length).toBeGreaterThanOrEqual(8)
    expect(Object.keys(idleClip.tracks).length).toBeGreaterThanOrEqual(5)
  })

  it('scales bound bones proportionally when scaling a layer (scaleAndMoveLayerWithBoundBones)', () => {
    const comp = applyRigAction(createUserCutoutComposite(), { action: 'sync-spine-rig' })
    const layer8Before = comp.layers.find((l) => l.id === 'layer-8')!
    const thighBefore = comp.rig!.bones.find((b) => b.id === 'bone-l3o2cxr')!
    const shinBefore = comp.rig!.bones.find((b) => b.id === 'bone-13n76z2')!
    const footBefore = comp.rig!.bones.find((b) => b.id === 'bone-48x18v0')!

    // Scale Right Leg (layer-8) by 2x
    const scaled = scaleAndMoveLayerWithBoundBones(comp, 'layer-8', { scale: layer8Before.scale * 2 })
    const thighAfter = scaled.rig!.bones.find((b) => b.id === 'bone-l3o2cxr')!
    const shinAfter = scaled.rig!.bones.find((b) => b.id === 'bone-13n76z2')!
    const footAfter = scaled.rig!.bones.find((b) => b.id === 'bone-48x18v0')!

    expect(thighAfter.length).toBeCloseTo(thighBefore.length * 2, 1)
    expect(shinAfter.length).toBeCloseTo(shinBefore.length * 2, 1)
    expect(footAfter.length).toBeCloseTo(footBefore.length * 2, 1)
  })

  it('records animated scaleX/scaleY keyframes via bone scale drag and propagates scale to child bones in evaluateRig', () => {
    const baseComp = applyRigAction(createUserCutoutComposite(), { action: 'sync-spine-rig' })
    const comp = applyRigAction(baseComp, {
      action: 'add-clip',
      clip: { id: 'clip-custom', name: 'Động tác Scale Chân Phải', duration: 2, loop: true, tracks: {} }
    })
    const rig = comp.rig!
    const thigh = rig.bones.find((b) => b.id === 'bone-l3o2cxr')!
    const shin = rig.bones.find((b) => b.id === 'bone-13n76z2')!

    // Start scale drag at distance 100px from thigh head and drag to 150px (1.5x scale) at t = 0.6s
    const drag = startBoneDrag(rig, thigh.id, 0.6, false, 'scale', { x: thigh.x, y: thigh.y + 100 })
    const action = boneDragAction(drag, { x: thigh.x, y: thigh.y + 150 }, false)
    const updated = applyRigAction(comp, action)

    // Evaluate at t = 0 (1.0x) vs t = 0.3 (~1.25x) vs t = 0.6 (1.5x)
    const tf0 = evaluateRig(updated.rig!, 0)
    const tfMid = evaluateRig(updated.rig!, 0.3)
    const tfEnd = evaluateRig(updated.rig!, 0.6)

    expect(tf0.get(thigh.id)?.scaleX).toBeCloseTo(1, 2)
    expect(tfMid.get(thigh.id)?.scaleX).toBeGreaterThan(1.15)
    expect(tfEnd.get(thigh.id)?.scaleX).toBeCloseTo(1.5, 2)
    expect(tfEnd.get(shin.id)?.scaleX).toBeCloseTo(1.5, 2)
    // Child knee joint (shin.y) scales its distance from parent hip joint (thigh.y) by 1.5x!
    const restKneeDist = shin.y - thigh.y
    const scaledKneeDist = (tfEnd.get(shin.id)?.y ?? 0) - (tfEnd.get(thigh.id)?.y ?? 0)
    expect(scaledKneeDist).toBeCloseTo(restKneeDist * 1.5, 1)
  })

  it('assigns distinct anatomical colors to bones via getBoneDistinctColor', () => {
    const comp = applyRigAction(createUserCutoutComposite(), { action: 'sync-spine-rig' })
    const bones = comp.rig!.bones
    const colors = bones.map((b) => getBoneDistinctColor(b, bones))
    expect(colors.every((c) => c.startsWith('#'))).toBe(true)
    // Left Leg and Right Leg have distinct colors
    const leftThighColor = getBoneDistinctColor(bones.find((b) => b.id === 'bone-b87b4i9')!, bones)
    const rightThighColor = getBoneDistinctColor(bones.find((b) => b.id === 'bone-l3o2cxr')!, bones)
    expect(leftThighColor).not.toBe(rightThighColor)
  })
})
