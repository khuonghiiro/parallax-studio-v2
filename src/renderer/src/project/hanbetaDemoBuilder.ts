import type { AssetMeta, ImageLayer, Project, WorkflowNode } from '@shared/types'
import { createProject, createShot, shotSpacing } from './factory'
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
  targetX: number
  targetY: number
  scalePct: number
  timeStart: number
  timeEnd: number
  title: string
}

interface RigSpec {
  preset: string
  intensity: number
  timeStart: number
  timeEnd: number
  title: string
}

const rootY = (cluster: CompositeClusterHandles): number => Math.round(cluster.root.transform.position.value[1])

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
    ...(project.camera.roll ? [project.camera.roll] : [])
  ]
  for (const track of tracks) {
    for (const [from, nextCut] of [[4.85, 5.5], [10.35, 11.0]]) {
      const pose = track.keyframes.find((k) => Math.abs(k.t - from) < 0.02)
      if (!pose) continue
      const hasCutAfter = track.keyframes.some((k) => Math.abs(k.t - nextCut) < 0.02)
      if (hasCutAfter) pose.ease = 'hold'
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

function wireClusterChain(
  project: Project,
  cluster: CompositeClusterHandles,
  motions: MotionSpec[],
  rigs: RigSpec[]
): { lastMotion?: WorkflowNode; lastRig?: WorkflowNode } {
  let upstream = v2ClusterLockId(cluster.instanceId)
  let lastMotion: WorkflowNode | undefined
  for (const m of motions) {
    lastMotion = chainNode(
      project,
      upstream,
      'action',
      'v2:action:bbox_target',
      {
        motionMode: 'bbox',
        actionPreset: 'bbox_target',
        bboxPathType: 'shortest',
        bboxTargetX: m.targetX,
        bboxTargetY: m.targetY,
        bboxTargetScalePct: m.scalePct,
        depthMode: 'keep',
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
      { animMode: 'rig_clip', rigActionPreset: r.preset, intensity: r.intensity, timeStart: r.timeStart, timeEnd: r.timeEnd },
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
  const hero = wireClusterChain(
    project,
    h.hero1,
    [{ targetX: 15, targetY: rootY(h.hero1), scalePct: 104, timeStart: 0.15, timeEnd: 5.35, title: 'Motion: Kiếm Khách Vượt Đèo' }],
    [{ preset: 'walk', intensity: 1.05, timeStart: 0.05, timeEnd: 5.45, title: 'Hành động: Bước Đi Chiến Đấu' }]
  )
  const wolf = wireClusterChain(
    project,
    h.wolf1,
    [{ targetX: 290, targetY: rootY(h.wolf1), scalePct: 104, timeStart: 0.15, timeEnd: 5.35, title: 'Motion: Linh Lang Săn Mồi' }],
    [{ preset: 'quadruped_walk', intensity: 1.05, timeStart: 0.05, timeEnd: 5.45, title: 'Linh Lang: Bước Đi 4 Chân' }]
  )
  const eagle = wireClusterChain(
    project,
    h.eagle1,
    [{ targetX: 440, targetY: 285, scalePct: 106, timeStart: 0.1, timeEnd: 5.4, title: 'Motion: Linh Ưng Lướt Gió' }],
    [{ preset: 'wing_flap', intensity: 1.05, timeStart: 0.05, timeEnd: 5.45, title: 'Linh Ưng: Vỗ Cánh Tuần Tra' }]
  )
  const targets = [hero.lastRig, wolf.lastRig, eagle.lastRig].filter((n): n is WorkflowNode => Boolean(n))
  createTimeGroup(project, targets, {
    title: 'Nhịp 1: Hiệp Hành Vượt Đèo Sương',
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
  wireClusterChain(
    project,
    h.hero2,
    [{ targetX: -140, targetY: rootY(h.hero2), scalePct: 104, timeStart: 5.65, timeEnd: 8.0, title: 'Motion: Kiếm Khách Xung Phong' }],
    [
      { preset: 'run', intensity: 1.08, timeStart: 5.55, timeEnd: 8.0, title: 'Hành động: Chạy Bứt Tốc' },
      { preset: 'dodge_counter', intensity: 1.12, timeStart: 8.05, timeEnd: 10.95, title: 'Hành động: Né Đòn & Phản Kích' }
    ]
  )
  wireClusterChain(
    project,
    h.wolf2,
    [{ targetX: -395, targetY: rootY(h.wolf2), scalePct: 105, timeStart: 5.7, timeEnd: 9.8, title: 'Motion: Linh Lang Phi Nước Đại' }],
    [{ preset: 'quadruped_gallop', intensity: 1.12, timeStart: 5.6, timeEnd: 10.9, title: 'Linh Lang: Phi Nước Đại' }]
  )
  const monster = wireClusterChain(
    project,
    h.monster2,
    [{ targetX: 235, targetY: rootY(h.monster2), scalePct: 106, timeStart: 5.65, timeEnd: 7.6, title: 'Motion: Ma Thú Rình Mồi' }],
    [
      { preset: 'monster_prowl', intensity: 1.05, timeStart: 5.55, timeEnd: 7.6, title: 'Ma Thú: Rình Mồi Áp Đảo' },
      { preset: 'monster_roar', intensity: 1.15, timeStart: 7.65, timeEnd: 10.9, title: 'Ma Thú: Gầm Vang Rung Sân' }
    ]
  )
  const shockPop = chainNode(project, v2LayerNodeId(h.s2Shockwave.id), 'fx', 'v2:fx:popIn', { animFxPreset: 'popIn', intensity: 0.72, timeStart: 7.65, timeEnd: 10.9 }, 'Hiện/Ẩn: Bùng Sóng Gầm')
  const shockGlow = chainNode(project, shockPop.id, 'fx', 'v2:fx:glow', { animFxPreset: 'neonBreathe', animFxColor: '#c084fc', intensity: 0.78, animFxThickness: 9, animFxSpeed: 1.6, timeStart: 7.65, timeEnd: 10.9 }, 'Phát sáng: Tử Quang Sóng Âm')
  chainNode(project, shockGlow.id, 'fx', 'v2:fx:fadeOut', { animFxPreset: 'fadeOut', loopFadeInSec: 0, loopFadeOutSec: 0.9, timeStart: 9.9, timeEnd: 10.9 }, 'Hiện/Ẩn: Tan Sóng Âm')

  const targets = [monster.lastRig, shockPop, shockGlow, heroSwap].filter((n): n is WorkflowNode => Boolean(n))
  createTimeGroup(project, targets, {
    title: 'Nhịp 2: Ma Thú Gầm Vang & Phản Kích',
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
      bboxTargetX: 215,
      bboxTargetY: -5,
      bboxTargetScalePct: 124,
      depthMode: 'keep',
      timeStart: 12.25,
      timeEnd: 13.7
    },
    'Motion: Kiếm Khí Phóng Xuyên Ma Thú'
  )
  const crescentGlow = chainNode(
    project,
    crescentMot.id,
    'fx',
    'v2:fx:glow',
    { animFxPreset: 'neonBreathe', animFxColor: '#38bdf8', intensity: 0.85, animFxThickness: 10, animFxSpeed: 1.8, timeStart: 12.25, timeEnd: 15.8 },
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
      collisionForce: 1.3,
      deformIntensity: 0.65,
      depthMode: 'flat_2d',
      timeStart: 13.2,
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

  const impactPop = chainNode(project, v2LayerNodeId(h.s3ImpactBurst.id), 'fx', 'v2:fx:popIn', { animFxPreset: 'popIn', intensity: 0.8, timeStart: 13.2, timeEnd: 15.6 }, 'Hiện/Ẩn: Bùng Nổ Giao Kiếm')
  const impactPulse = chainNode(project, impactPop.id, 'fx', 'v2:fx:pulse', { animFxPreset: 'pulse', intensity: 0.7, animFxSpeed: 2.0, timeStart: 13.2, timeEnd: 15.6 }, 'Nhịp/Rung: Chấn Động Va Chạm')
  chainNode(project, impactPulse.id, 'fx', 'v2:fx:fadeOut', { animFxPreset: 'fadeOut', loopFadeInSec: 0, loopFadeOutSec: 0.9, timeStart: 14.6, timeEnd: 15.6 }, 'Hiện/Ẩn: Tàn Tia Lửa')

  const colNode = project.workflow.nodes.find((n) => n.id === colRes.createdNodeId)
  const targets = [colNode, impactPop, impactPulse].filter((n): n is WorkflowNode => Boolean(n))
  createTimeGroup(project, targets, {
    title: 'Nhịp 3: Kiếm Khí Trảm Kích & Va Chạm Đỉnh Cao',
    color: '#ef4444',
    start: 13.2,
    end: 15.6
  })
}

function wireShot3Logic(project: Project, h: HanbetaStageHandles): void {
  wireExpressionSwap(
    project,
    h.hero3,
    'hero-head-shout',
    'Biểu cảm: Xuất Chiêu Quyết Chiến',
    11.25,
    16.45
  )
  wireClusterChain(
    project,
    h.hero3,
    [{ targetX: -75, targetY: rootY(h.hero3), scalePct: 105, timeStart: 11.15, timeEnd: 13.3, title: 'Motion: Lướt Tới Xuất Kiếm' }],
    [
      { preset: 'combat', intensity: 1.15, timeStart: 11.1, timeEnd: 14.4, title: 'Hành động: Liên Hoàn Kiếm Chiêu' },
      { preset: 'martial_kick', intensity: 1.1, timeStart: 14.45, timeEnd: 16.45, title: 'Hành động: Đá Xoáy Kết Liễu' }
    ]
  )
  wireClusterChain(
    project,
    h.monster3,
    [
      { targetX: 150, targetY: rootY(h.monster3), scalePct: 104, timeStart: 11.15, timeEnd: 13.2, title: 'Motion: Ma Thú Lao Vồ Trực Diện' },
      { targetX: 335, targetY: rootY(h.monster3), scalePct: 98, timeStart: 13.35, timeEnd: 15.6, title: 'Motion: Ma Thú Bật Lùi Sau Kiếm Khí' }
    ],
    [
      { preset: 'monster_pounce', intensity: 1.12, timeStart: 11.1, timeEnd: 13.25, title: 'Ma Thú: Vồ Trảo Tấn Công' },
      { preset: 'hit_recoil', intensity: 1.18, timeStart: 13.3, timeEnd: 16.4, title: 'Ma Thú: Trúng Kiếm Bật Lùi' }
    ]
  )
  wireClusterChain(
    project,
    h.wolf3,
    [{ targetX: -380, targetY: rootY(h.wolf3), scalePct: 104, timeStart: 11.15, timeEnd: 14.2, title: 'Motion: Linh Lang Tấn Công Sườn' }],
    [{ preset: 'quadruped_gallop', intensity: 1.1, timeStart: 11.05, timeEnd: 16.4, title: 'Linh Lang: Xung Phong Hợp Kích' }]
  )
  wireClusterChain(
    project,
    h.eagle3,
    [{ targetX: 300, targetY: 315, scalePct: 106, timeStart: 11.1, timeEnd: 16.3, title: 'Motion: Linh Ưng Quần Thảo' }],
    [{ preset: 'wing_flap', intensity: 1.05, timeStart: 11.05, timeEnd: 16.4, title: 'Linh Ưng: Vỗ Cánh Áp Chế' }]
  )
  wireShot3CollisionAndVfx(project, h)
}

/**
 * Dựng Dự Án Phim Mẫu 3 ("Hàn Bối Tháp — Đại Chiến Linh Thú 2.5D"):
 * 3 cảnh hành động 16.5s (5.5s/cảnh), Kiếm Khách, Linh Lang, Kim Sí Linh Ưng và Hắc Ám Ma Thú
 * tách khớp giải phẫu chuẩn từ sprite atlas, chạy đồng bộ trên Workflow V2 nguyên tử.
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
    fogNear: 2000,
    fogFar: 6400,
    vignette: 0.3,
    grain: 0.04,
    exposure: 0.04,
    contrast: 1.07,
    saturation: 1.08
  }

  const spacing = shotSpacing(project.comp)
  const s1 = createShot('Cảnh 1: Hiệp Hành Qua Đèo Sương Mù', [0, 0, 0], 0)
  const s2 = createShot('Cảnh 2: Hắc Thú Phá Ấn — Giao Chiến Sân Cổ', [spacing, 0, 0], 1)
  const s3 = createShot('Cảnh 3: Tuyệt Kỹ Thanh Đao — Trảm Phá Ma Thú', [spacing * 2, 0, 0], 2)
  project.shots = [s1, s2, s3]

  const handles = populateHanbetaStage(project, project.shots, byId, project.comp)
  setupHanbetaCameraRoute(project, project.shots)

  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  wireShot1Logic(project, handles)
  wireShot2Logic(project, handles)
  wireShot3Logic(project, handles)

  return repairHanbetaTiming(project)
}
