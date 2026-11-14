import type { AssetMeta, ImageLayer, Project, WorkflowNode } from '@shared/types'
import { createProject, createShot, shotSpacing } from './factory'
import { createTimeGroup } from './workflowTimeGroups'
import {
  attachLogicNodeToLayerV2,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  v2ClusterLockId,
  v2LayerNodeId
} from './workflowV2Engine'
import {
  DEFAULT_HANBETA_ASSETS,
  populateHanbetaStage,
  setupHanbetaCameraRoute,
  type HanbetaStageHandles,
  type HeroClusterHandles
} from './hanbetaDemoScenes'
import {
  applyCautionForegroundSpines,
  applyCoatBackWindSpines,
  applyCorridorLampSpine,
  applyMistDriftMotion,
  applyShadowEntitySpines,
  choreographRuleBreakSeal
} from './hanbetaPuppetRigs'
import { applyHeroClusterSoftRigs } from './hanbetaHeroSoftRig'

export interface HanbetaAssetInput {
  id: string
  file?: string
  name?: string
  width?: number
  height?: number
}

function buildAssetMap(assetInputs: HanbetaAssetInput[]): { assets: AssetMeta[]; byId: Map<string, AssetMeta> } {
  const inputById = new Map(assetInputs.map((a) => [a.id, a]))
  const assets: AssetMeta[] = DEFAULT_HANBETA_ASSETS.map((def) => {
    const ov = inputById.get(def.id)
    if (!ov) return { ...def }
    const file = ov.file ?? def.assetPath?.split('/').pop() ?? ''
    return {
      ...def,
      name: ov.name ?? def.name,
      width: ov.width ?? def.width,
      height: ov.height ?? def.height,
      path: `assets/scenes-hanbeta-v2/${file}`,
      assetPath: `scenes-hanbeta-v2/${file}`
    }
  })
  return { assets, byId: new Map(assets.map((a) => [a.id, a])) }
}

/** Giữ đường cắt cảnh dứt khoát giữa 3 hồi (0..5s, 5..10s, 10..15s) sau khi đồng bộ Workflow V2. */
export function repairHanbetaTiming(project: Project): Project {
  project.comp.duration = 15
  project.comp.fps = 30
  const tracks = [
    project.camera.position,
    project.camera.target,
    project.camera.focusDistance,
    ...(project.camera.roll ? [project.camera.roll] : [])
  ]
  for (const track of tracks) {
    for (const [from, nextCut] of [[4.35, 5.0], [9.2, 10.0]]) {
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
  hero: HeroClusterHandles,
  targetLayer: ImageLayer,
  title: string,
  timeStart: number,
  timeEnd: number
): WorkflowNode | undefined {
  const heroLockId = v2ClusterLockId(hero.instanceId)
  const hubRes = attachLogicNodeToLayerV2(project.workflow!, heroLockId, 'part_swap', 'v2:part_swap:part_group')
  project.workflow = syncWorkflowV2Graph(project, hubRes.workflow)
  const exprChild = project.workflow.nodes.find(
    (n) =>
      n.params?.isPartChild &&
      n.params?.instanceId === hero.instanceId &&
      (n.params?.partGroupId === 'slot:expression' || n.params?.partGroupId === 'part-expression')
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

function applyAllHanbetaRigs(h: HanbetaStageHandles): void {
  // Cảnh 1
  applyHeroClusterSoftRigs(h.hero1, 0.2)
  applyCoatBackWindSpines(h.hero1.coatBack, 0.2)
  applyCorridorLampSpine(h.s1Lamp, 0.1)
  applyShadowEntitySpines(h.s1Shadow, 0.3)
  applyCautionForegroundSpines(h.s1Caution, 0.4)
  applyMistDriftMotion(h.s1Mist, 0, 5.0, 1)

  // Cảnh 2
  applyHeroClusterSoftRigs(h.hero2, 1.1)
  applyCoatBackWindSpines(h.hero2.coatBack, 1.1)
  applyCorridorLampSpine(h.s2Lamp, 0.8)
  applyShadowEntitySpines(h.s2Shadow, 1.2)
  applyCautionForegroundSpines(h.s2Caution, 1.4)
  applyMistDriftMotion(h.s2Mist, 5.0, 10.0, 2)

  // Cảnh 3
  applyHeroClusterSoftRigs(h.hero3, 2.0)
  applyCoatBackWindSpines(h.hero3.coatBack, 2.0)
  applyShadowEntitySpines(h.s3Shadow, 2.1)
  applyCautionForegroundSpines(h.s3Caution, 2.3)
  applyMistDriftMotion(h.s3Mist, 10.0, 15.0, 3)
  choreographRuleBreakSeal(h.s3Seal, 10.0, 15.0)
}

function wireShot1Logic(project: Project, h: HanbetaStageHandles): void {
  const heroLockId = v2ClusterLockId(h.hero1.instanceId)
  const swapNode = wireExpressionSwap(
    project,
    h.hero1,
    h.hero1.headSmirk,
    'Bộ phận: Ánh Mắt Thấu Thị Quy Tắc',
    2.4,
    4.95
  )
  chainNode(
    project,
    heroLockId,
    'anim_fx',
    'v2:anim_fx:rig_scheming',
    { animMode: 'rig_clip', rigActionPreset: 'scheming', intensity: 1.0, timeStart: 0.05, timeEnd: 4.95 },
    'Hành động: Ngẫm Đọc Tờ Quy Tắc'
  )
  chainNode(
    project,
    v2LayerNodeId(h.s1Lamp.id),
    'light',
    'v2:light:candle',
    { lightMode: 'candle', lightColor: '#ff453a', intensity: 0.55, timeStart: 0, timeEnd: 5.0 },
    'Ánh sáng: Đèn Trần Đỏ Hành Lang'
  )
  const shadowMot = chainNode(
    project,
    v2LayerNodeId(h.s1Shadow.id),
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: 265,
      bboxTargetY: -15,
      bboxTargetScalePct: 112,
      depthMode: 'keep',
      bboxStartZ: 1450,
      bboxTargetZ: 1120,
      timeStart: 2.2,
      timeEnd: 4.95
    },
    'Motion: Bóng Đen Rình Rập Tiến Lại'
  )
  chainNode(
    project,
    shadowMot.id,
    'fx',
    'v2:fx:pulse',
    { animFxPreset: 'pulse', intensity: 0.55, animFxSpeed: 0.8, timeStart: 0.5, timeEnd: 4.95 },
    'FX: Nhịp Đập Ẩn Hiện Rình Rập'
  )

  const targets = swapNode ? [swapNode, shadowMot] : [shadowMot]
  createTimeGroup(project, targets, {
    title: 'Nhịp 1: Đọc Thấu Kẽ Hở Quy Tắc',
    color: '#f59e0b',
    start: 2.2,
    end: 4.95
  })
}

function wireShot2Logic(project: Project, h: HanbetaStageHandles): void {
  const heroLockId = v2ClusterLockId(h.hero2.instanceId)
  const swapNode = wireExpressionSwap(
    project,
    h.hero2,
    h.hero2.headShock,
    'Bộ phận: Giật Mình Kinh Ngạc 404',
    5.35,
    9.95
  )
  chainNode(
    project,
    heroLockId,
    'anim_fx',
    'v2:anim_fx:rig_shock',
    { animMode: 'rig_clip', rigActionPreset: 'shock', intensity: 1.1, timeStart: 5.05, timeEnd: 9.95 },
    'Hành động: Giật Lùi Khi Thực Thể Áp Sát'
  )
  chainNode(
    project,
    v2LayerNodeId(h.s2Lamp.id),
    'light',
    'v2:light:candle',
    { lightMode: 'candle', lightColor: '#ff9f43', intensity: 0.48, timeStart: 5.0, timeEnd: 10.0 },
    'Ánh sáng: Đèn Chập Chờn Phòng 404'
  )
  const shadowLunge = chainNode(
    project,
    v2LayerNodeId(h.s2Shadow.id),
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: 165,
      bboxTargetY: 25,
      bboxTargetScalePct: 122,
      depthMode: 'keep',
      bboxStartZ: 950,
      bboxTargetZ: 460,
      timeStart: 5.35,
      timeEnd: 8.8
    },
    'Motion: Thực Thể Lao Xuyên Cửa 404'
  )
  const shadowGlow = chainNode(
    project,
    shadowLunge.id,
    'fx',
    'v2:fx:glow',
    { animFxPreset: 'neonBreathe', animFxColor: '#ff2b4a', intensity: 0.65, animFxThickness: 8, animFxSpeed: 1.6, timeStart: 5.35, timeEnd: 9.9 },
    'FX: Hắc Quang Đỏ Thực Thể'
  )

  const targets = swapNode ? [swapNode, shadowLunge, shadowGlow] : [shadowLunge, shadowGlow]
  createTimeGroup(project, targets, {
    title: 'Nhịp 2: Thực Thể Áp Sát Phòng 404',
    color: '#ef4444',
    start: 5.35,
    end: 9.9
  })
}

function wireShot3Logic(project: Project, h: HanbetaStageHandles): void {
  const heroLockId = v2ClusterLockId(h.hero3.instanceId)
  const swapNode = wireExpressionSwap(
    project,
    h.hero3,
    h.hero3.headSmirk,
    'Bộ phận: Tự Tin Nắm Chắc Quy Tắc',
    10.35,
    15.0
  )
  chainNode(
    project,
    heroLockId,
    'anim_fx',
    'v2:anim_fx:rig_point',
    { animMode: 'rig_clip', rigActionPreset: 'point', intensity: 1.08, timeStart: 10.05, timeEnd: 14.95 },
    'Hành động: Chỉ Tay Khai Ấn Phá Cục'
  )
  const sealGlow = chainNode(
    project,
    v2LayerNodeId(h.s3Seal.id),
    'fx',
    'v2:fx:glow',
    { animFxPreset: 'neonBreathe', animFxColor: '#ffd166', intensity: 0.85, animFxThickness: 10, animFxSpeed: 1.4, timeStart: 10.1, timeEnd: 15.0 },
    'FX: Kim Quang Ấn Triện'
  )
  const shadowGlow = chainNode(
    project,
    v2LayerNodeId(h.s3Shadow.id),
    'fx',
    'v2:fx:glow',
    { animFxPreset: 'neonBreathe', animFxColor: '#ff2b4a', intensity: 0.55, animFxThickness: 7, animFxSpeed: 2.0, timeStart: 10.0, timeEnd: 13.0 },
    'FX: Hắc Khí Phản Kháng'
  )
  const shadowBanish = chainNode(
    project,
    shadowGlow.id,
    'fx',
    'v2:fx:fadeOut',
    { animFxPreset: 'fadeOut', loopFadeOutSec: 1.4, loopEndAction: 'fade_out', timeStart: 12.6, timeEnd: 14.5 },
    'FX: Thực Thể Tan Biến'
  )

  const targets = swapNode ? [swapNode, sealGlow, shadowBanish] : [sealGlow, shadowBanish]
  createTimeGroup(project, targets, {
    title: 'Nhịp 3: Khai Ấn Phá Cục',
    color: '#eab308',
    start: 10.35,
    end: 14.5
  })
}

/**
 * Dựng Dự Án Phim Mẫu 3 ("Hàn Bối Tháp — Quái Đàm Quy Tắc 2.5D"):
 * 3 cảnh 15s (5s/cảnh), nhân vật cắt lớp nhiều biểu cảm `part_swap`,
 * xương soft-skin giải phẫu chuẩn nhịp thở bất đối xứng & sóng lụa S-wave.
 */
export function buildHanbetaWorkflowV2Project(assetInputs: HanbetaAssetInput[] = DEFAULT_HANBETA_ASSETS): Project {
  const { assets, byId } = buildAssetMap(assetInputs)
  const project = createProject({
    name: 'Hàn Bối Tháp — Quái Đàm Quy Tắc 2.5D',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 15,
    background: '#07040a'
  })
  project.assets = assets
  project.look = {
    fogEnabled: true,
    fogColor: '#180c14',
    fogNear: 1900,
    fogFar: 6200,
    vignette: 0.34,
    grain: 0.05,
    exposure: 0.04,
    contrast: 1.08,
    saturation: 1.06
  }

  const spacing = shotSpacing(project.comp)
  const s1 = createShot('Cảnh 1: Hành Lang Đèn Đỏ', [0, 0, 0], 0)
  const s2 = createShot('Cảnh 2: Cửa Phòng 404 Kính Mờ', [spacing, 0, 0], 1)
  const s3 = createShot('Cảnh 3: Sân Thượng Trăng Máu Phá Cục', [spacing * 2, 0, 0], 2)
  project.shots = [s1, s2, s3]

  const handles = populateHanbetaStage(project, project.shots, byId, project.comp)
  setupHanbetaCameraRoute(project, project.shots)
  applyAllHanbetaRigs(handles)

  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  wireShot1Logic(project, handles)
  wireShot2Logic(project, handles)
  wireShot3Logic(project, handles)

  // Giữ nguyên nhịp xoay & bùng mở của Ấn Triện sau khi sync node FX
  choreographRuleBreakSeal(handles.s3Seal, 10.0, 15.0)
  return repairHanbetaTiming(project)
}
