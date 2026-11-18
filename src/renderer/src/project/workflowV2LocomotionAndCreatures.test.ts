import { describe, expect, it } from 'vitest'
import type { ImageLayer, Project, WorkflowGraph } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { createImageLayer, createProject, createShot } from './factory'
import {
  attachLogicNodeToLayerV2,
  bakeClusterRigPresetToScene,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  v2ClusterLockId
} from './workflowV2Engine'
import { SWORD_HUNTER_25D_COMPOSITE } from '../ui/layerAssembly/action25dComposites'
import { generateRunCycle, generateWalkCycle } from '../ui/layerAssembly/workshopWalkCycle'
import {
  createMonsterBones,
  generateCombatCombo,
  generateDodgeCounter,
  generateHitRecoil,
  generateMonsterPounce
} from '../ui/layerAssembly/workshopCombatAndCreaturePresets'

function mkPartLayer(
  proj: Project,
  shotId: string,
  instId: string,
  compId: string,
  compName: string,
  partId: string,
  offX: number,
  offY: number,
  zOrder: number,
  isRoot = false
): ImageLayer {
  const layer = createImageLayer(
    { id: `asset-${instId}-${partId}`, name: partId, kind: 'image', mime: 'image/png', width: 120, height: 140 },
    proj.comp,
    100 - zOrder * 0.05,
    shotId
  )
  layer.id = `${instId}-${partId}`
  layer.name = `[${compName}] ${partId}`
  layer.inPoint = 0
  layer.outPoint = proj.comp.duration
  layer.transform.position.value = [offX, offY, 100 - zOrder * 0.05]
  layer.transform.scale.value = [0.8, 0.8, 1]
  layer.composite = {
    instanceId: instId,
    compositeId: compId,
    compositeName: compName,
    isRoot,
    lockedGroup: true,
    centerPosition: [0, 0, 100],
    rootOffset: [offX, offY, -zOrder * 0.05],
    sourceLayerId: partId
  }
  return layer
}

function createHumanoidClusterProject(): { proj: Project; instId: string; byPart: Record<string, ImageLayer> } {
  const proj = createProject()
  proj.comp.duration = 6
  const shot = createShot('Test Shot')
  proj.shots.push(shot)
  const instId = 'inst-hero-test'
  const parts: [string, number, number, number, boolean?][] = [
    ['pelvis', 0, 0, 2, true],
    ['torso', 0, 48, 3],
    ['head', 0, 112, 4],
    ['arm-l', -28, 56, 0],
    ['forearm-l', -30, 12, 1],
    ['arm-r', 28, 56, 5],
    ['forearm-r', 30, 12, 6],
    ['thigh-l', -20, -28, 0],
    ['shin-l', -20, -84, 1],
    ['thigh-r', 20, -28, 3],
    ['shin-r', 20, -84, 4]
  ]
  const byPart: Record<string, ImageLayer> = {}
  for (const [id, x, y, z, isRoot] of parts) {
    const l = mkPartLayer(proj, shot.id, instId, 'custom-hero-test', 'Kiếm Khách Test', id, x, y, z, Boolean(isRoot))
    proj.layers.push(l)
    byPart[id] = l
  }
  proj.workflow = syncWorkflowV2Graph(proj, proj.workflow as WorkflowGraph | undefined)
  return { proj, instId, byPart }
}

function attachAndSync(
  proj: Project,
  targetNodeId: string,
  category: 'anim_fx' | 'action' | 'rig_bone',
  presetId: string,
  params: Record<string, unknown>
): string {
  const res = attachLogicNodeToLayerV2(proj.workflow!, targetNodeId, category, presetId, params)
  proj.workflow = syncWorkflowV2Graph(proj, res.workflow)
  const node = proj.workflow.nodes.find((n) => n.id === res.createdNodeId)!
  syncWorkflowV2NodeToProject(proj, node, params)
  return node.id
}

describe('Workflow V2 Locomotion + Creature & Monster Rigs', () => {
  it('cộng gộp quỹ đạo BBox + FK Rig đồng bộ bất kể thứ tự gắn Node (không tụt/rơi cẳng chân hay cẳng tay)', () => {
    for (const order of ['rig-first', 'bbox-first'] as const) {
      const { proj, instId, byPart } = createHumanoidClusterProject()
      const lockId = v2ClusterLockId(instId)
      const bboxParams = {
        motionMode: 'bbox',
        actionPreset: 'bbox_target',
        bboxPathType: 'shortest',
        bboxTargetX: 240,
        bboxTargetY: 0,
        bboxTargetScalePct: 100,
        timeStart: 0,
        timeEnd: 3
      }
      const rigParams = {
        animMode: 'rig_clip',
        rigActionPreset: 'walk',
        timeStart: 0,
        timeEnd: 3,
        intensity: 1
      }

      if (order === 'rig-first') {
        const animId = attachAndSync(proj, lockId, 'anim_fx', 'v2:anim_fx:rig_walk', rigParams)
        attachAndSync(proj, animId, 'action', 'v2:action:bbox_target', bboxParams)
      } else {
        const motId = attachAndSync(proj, lockId, 'action', 'v2:action:bbox_target', bboxParams)
        attachAndSync(proj, motId, 'anim_fx', 'v2:anim_fx:rig_walk', rigParams)
      }

      const pelvis = byPart.pelvis
      const thighL = byPart['thigh-l']
      const shinL = byPart['shin-l']
      const shinR = byPart['shin-r']
      const armR = byPart['arm-r']
      const forearmR = byPart['forearm-r']

      expect(Math.abs(evaluate(pelvis.transform.position, 0)[0] - 0)).toBeLessThan(12)
      expect(Math.abs(evaluate(pelvis.transform.position, 3)[0] - 240)).toBeLessThan(12)
      expect(pelvis.transform.position.keyframes.filter((k) => k.id.includes('-bboxmot-')).length).toBeGreaterThanOrEqual(2)

      for (const t of [0, 0.8, 1.6, 2.4, 3.0]) {
        const px = evaluate(pelvis.transform.position, t)[0]
        const py = evaluate(pelvis.transform.position, t)[1]
        const tl = evaluate(thighL.transform.position, t)
        const sl = evaluate(shinL.transform.position, t)
        const sr = evaluate(shinR.transform.position, t)
        const ar = evaluate(armR.transform.position, t)
        const fr = evaluate(forearmR.transform.position, t)

        expect(Math.abs(sl[0] - px)).toBeLessThan(85)
        expect(Math.abs(sr[0] - px)).toBeLessThan(85)
        expect(Math.hypot(sl[0] - tl[0], sl[1] - tl[1])).toBeLessThan(85)
        expect(Math.hypot(fr[0] - ar[0], fr[1] - ar[1])).toBeLessThan(70)
        expect(Math.hypot(sl[0] - px, sl[1] - py)).toBeLessThan(150)
      }

      expect(shinL.transform.rotation.keyframes.length).toBeGreaterThan(2)
      expect(forearmR.transform.rotation.keyframes.length).toBeGreaterThan(2)
    }
  })

  it('bảo toàn quỹ đạo khi nối tiếp clip Quái vật (`monster_prowl` → `monster_roar`) và cử động hàm dưới', () => {
    const proj = createProject()
    proj.comp.duration = 6
    const shot = createShot('Monster Shot')
    proj.shots.push(shot)
    const instId = 'inst-monster-test'
    const parts: [string, number, number, number, boolean?][] = [
      ['pelvis', 0, 0, 2, true],
      ['torso', -10, 44, 3],
      ['head', -45, 76, 4],
      ['jaw', -62, 62, 5],
      ['arm-l', -42, 34, 1],
      ['forearm-l', -70, 2, 0],
      ['arm-r', 12, 34, 6],
      ['forearm-r', -18, 2, 7],
      ['thigh-l', -20, -24, 1],
      ['shin-l', -22, -74, 0],
      ['thigh-r', 20, -24, 5],
      ['shin-r', 22, -74, 6],
      ['tail', 55, -6, 0]
    ]
    const byPart: Record<string, ImageLayer> = {}
    for (const [id, x, y, z, isRoot] of parts) {
      const l = mkPartLayer(proj, shot.id, instId, 'custom-monster-test', 'Quái Thú Test', id, x, y, z, Boolean(isRoot))
      proj.layers.push(l)
      byPart[id] = l
    }
    proj.workflow = syncWorkflowV2Graph(proj, proj.workflow as WorkflowGraph | undefined)
    const lockId = v2ClusterLockId(instId)

    const boneId = attachAndSync(proj, lockId, 'rig_bone', 'v2:rig_bone:monster_14', { rigBonePreset: 'monster_14' })
    const bboxId = attachAndSync(proj, boneId, 'action', 'v2:action:bbox_target', {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: -270,
      bboxTargetY: 0,
      bboxTargetScalePct: 100,
      timeStart: 0,
      timeEnd: 4
    })
    const prowlId = attachAndSync(proj, bboxId, 'anim_fx', 'v2:anim_fx:rig_monster_prowl', {
      animMode: 'rig_clip',
      rigActionPreset: 'monster_prowl',
      timeStart: 0,
      timeEnd: 2
    })
    attachAndSync(proj, prowlId, 'anim_fx', 'v2:anim_fx:rig_monster_roar', {
      animMode: 'rig_clip',
      rigActionPreset: 'monster_roar',
      timeStart: 2,
      timeEnd: 4
    })

    const jaw = byPart.jaw
    const endJawX = evaluate(jaw.transform.position, 4)[0]
    expect(endJawX).toBeLessThan(-240)
    const maxJawOpenRot = Math.max(
      ...[2.3, 2.7, 3.1, 3.5].map((t) => Math.abs(evaluate(jaw.transform.rotation, t)[2]))
    )
    expect(maxJawOpenRot).toBeGreaterThan(8)
  })

  it('sinh keyframe hành động cho Thú 4 chân (`quadruped_gallop`), Chim (`wing_flap`) và Chiến đấu (`combat`, `hit_recoil`)', () => {
    const wolfProj = createProject()
    wolfProj.comp.duration = 4
    const shotW = createShot('Wolf')
    wolfProj.shots.push(shotW)
    const wolfId = 'inst-wolf-test'
    const wolfParts: [string, number, number, number, boolean?][] = [
      ['pelvis', -28, 0, 2, true],
      ['torso', 20, 6, 3],
      ['head', 64, 34, 4],
      ['jaw', 74, 24, 3],
      ['leg-fl-thigh', 34, -22, 5],
      ['leg-fl-shin', 38, -60, 6],
      ['leg-bl-thigh', -34, -22, 4],
      ['leg-bl-shin', -38, -60, 5],
      ['tail', -64, 8, 1]
    ]
    const wLayers: Record<string, ImageLayer> = {}
    for (const [id, x, y, z, isRoot] of wolfParts) {
      const l = mkPartLayer(wolfProj, shotW.id, wolfId, 'custom-wolf', 'Linh Lang', id, x, y, z, Boolean(isRoot))
      wolfProj.layers.push(l)
      wLayers[id] = l
    }
    const wolfBaked = bakeClusterRigPresetToScene(wolfProj, wolfId, 'quadruped_gallop', { timeStart: 0, timeEnd: 2 })
    expect(wolfBaked).toBeGreaterThanOrEqual(5)
    expect(wLayers['leg-fl-thigh'].transform.rotation.keyframes.length).toBeGreaterThan(3)
    expect(wLayers['leg-bl-thigh'].transform.rotation.keyframes.length).toBeGreaterThan(3)

    const birdProj = createProject()
    birdProj.comp.duration = 4
    const shotB = createShot('Bird')
    birdProj.shots.push(shotB)
    const birdId = 'inst-bird-test'
    const birdBody = mkPartLayer(birdProj, shotB.id, birdId, 'custom-bird', 'Linh Ưng', 'bird-body', 0, 0, 2, true)
    const wingL = mkPartLayer(birdProj, shotB.id, birdId, 'custom-bird', 'Linh Ưng', 'wing-l', -18, 14, 4)
    const wingR = mkPartLayer(birdProj, shotB.id, birdId, 'custom-bird', 'Linh Ưng', 'wing-r', 12, 16, 0)
    birdProj.layers.push(birdBody, wingL, wingR)
    const birdBaked = bakeClusterRigPresetToScene(birdProj, birdId, 'wing_flap', { timeStart: 0, timeEnd: 2 })
    expect(birdBaked).toBeGreaterThanOrEqual(2)
    expect(wingL.transform.rotation.keyframes.length).toBeGreaterThan(3)

    const { proj: heroProj, instId: heroId, byPart } = createHumanoidClusterProject()
    expect(bakeClusterRigPresetToScene(heroProj, heroId, 'combat', { timeStart: 0, timeEnd: 2 })).toBeGreaterThanOrEqual(6)
    expect(byPart['forearm-r'].transform.rotation.keyframes.length).toBeGreaterThan(3)
    expect(bakeClusterRigPresetToScene(heroProj, heroId, 'hit_recoil', { timeStart: 2, timeEnd: 3.5 })).toBeGreaterThanOrEqual(5)
  })

  it('chu kỳ Walk/Run khử sạch lỗi giật khớp gối (C1 liên tục), có sóng áo choàng và nhịp Hitstop Donghua khi chiến đấu', () => {
    const heroBones = SWORD_HUNTER_25D_COMPOSITE.rig!.bones
    for (const angle of ['side', 'diagonal'] as const) {
      const walk = generateWalkCycle(heroBones, 1.6, angle)
      for (const shinId of ['bone-shin-l', 'bone-shin-r']) {
        const keys = walk[shinId]
        expect(keys.length).toBe(65)
        for (let i = 1; i < keys.length; i++) {
          expect(Math.abs(keys[i].rotation - keys[i - 1].rotation)).toBeLessThan(6.5)
        }
      }
      expect(walk['bone-cape']?.some((k) => Math.abs(k.rotation) > 8)).toBe(true)
    }

    const run = generateRunCycle(heroBones, 1.0, 'side')
    for (const shinId of ['bone-shin-l', 'bone-shin-r']) {
      const keys = run[shinId]
      for (let i = 1; i < keys.length; i++) {
        expect(Math.abs(keys[i].rotation - keys[i - 1].rotation)).toBeLessThan(9.5)
      }
    }
    expect(run['bone-cape']?.some((k) => Math.abs(k.rotation) > 15)).toBe(true)

    const hasHitstopPlateau = (keys: { time: number; rotation: number }[], minDur: number): boolean => {
      for (let i = 1; i < keys.length; i++) {
        const dt = keys[i].time - keys[i - 1].time
        const dRot = Math.abs(keys[i].rotation - keys[i - 1].rotation)
        if (dt >= minDur && dRot <= 2.5 && Math.abs(keys[i].rotation) >= 12) return true
      }
      return false
    }

    const combo = generateCombatCombo(heroBones, 1.5, 'diagonal')
    expect(hasHitstopPlateau(combo['bone-arm-l'], 1.5 * 0.08)).toBe(true)
    expect(combo['bone-cape'].length).toBeGreaterThanOrEqual(5)

    const dodge = generateDodgeCounter(heroBones, 1.25, 'diagonal')
    expect(hasHitstopPlateau(dodge['bone-arm-l'], 1.25 * 0.08)).toBe(true)

    const recoil = generateHitRecoil(heroBones, 1.0, 'diagonal')
    expect(hasHitstopPlateau(recoil['bone-torso'], 1.0 * 0.08)).toBe(true)

    const pounce = generateMonsterPounce(createMonsterBones(), 1.3)
    expect(hasHitstopPlateau(pounce['bone-arm-r'], 1.3 * 0.08)).toBe(true)
  })
})
