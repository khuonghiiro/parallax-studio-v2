import type { MotionViewAngle } from '@shared/layerRig'
import type { AssetMeta, ImageLayer, Project, WorkflowNode } from '@shared/types'
import { referenceDistance } from '../animation/math'
import { createProject, createShot, shotSpacing } from './factory'
import { projectCorridorFootToWorld } from './sceneDepthCorridor'
import { createTimeGroup } from './workflowTimeGroups'
import {
  attachLogicNodeToLayerV2,
  recomputeSharedLogicTargets,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  v2ClusterLockId,
  v2LayerNodeId
} from './workflowV2Engine'
import {
  DEFAULT_HANBETA_ASSETS,
  populateHanbetaStage,
  setupHanbetaCameraRoute,
  type CompositeClusterHandles,
  type HanbetaStageHandles
} from './hanbetaDemoScenes'

export interface HanbetaAssetInput {
  id: string
  file?: string
  name?: string
  width?: number
  height?: number
}

interface MotionSpec {
  targetX?: number
  targetY?: number
  targetZ?: number
  groundTarget?: { screenX: number; screenFootY: number; z: number }
  corridorWaypoints?: [number, number][]
  depthMode?: 'flat_2d' | 'depth_z' | 'depth_corridor' | 'keep'
  scalePct: number
  timeStart: number
  timeEnd: number
  title: string
}

interface RigSpec {
  preset: string
  intensity: number
  rigViewAngle?: MotionViewAngle
  timeStart: number
  timeEnd: number
  title: string
}

function buildAssetMap(assetInputs: HanbetaAssetInput[]): { assets: AssetMeta[]; byId: Map<string, AssetMeta> } {
  const inputById = new Map(assetInputs.map((a) => [a.id, a]))
  const assets: AssetMeta[] = DEFAULT_HANBETA_ASSETS.map((def) => {
    const ov = inputById.get(def.id)
    if (!ov) return { ...def }
    const file = ov.file ?? def.assetPath?.split('/').pop() ?? ''
    const folder = def.assetPath?.split('/').slice(0, -1).join('/') ?? 'scenes-action-25d/env'
    return {
      ...def,
      name: ov.name ?? def.name,
      width: ov.width ?? def.width,
      height: ov.height ?? def.height,
      path: `assets/${folder}/${file}`,
      assetPath: `${folder}/${file}`
    }
  })
  return { assets, byId: new Map(assets.map((a) => [a.id, a])) }
}

/** Giữ đường cắt cảnh dứt khoát giữa 3 hồi (0..5.5s, 5.5..11.0s, 11.0..16.5s) sau khi đồng bộ Workflow V2. */
export function repairHanbetaTiming(project: Project): Project {
  project.comp.duration = 16.5
  project.comp.fps = 30
  const tracks = [
    project.camera.position,
    project.camera.target,
    project.camera.focusDistance,
    project.camera.fov,
    ...(project.camera.roll ? [project.camera.roll] : [])
  ]
  for (const track of tracks) {
    for (const cutTime of [5.5, 11.0]) {
      const hasCutAt = track.keyframes.some((k) => Math.abs(k.t - cutTime) < 0.02)
      if (!hasCutAt) continue
      const prevCandidates = track.keyframes.filter((k) => k.t < cutTime - 0.001 && k.t >= cutTime - 0.8)
      const lastBeforeCut = prevCandidates[prevCandidates.length - 1]
      if (lastBeforeCut) lastBeforeCut.ease = 'hold'
    }
    track.keyframes.sort((a, b) => a.t - b.t)
  }
  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  return project
}

function chainNode(
  project: Project,
  upstreamNodeId: string,
  category: Parameters<typeof attachLogicNodeToLayerV2>[2],
  presetId: string,
  params: Record<string, unknown>,
  title?: string
): WorkflowNode {
  const res = attachLogicNodeToLayerV2(project.workflow!, upstreamNodeId, category, presetId, params, title)
  project.workflow = res.workflow
  const node = project.workflow.nodes.find((n) => n.id === res.createdNodeId)
  if (!node) throw new Error(`Failed to attach logic node ${presetId} after ${upstreamNodeId}`)
  syncWorkflowV2NodeToProject(project, node)
  return node
}

function wireExpressionSwap(
  project: Project,
  hero: CompositeClusterHandles,
  sourceId: string,
  title: string,
  timeStart: number,
  timeEnd: number
): WorkflowNode | undefined {
  const targetLayer: ImageLayer | undefined = hero.bySourceId.get(sourceId)
  if (!targetLayer) return undefined
  const heroLockId = v2ClusterLockId(hero.instanceId)
  const hubRes = attachLogicNodeToLayerV2(project.workflow!, heroLockId, 'part_swap', 'v2:part_swap:part_group')
  project.workflow = syncWorkflowV2Graph(project, hubRes.workflow)
  const exprChild = project.workflow.nodes.find(
    (n) =>
      n.params?.isPartChild &&
      n.params?.instanceId === hero.instanceId &&
      (n.params?.partGroupId === 'slot:expression' || n.params?.partGroupId === 'pg-hero-expr')
  )
  if (exprChild) {
    exprChild.title = title
    syncWorkflowV2NodeToProject(project, exprChild, {
      partActionMode: 'variant',
      swapSlot: 'expression',
      swapTargetLayerId: targetLayer.id,
      swapVariant: targetLayer.id,
      timeStart,
      timeEnd,
      partSwapHoldAfterEnd: true
    })
  }
  return exprChild
}

function resolveMotionTarget(
  project: Project,
  cluster: CompositeClusterHandles,
  m: MotionSpec
): { targetX: number; targetY: number; targetZ?: number; depthMode: NonNullable<MotionSpec['depthMode']> } {
  if (m.groundTarget) {
    const refDist = referenceDistance(project.comp)
    const persp = refDist / Math.max(80, m.groundTarget.z + refDist)
    const targetScaleRatio = Math.max(0.15, Math.min(4.0, m.scalePct / 100))
    const solved = projectCorridorFootToWorld(
      project.comp,
      m.groundTarget.screenX,
      m.groundTarget.screenFootY,
      m.groundTarget.z,
      cluster.globalScale * targetScaleRatio * persp,
      cluster.footOffsetY
    )
    return {
      targetX: Math.round(solved.x),
      targetY: Math.round(solved.y),
      targetZ: Math.round(solved.z),
      depthMode: m.depthMode ?? 'depth_corridor'
    }
  }
  return {
    targetX: m.targetX ?? Math.round(cluster.root.transform.position.value[0]),
    targetY: m.targetY ?? Math.round(cluster.root.transform.position.value[1]),
    ...(typeof m.targetZ === 'number' ? { targetZ: m.targetZ } : {}),
    depthMode: m.depthMode ?? 'keep'
  }
}

function wireClusterChain(
  project: Project,
  cluster: CompositeClusterHandles,
  motions: MotionSpec[],
  rigs: RigSpec[]
): { lastMotion?: WorkflowNode; lastRig?: WorkflowNode } {
  let upstream = v2ClusterLockId(cluster.instanceId)
  let lastMotion: WorkflowNode | undefined
  for (const m of motions) {
    const resolved = resolveMotionTarget(project, cluster, m)
    lastMotion = chainNode(
      project,
      upstream,
      'action',
      'v2:action:bbox_target',
      {
        motionMode: 'bbox',
        actionPreset: 'bbox_target',
        bboxPathType: 'shortest',
        bboxTargetX: resolved.targetX,
        bboxTargetY: resolved.targetY,
        ...(typeof resolved.targetZ === 'number' ? { bboxTargetZ: resolved.targetZ } : {}),
        bboxTargetScalePct: m.scalePct,
        depthMode: resolved.depthMode,
        ...(m.corridorWaypoints ? { corridorWaypoints: m.corridorWaypoints } : {}),
        ...(cluster.footOffsetY > 0 ? { corridorFootOffsetY: cluster.footOffsetY } : {}),
        timeStart: m.timeStart,
        timeEnd: m.timeEnd
      },
      m.title
    )
    upstream = lastMotion.id
  }
  let lastRig: WorkflowNode | undefined
  for (const r of rigs) {
    lastRig = chainNode(
      project,
      upstream,
      'anim_fx',
      `v2:anim_fx:rig_${r.preset}`,
      {
        animMode: 'rig_clip',
        rigActionPreset: r.preset,
        ...(r.rigViewAngle ? { rigViewAngle: r.rigViewAngle } : {}),
        intensity: r.intensity,
        timeStart: r.timeStart,
        timeEnd: r.timeEnd
      },
      r.title
    )
    upstream = lastRig.id
  }
  return { lastMotion, lastRig }
}

function wireShot1Logic(project: Project, h: HanbetaStageHandles): void {
  wireExpressionSwap(
    project,
    h.hero1,
    'hero-head-shout',
    'Biểu cảm: Hét Xung Phong Đèo Sương',
    3.6,
    5.45
  )
  chainNode(
    project,
    v2LayerNodeId(h.s1MistMid.id),
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: 55,
      bboxTargetY: -22,
      bboxTargetScalePct: 108,
      depthMode: 'keep',
      timeStart: 0.0,
      timeEnd: 5.5
    },
    'Motion: Mây Sương Trôi Ngang Hẻm Đèo'
  )

  const hero = wireClusterChain(
    project,
    h.hero1,
    [
      {
        groundTarget: { screenX: 62, screenFootY: -435, z: 95 },
        corridorWaypoints: [
          [-142, 38],
          [-104, -58],
          [-196, -188],
          [-38, -335],
          [62, -435]
        ],
        depthMode: 'depth_corridor',
        scalePct: 168,
        timeStart: 0.12,
        timeEnd: 5.38,
        title: 'Motion 3D: Kiếm Khách Đi Từ Hẻm Sâu Ra Tiền Cảnh (Z 2050→95)'
      }
    ],
    [
      {
        preset: 'walk',
        rigViewAngle: 'diagonal',
        intensity: 1.06,
        timeStart: 0.05,
        timeEnd: 5.45,
        title: 'Hành động: Bước Xuống Bậc Đá Góc Chéo 3/4'
      }
    ]
  )
  const wolf = wireClusterChain(
    project,
    h.wolf1,
    [
      {
        groundTarget: { screenX: 205, screenFootY: -455, z: 125 },
        corridorWaypoints: [
          [-98, 6],
          [-82, -88],
          [-145, -208],
          [38, -352],
          [205, -455]
        ],
        depthMode: 'depth_corridor',
        scalePct: 162,
        timeStart: 0.12,
        timeEnd: 5.38,
        title: 'Motion 3D: Linh Lang Dò Đường Qua Ngõ Sương (Z 1900→125)'
      }
    ],
    [{ preset: 'quadruped_walk', intensity: 1.06, timeStart: 0.05, timeEnd: 5.45, title: 'Linh Lang: Bước Đi 4 Chân Bám Bậc Đá' }]
  )
  const eagle = wireClusterChain(
    project,
    h.eagle1,
    [
      {
        targetX: 395,
        targetY: 255,
        targetZ: 250,
        depthMode: 'depth_z',
        scalePct: 104,
        timeStart: 0.1,
        timeEnd: 5.4,
        title: 'Motion 3D: Linh Ưng Lao Từ Đỉnh Tháp Xa (Z 1180→250)'
      }
    ],
    [{ preset: 'wing_flap', intensity: 1.05, timeStart: 0.05, timeEnd: 5.45, title: 'Linh Ưng: Vỗ Cánh Tuần Tra Hẻm Đèo' }]
  )

  const targets = [hero.lastRig, wolf.lastRig, eagle.lastRig].filter((n): n is WorkflowNode => Boolean(n))
  createTimeGroup(project, targets, {
    title: 'Nhịp 1: Xuyên Sương Ra Khỏi Ngõ Đá Cổ Mộ',
    color: '#38bdf8',
    start: 0.05,
    end: 5.45
  })
}

function wireShot2Logic(project: Project, h: HanbetaStageHandles): void {
  const heroSwap = wireExpressionSwap(
    project,
    h.hero2,
    'hero-head-shout',
    'Biểu cảm: Quát Chiến Trước Ma Thú',
    7.65,
    10.9
  )
  chainNode(
    project,
    v2LayerNodeId(h.s2MistMid.id),
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: -115,
      bboxTargetY: -98,
      bboxTargetScalePct: 106,
      depthMode: 'keep',
      timeStart: 5.5,
      timeEnd: 11.0
    },
    'Motion: Sương Cổ Điện Trôi Lững Lờ'
  )

  wireClusterChain(
    project,
    h.hero2,
    [
      {
        groundTarget: { screenX: -135, screenFootY: -348, z: 165 },
        corridorWaypoints: [
          [-395, -235],
          [-265, -295],
          [-135, -348]
        ],
        depthMode: 'depth_corridor',
        scalePct: 100,
        timeStart: 5.62,
        timeEnd: 8.0,
        title: 'Motion 3D: Kiếm Khách Xung Phong Vào Tâm Pháp Trận (Z 380→165)'
      }
    ],
    [
      { preset: 'run', rigViewAngle: 'side', intensity: 1.08, timeStart: 5.55, timeEnd: 8.0, title: 'Hành động: Chạy Bứt Tốc Nghiêng Người' },
      { preset: 'dodge_counter', rigViewAngle: 'diagonal', intensity: 1.15, timeStart: 8.05, timeEnd: 10.95, title: 'Hành động: Né Sóng Gầm & Phản Kiếm Hitstop' }
    ]
  )
  wireClusterChain(
    project,
    h.wolf2,
    [
      {
        groundTarget: { screenX: -335, screenFootY: -385, z: 220 },
        depthMode: 'depth_corridor',
        scalePct: 100,
        timeStart: 5.68,
        timeEnd: 9.8,
        title: 'Motion 3D: Linh Lang Bọc Sườn Pháp Trận (Z 450→220)'
      }
    ],
    [{ preset: 'quadruped_gallop', intensity: 1.12, timeStart: 5.6, timeEnd: 10.9, title: 'Linh Lang: Phi Nước Đại Bọc Sườn' }]
  )
  const monster = wireClusterChain(
    project,
    h.monster2,
    [
      {
        groundTarget: { screenX: 195, screenFootY: -335, z: 185 },
        depthMode: 'depth_corridor',
        scalePct: 100,
        timeStart: 5.62,
        timeEnd: 7.6,
        title: 'Motion 3D: Ma Thú Bước Nặng Ra Giữa Ấn (Z 340→185)'
      }
    ],
    [
      { preset: 'monster_prowl', intensity: 1.06, timeStart: 5.55, timeEnd: 7.6, title: 'Ma Thú: Rình Mồi Áp Đảo' },
      { preset: 'monster_roar', intensity: 1.18, timeStart: 7.65, timeEnd: 10.9, title: 'Ma Thú: Gầm Vang Chấn Động Sân Cổ' }
    ]
  )
  const shockPop = chainNode(project, v2LayerNodeId(h.s2Shockwave.id), 'fx', 'v2:fx:popIn', { animFxPreset: 'popIn', intensity: 0.76, timeStart: 7.65, timeEnd: 10.9 }, 'Hiện/Ẩn: Bùng Sóng Gầm')
  const shockGlow = chainNode(project, shockPop.id, 'fx', 'v2:fx:glow', { animFxPreset: 'neonBreathe', animFxColor: '#c084fc', intensity: 0.82, animFxThickness: 9, animFxSpeed: 1.6, timeStart: 7.65, timeEnd: 10.9 }, 'Phát sáng: Tử Quang Sóng Âm')
  chainNode(project, shockGlow.id, 'fx', 'v2:fx:fadeOut', { animFxPreset: 'fadeOut', loopFadeInSec: 0, loopFadeOutSec: 0.9, timeStart: 9.9, timeEnd: 10.9 }, 'Hiện/Ẩn: Tan Sóng Âm')

  const targets = [monster.lastRig, shockPop, shockGlow, heroSwap].filter((n): n is WorkflowNode => Boolean(n))
  createTimeGroup(project, targets, {
    title: 'Nhịp 2: Ma Thú Phá Ấn & Phản Kích',
    color: '#c084fc',
    start: 7.65,
    end: 10.9
  })
}

function wireShot3CollisionAndVfx(project: Project, h: HanbetaStageHandles): void {
  const crescentMot = chainNode(
    project,
    v2LayerNodeId(h.s3SwordCrescent.id),
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: 235,
      bboxTargetY: -95,
      bboxTargetZ: 175,
      bboxTargetScalePct: 126,
      depthMode: 'depth_z',
      timeStart: 12.25,
      timeEnd: 13.7
    },
    'Motion 3D: Kiếm Khí Phóng Xuyên Ma Thú'
  )
  const crescentGlow = chainNode(
    project,
    crescentMot.id,
    'fx',
    'v2:fx:glow',
    { animFxPreset: 'neonBreathe', animFxColor: '#38bdf8', intensity: 0.88, animFxThickness: 10, animFxSpeed: 1.8, timeStart: 12.25, timeEnd: 15.8 },
    'Phát sáng: Thanh Quang Nguyệt Trảm'
  )
  chainNode(project, crescentGlow.id, 'fx', 'v2:fx:fadeOut', { animFxPreset: 'fadeOut', loopFadeInSec: 0, loopFadeOutSec: 1.0, timeStart: 14.6, timeEnd: 15.8 }, 'Hiện/Ẩn: Kiếm Khí Tan Biến')

  const colRes = attachLogicNodeToLayerV2(
    project.workflow!,
    crescentMot.id,
    'collision',
    'v2:collision:elastic_bounce',
    {
      strikerLayerId: h.s3SwordCrescent.id,
      targetColliderLayerId: h.monster3.root.id,
      targetLayerIds: [h.s3SwordCrescent.id, h.monster3.root.id],
      collisionMode: 'heavy_punch',
      collisionForce: 1.35,
      deformIntensity: 0.68,
      depthMode: 'flat_2d',
      timeStart: 13.15,
      timeEnd: 15.6
    },
    'Va chạm: Kiếm Khí 💥 Ma Thú'
  )
  project.workflow = colRes.workflow
  const monLockId = v2ClusterLockId(h.monster3.instanceId)
  if (colRes.createdNodeId && !project.workflow.edges.some((e) => e.fromNode === monLockId && e.toNode === colRes.createdNodeId)) {
    project.workflow.edges.push({ id: `e-${monLockId}-${colRes.createdNodeId}`, fromNode: monLockId, fromPort: 'layers_tree', toNode: colRes.createdNodeId, toPort: 'layers_tree' })
    project.workflow = { ...project.workflow, nodes: recomputeSharedLogicTargets(project.workflow.nodes, project.workflow.edges) }
    const colNode = project.workflow.nodes.find((n) => n.id === colRes.createdNodeId)
    if (colNode) syncWorkflowV2NodeToProject(project, colNode)
  }

  const impactPop = chainNode(project, v2LayerNodeId(h.s3ImpactBurst.id), 'fx', 'v2:fx:popIn', { animFxPreset: 'popIn', intensity: 0.85, timeStart: 13.15, timeEnd: 15.6 }, 'Hiện/Ẩn: Bùng Nổ Giao Kiếm')
  const impactPulse = chainNode(project, impactPop.id, 'fx', 'v2:fx:pulse', { animFxPreset: 'pulse', intensity: 0.74, animFxSpeed: 2.1, timeStart: 13.15, timeEnd: 15.6 }, 'Nhịp/Rung: Chấn Động Va Chạm')
  chainNode(project, impactPulse.id, 'fx', 'v2:fx:fadeOut', { animFxPreset: 'fadeOut', loopFadeInSec: 0, loopFadeOutSec: 0.9, timeStart: 14.6, timeEnd: 15.6 }, 'Hiện/Ẩn: Tàn Tia Lửa')

  const colNode = project.workflow.nodes.find((n) => n.id === colRes.createdNodeId)
  const targets = [colNode, impactPop, impactPulse].filter((n): n is WorkflowNode => Boolean(n))
  createTimeGroup(project, targets, {
    title: 'Nhịp 3: Kiếm Khí Trảm Kích & Hitstop Đỉnh Cao',
    color: '#ef4444',
    start: 13.15,
    end: 15.6
  })
}

function wireShot3Logic(project: Project, h: HanbetaStageHandles): void {
  wireExpressionSwap(
    project,
    h.hero3,
    'hero-head-shout',
    'Biểu cảm: Xuất Chiêu Quyết Chiến',
    11.2,
    16.45
  )
  wireClusterChain(
    project,
    h.hero3,
    [
      {
        groundTarget: { screenX: -82, screenFootY: -352, z: 155 },
        depthMode: 'depth_corridor',
        scalePct: 100,
        timeStart: 11.12,
        timeEnd: 13.3,
        title: 'Motion 3D: Lướt Tới Xuất Kiếm Áp Sát (Z 300→155)'
      }
    ],
    [
      { preset: 'combat', rigViewAngle: 'diagonal', intensity: 1.18, timeStart: 11.1, timeEnd: 14.4, title: 'Hành động: Liên Hoàn Kiếm Chiêu Hitstop' },
      { preset: 'martial_kick', rigViewAngle: 'diagonal', intensity: 1.12, timeStart: 14.45, timeEnd: 16.45, title: 'Hành động: Đá Xoáy Kết Liễu' }
    ]
  )
  wireClusterChain(
    project,
    h.monster3,
    [
      {
        groundTarget: { screenX: 135, screenFootY: -332, z: 175 },
        depthMode: 'depth_corridor',
        scalePct: 100,
        timeStart: 11.12,
        timeEnd: 13.2,
        title: 'Motion 3D: Ma Thú Lao Vồ Song Trảo (Z 280→175)'
      },
      {
        groundTarget: { screenX: 335, screenFootY: -292, z: 265 },
        depthMode: 'depth_corridor',
        scalePct: 100,
        timeStart: 13.32,
        timeEnd: 15.6,
        title: 'Motion 3D: Ma Thú Trúng Kiếm Trượt Lùi Sâu (Z 175→265)'
      }
    ],
    [
      { preset: 'monster_pounce', intensity: 1.15, timeStart: 11.1, timeEnd: 13.25, title: 'Ma Thú: Vồ Song Trảo Hitstop' },
      { preset: 'hit_recoil', intensity: 1.2, timeStart: 13.3, timeEnd: 16.4, title: 'Ma Thú: Trúng Kiếm Giật Bật Lùi' }
    ]
  )
  wireClusterChain(
    project,
    h.wolf3,
    [
      {
        groundTarget: { screenX: -335, screenFootY: -385, z: 205 },
        depthMode: 'depth_corridor',
        scalePct: 100,
        timeStart: 11.15,
        timeEnd: 14.2,
        title: 'Motion 3D: Linh Lang Lao Vào Hợp Kích (Z 360→205)'
      }
    ],
    [{ preset: 'quadruped_gallop', intensity: 1.12, timeStart: 11.05, timeEnd: 16.4, title: 'Linh Lang: Xung Phong Hợp Kích' }]
  )
  wireClusterChain(
    project,
    h.eagle3,
    [
      {
        targetX: 295,
        targetY: 285,
        targetZ: 240,
        depthMode: 'depth_z',
        scalePct: 104,
        timeStart: 11.1,
        timeEnd: 16.3,
        title: 'Motion 3D: Linh Ưng Bổ Nhào Trăng Đỏ (Z 580→240)'
      }
    ],
    [{ preset: 'wing_flap', intensity: 1.06, timeStart: 11.05, timeEnd: 16.4, title: 'Linh Ưng: Vỗ Cánh Áp Chế' }]
  )
  wireShot3CollisionAndVfx(project, h)
}

/**
 * Dựng Dự Án Phim Mẫu 3 ("Hàn Bối Tháp — Đại Chiến Linh Thú 2.5D"):
 * 3 cảnh hành động 16.5s (5.5s/cảnh), hiểu chiều sâu ngõ đá phối cảnh 1/(Z+d), tách 5 tầng Z,
 * chiến đấu Donghua có Hitstop và lộ trình Camera điện ảnh đa nhịp (Track, Whip-Pan, Punch-Zoom, Match-Cut).
 */
export function buildHanbetaWorkflowV2Project(assetInputs: HanbetaAssetInput[] = DEFAULT_HANBETA_ASSETS): Project {
  const { assets, byId } = buildAssetMap(assetInputs)
  const project = createProject({
    name: 'Hàn Bối Tháp — Đại Chiến Linh Thú 2.5D',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 16.5,
    background: '#070a12'
  })
  project.assets = assets
  project.look = {
    fogEnabled: true,
    fogColor: '#11162a',
    fogNear: 1950,
    fogFar: 6200,
    vignette: 0.3,
    grain: 0.04,
    exposure: 0.04,
    contrast: 1.07,
    saturation: 1.08
  }

  const spacing = shotSpacing(project.comp)
  const s1 = createShot('Cảnh 1: Xuyên Ngõ Sương Cổ Mộ (Chiều Sâu 3D)', [0, 0, 0], 0)
  const s2 = createShot('Cảnh 2: Hắc Thú Phá Ấn — Giao Chiến Sân Cổ', [spacing, 0, 0], 1)
  const s3 = createShot('Cảnh 3: Tuyệt Kỹ Thanh Đao — Trảm Phá Ma Thú', [spacing * 2, 0, 0], 2)
  project.shots = [s1, s2, s3]

  const handles = populateHanbetaStage(project, project.shots, byId, project.comp)

  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  wireShot1Logic(project, handles)
  wireShot2Logic(project, handles)
  wireShot3Logic(project, handles)

  // Dựng lộ trình Camera điện ảnh SAU khi quỹ đạo 3D của nhân vật & quái thú đã bake xong để lia bám chính xác!
  setupHanbetaCameraRoute(project, project.shots)

  return repairHanbetaTiming(project)
}
