import type { Project, WorkflowNode } from '@shared/types'
import { createTimeGroup } from './workflowTimeGroups'
import {
  attachExternalLayerToClusterV2,
  attachLogicNodeToLayerV2,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  updateClusterMemberOffsetV2,
  v2ClusterLockId,
  v2LayerNodeId
} from './workflowV2Engine'
import { DEFAULT_DONGHUA_ASSETS, populateDonghuaStage, type DonghuaAssetInput, type DonghuaStageHandles } from './donghuaDemoScenes'
import {
  applyBambooWindSpines,
  applyCliffPineSpines,
  applyCloakSilkSpines,
  applyPeachBranchSpines,
  applySwordTasselSpine,
  applyWaterShimmerSpines
} from './donghuaSceneryRigs'
import {
  applyFlappingCraneClusterRig,
  applyMaidenPuppetRig,
  applySwordsmanCalmRig,
  applySwordsmanFierceRig,
  choreographBoatWaveAndLanternSway,
  choreographSpiritSwordShot1,
  choreographSpiritSwordShot2
} from './donghuaPuppetRigs'

/** Giữ nhịp chuyển cảnh mượt giữa 3 hồi (0..6s, 6..12s, 12..18s) sau khi đồng bộ Workflow V2. */
export function repairDonghuaTiming(project: Project): Project {
  project.comp.duration = 18
  for (const track of [project.camera.position, project.camera.target]) {
    for (const [from, until] of [[2.6, 5], [9, 11]]) {
      const pose = track.keyframes.find((k) => Math.abs(k.t - from) < 0.001)
      if (!pose) continue
      pose.ease = 'hold'
      if (!track.keyframes.some((k) => Math.abs(k.t - until) < 0.001)) {
        track.keyframes.push({ ...pose, id: `dg-hold-${pose.id}`, t: until, value: [...pose.value], ease: 'easeInOut' })
      }
    }
    track.keyframes.sort((a, b) => a.t - b.t)
  }
  project.shots.forEach((shot, index) => {
    for (const layer of project.layers.filter((l) => l.shotId === shot.id)) {
      if (index > 0 && Math.abs(layer.inPoint - index * 6) < 0.05) layer.inPoint = Math.max(0, index * 6 - 1)
      if (index === 2 && layer.outPoint >= 17.8) layer.outPoint = 18
    }
  })
  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  return project
}

/** Gắn và đồng bộ 1 Node logic đơn nhiệm nối sau `upstreamNodeId`, trả về node vừa tạo. */
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

/** Gắn toàn bộ lưới uốn mềm, khung xương giải phẫu & trục gió cục bộ lên 3 cảnh. */
function applyAllDonghuaRigs(h: DonghuaStageHandles): void {
  // Cảnh 1
  applyCloakSilkSpines(h.s1HeroCloak, 0.9)
  applySwordsmanCalmRig(h.s1HeroCalm)
  applySwordTasselSpine(h.s1Sword)
  applyFlappingCraneClusterRig(h.s1CraneLead.body, h.s1CraneLead.wingNear, h.s1CraneLead.wingFar, { flapDuration: 0.72, phaseShift: 0 })
  applyFlappingCraneClusterRig(h.s1CraneMate.body, h.s1CraneMate.wingNear, h.s1CraneMate.wingFar, { flapDuration: 0.78, phaseShift: 0.36 })
  applyPeachBranchSpines(h.s1Peach)
  applyCliffPineSpines(h.s1Cliff)

  // Cảnh 2
  applyCloakSilkSpines(h.s2HeroCloak, 1.18)
  applySwordsmanCalmRig(h.s2HeroCalm)
  applySwordsmanFierceRig(h.s2HeroFierce)
  applySwordTasselSpine(h.s2Sword)
  applyWaterShimmerSpines(h.s2StreamShimmer)
  applyBambooWindSpines(h.s2Bamboo)

  // Cảnh 3
  applyMaidenPuppetRig(h.s3Maiden)
  applyWaterShimmerSpines(h.s3WaterShimmer)
}

function wireScene1Logic(project: Project, h: DonghuaStageHandles): void {
  const heroLockId = v2ClusterLockId(h.s1HeroInst)
  const heroLock = project.workflow!.nodes.find((n) => n.id === heroLockId)
  if (heroLock) {
    attachExternalLayerToClusterV2(project, [h.s1Sword.id], heroLock)
    updateClusterMemberOffsetV2(project, h.s1HeroInst, h.s1Sword.id, { offsetX: 118, offsetY: 58, scalePct: 16, rotDeg: -38 })
  }
  project.workflow = syncWorkflowV2Graph(project, project.workflow)

  // Chuỗi 3 bước Kiếm Khách Cảnh 1: Xương Thở & Tay Áo -> B2 Ngự Phong -> B3 Mờ Dần Mở Màn
  const s1HeroRig = chainNode(
    project,
    heroLockId,
    'anim_fx',
    'v2:anim_fx:rig_idle',
    { animMode: 'rig_clip', rigActionPreset: 'idle', intensity: 1.0, timeStart: 0.1, timeEnd: 5.9 },
    'Hành động: Tụ Khí & Tay Áo Mềm'
  )
  const s1HeroMot = chainNode(
    project,
    s1HeroRig.id,
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: 145,
      bboxTargetY: -135,
      bboxTargetScalePct: 105,
      depthMode: 'depth_z',
      depthRefLayerId: h.s1Cliff.id,
      depthRelation: 'in_front',
      bboxStartZ: 196,
      bboxTargetZ: 175,
      timeStart: 0.3,
      timeEnd: 5.6
    },
    'Motion: Ngự Phong Đỉnh Mây'
  )
  chainNode(
    project,
    s1HeroMot.id,
    'fx',
    'v2:fx:fade_in_out',
    { animFxPreset: 'fadeInOut', loopFadeInSec: 0.45, loopFadeOutSec: 0.35, loopEndAction: 'fade_out', timeStart: 0, timeEnd: 6 },
    'FX: Hiện/Ẩn Mở Cảnh'
  )

  // Chuỗi Bạch Hạc Chính: B1 Xương Đập Cánh -> B2 Bay Vòng Cung -> B3 Hoà Sương
  const crane1Rig = chainNode(
    project,
    v2ClusterLockId(h.s1CraneLead.instId),
    'anim_fx',
    'v2:anim_fx:rig_action',
    { animMode: 'rig_clip', rigActionPreset: 'action', intensity: 1.0, timeStart: 0, timeEnd: 5.9 },
    'Hành động: Đập Cánh Lướt Mây'
  )
  const crane1Mot = chainNode(
    project,
    crane1Rig.id,
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'curved_arc',
      bboxTargetX: 390,
      bboxTargetY: 245,
      bboxTargetScalePct: 92,
      depthMode: 'keep',
      bboxStartZ: 430,
      bboxTargetZ: 475,
      timeStart: 0.05,
      timeEnd: 5.85
    },
    'Motion: Tiên Hạc Lướt Biển Mây'
  )
  chainNode(
    project,
    crane1Mot.id,
    'fx',
    'v2:fx:fade_in_out',
    { animFxPreset: 'fadeInOut', loopFadeInSec: 0.35, loopFadeOutSec: 0.4, loopEndAction: 'fade_out', timeStart: 0.05, timeEnd: 5.95 },
    'FX: Hoà Sương Biển Mây'
  )

  // Chuỗi Hạc Đôi Xa
  const crane2Rig = chainNode(
    project,
    v2ClusterLockId(h.s1CraneMate.instId),
    'anim_fx',
    'v2:anim_fx:rig_action',
    { animMode: 'rig_clip', rigActionPreset: 'action', intensity: 1.0, timeStart: 0, timeEnd: 5.9 },
    'Hành động: Đập Cánh Tầng Xa'
  )
  chainNode(
    project,
    crane2Rig.id,
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'curved_arc',
      bboxTargetX: -65,
      bboxTargetY: 345,
      bboxTargetScalePct: 90,
      depthMode: 'keep',
      bboxStartZ: 540,
      bboxTargetZ: 590,
      timeStart: 0,
      timeEnd: 5.9
    },
    'Motion: Hạc Đôi Tầng Xa'
  )

  // Mây trôi & Vật liệu cành đào / tán tùng tự nhiên
  chainNode(project, v2LayerNodeId(h.s1MistFar.id), 'action', 'v2:action:bbox_target', {
    motionMode: 'bbox', actionPreset: 'bbox_target', bboxPathType: 'shortest', bboxTargetX: 240, bboxTargetY: -102, bboxTargetScalePct: 105, depthMode: 'keep', bboxStartZ: 740, bboxTargetZ: 740, timeStart: 0, timeEnd: 6
  }, 'Motion: Mây Trôi Đỉnh Núi')
  chainNode(project, v2LayerNodeId(h.s1MistMid.id), 'action', 'v2:action:bbox_target', {
    motionMode: 'bbox', actionPreset: 'bbox_target', bboxPathType: 'shortest', bboxTargetX: -195, bboxTargetY: -220, bboxTargetScalePct: 106, depthMode: 'keep', bboxStartZ: 325, bboxTargetZ: 325, timeStart: 0, timeEnd: 6
  }, 'Motion: Sương Mù Khe Núi')
  chainNode(project, v2LayerNodeId(h.s1Peach.id), 'material', 'v2:material:foliage_bush', {})
}

function wireScene2Logic(project: Project, h: DonghuaStageHandles): void {
  const heroLockId = v2ClusterLockId(h.s2HeroInst)
  project.workflow = syncWorkflowV2Graph(project, project.workflow)

  // Node Bộ phận tự động chuyển Thần Thái Điềm Tĩnh -> Khai Phong Kiếm Ý tại 7.8s
  const hubRes = attachLogicNodeToLayerV2(project.workflow!, heroLockId, 'part_swap', 'v2:part_swap:part_group')
  project.workflow = syncWorkflowV2Graph(project, hubRes.workflow)
  const stanceChild = project.workflow.nodes.find(
    (n) =>
      n.params?.isPartChild &&
      n.params?.instanceId === h.s2HeroInst &&
      (n.params?.partGroupId === 'slot:stance' || n.params?.partGroupId === 'part-stance')
  )
  if (stanceChild) {
    stanceChild.title = 'Bộ phận: Thần thái — Khai Phong Kiếm Ý'
    syncWorkflowV2NodeToProject(project, stanceChild, {
      partActionMode: 'variant',
      swapSlot: 'stance',
      swapTargetLayerId: h.s2HeroFierce.id,
      swapVariant: h.s2HeroFierce.id,
      timeStart: 7.8,
      timeEnd: 11.7
    })
  }

  // Chuỗi 3 bước Kiếm Khách Cảnh 2: B1 Xương Võ Thế -> B2 Phi Thân Cầu Đá -> B3 Kiếm Khí Thanh Ngọc
  const s2HeroRig = chainNode(
    project,
    heroLockId,
    'anim_fx',
    'v2:anim_fx:rig_action',
    { animMode: 'rig_clip', rigActionPreset: 'action', intensity: 1.05, timeStart: 6.0, timeEnd: 11.8 },
    'Hành động: Võ Thế & Tà Áo Khai Phong'
  )
  const s2HeroMot = chainNode(
    project,
    s2HeroRig.id,
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: 115,
      bboxTargetY: 14,
      bboxTargetScalePct: 110,
      depthMode: 'depth_z',
      depthRefLayerId: h.s2Bridge.id,
      depthRelation: 'in_front',
      bboxStartZ: 226,
      bboxTargetZ: 135,
      timeStart: 6.3,
      timeEnd: 11.5
    },
    'Motion: Phi Thân Cầu Đá'
  )
  const s2HeroGlow = chainNode(
    project,
    s2HeroMot.id,
    'fx',
    'v2:fx:glow',
    { animFxPreset: 'neonBreathe', animFxColor: '#2dd4bf', intensity: 0.42, animFxThickness: 6, animFxSpeed: 1.5, timeStart: 7.6, timeEnd: 11.8 },
    'FX: Kiếm Khí Thanh Ngọc'
  )

  chainNode(
    project,
    v2LayerNodeId(h.s2Sword.id),
    'fx',
    'v2:fx:glow',
    { animFxPreset: 'neonBreathe', animFxColor: '#38bdf8', intensity: 0.48, animFxThickness: 5, animFxSpeed: 1.8, timeStart: 7.5, timeEnd: 11.4 },
    'FX: Hào Quang Linh Kiếm'
  )
  chainNode(
    project,
    v2LayerNodeId(h.s2SwordQi.id),
    'fx',
    'v2:fx:glow',
    { animFxPreset: 'neonBreathe', animFxColor: '#2dd4bf', intensity: 0.36, animFxThickness: 5, animFxSpeed: 2.0, timeStart: 7.75, timeEnd: 10.3 },
    'FX: Luồng Kiếm Khí Trảm'
  )
  chainNode(project, v2LayerNodeId(h.s2Mist.id), 'action', 'v2:action:bbox_target', {
    motionMode: 'bbox', actionPreset: 'bbox_target', bboxPathType: 'shortest', bboxTargetX: -235, bboxTargetY: 96, bboxTargetScalePct: 104, depthMode: 'keep', bboxStartZ: 540, bboxTargetZ: 540, timeStart: 6.0, timeEnd: 12.0
  }, 'Motion: Sương Bạc Trôi Trúc Lâm')
  chainNode(project, v2LayerNodeId(h.s2Bamboo.id), 'material', 'v2:material:foliage_bush', {})

  createTimeGroup(project, [s2HeroMot, s2HeroGlow], {
    title: 'Cao Trào Kiếm Khí Trúc Lâm',
    color: '#06b6d4',
    start: 6.3,
    end: 11.7
  })
}

function wireScene3Logic(project: Project, h: DonghuaStageHandles): void {
  const maidenLockId = v2ClusterLockId(h.s3MaidenInst)

  // Chuỗi 4 bước Cụm Thiếu Nữ Thuyền Sen: B1 Xương Dâng Đèn -> B2 Trôi Sông -> B3 Ánh Đèn Sen -> B4 Kết Phim
  const maidenRig = chainNode(
    project,
    maidenLockId,
    'anim_fx',
    'v2:anim_fx:rig_wave',
    { animMode: 'rig_clip', rigActionPreset: 'wave', intensity: 1.0, timeStart: 12.0, timeEnd: 18.0 },
    'Hành động: Dâng Đèn & Lụa Pibo'
  )
  const maidenMot = chainNode(
    project,
    maidenRig.id,
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: -38,
      bboxTargetY: -225,
      bboxTargetScalePct: 108,
      depthMode: 'keep',
      bboxStartZ: 194,
      bboxTargetZ: 150,
      timeStart: 12.1,
      timeEnd: 17.8
    },
    'Motion: Thuyền Sen Lướt Sông Sao'
  )
  const lotusLight = chainNode(
    project,
    maidenMot.id,
    'light',
    'v2:light:candle',
    { lightMode: 'candle', lightColor: '#f59e0b', intensity: 0.22, timeStart: 12.0, timeEnd: 18.0 },
    'Ánh sáng: Đèn Hoa Sen Ấm'
  )
  if (h.s3Maiden.virtualLight) {
    h.s3Maiden.virtualLight.originUV = [0.15, 0.54]
    h.s3Maiden.virtualLight.radius = 340
  }
  chainNode(
    project,
    lotusLight.id,
    'fx',
    'v2:fx:fade_in_out',
    { animFxPreset: 'fadeInOut', loopFadeInSec: 0.45, loopFadeOutSec: 0.55, loopEndAction: 'fade_out', timeStart: 12.0, timeEnd: 18.0 },
    'FX: Lắng Đọng Kết Phim'
  )

  const lanternFarMot = chainNode(
    project,
    v2LayerNodeId(h.s3LanternsFar.id),
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: 295,
      bboxTargetY: 225,
      bboxTargetScalePct: 90,
      depthMode: 'keep',
      bboxStartZ: 480,
      bboxTargetZ: 540,
      timeStart: 12.0,
      timeEnd: 18.0
    },
    'Motion: Đèn Trời Bay Ngân Hà'
  )
  chainNode(
    project,
    lanternFarMot.id,
    'fx',
    'v2:fx:glow',
    { animFxPreset: 'neonBreathe', animFxColor: '#f59e0b', intensity: 0.55, animFxThickness: 6, animFxSpeed: 1.2, timeStart: 12.0, timeEnd: 18.0 },
    'FX: Hào Quang Vàng Ấm'
  )

  const lanternFgMot = chainNode(
    project,
    v2LayerNodeId(h.s3LanternsFg.id),
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: -415,
      bboxTargetY: 235,
      bboxTargetScalePct: 104,
      depthMode: 'keep',
      bboxStartZ: -170,
      bboxTargetZ: -195,
      timeStart: 12.0,
      timeEnd: 18.0
    },
    'Motion: Đèn Hoa Đăng Tiền Cảnh'
  )
  chainNode(
    project,
    lanternFgMot.id,
    'fx',
    'v2:fx:glow',
    { animFxPreset: 'neonBreathe', animFxColor: '#fb923c', intensity: 0.52, animFxThickness: 6, animFxSpeed: 1.4, timeStart: 12.1, timeEnd: 17.9 },
    'FX: Ánh Lửa Hoa Đăng Ấm'
  )
  chainNode(project, v2LayerNodeId(h.s3Mist.id), 'action', 'v2:action:bbox_target', {
    motionMode: 'bbox', actionPreset: 'bbox_target', bboxPathType: 'shortest', bboxTargetX: 195, bboxTargetY: -102, bboxTargetScalePct: 105, depthMode: 'keep', bboxStartZ: 620, bboxTargetZ: 620, timeStart: 12.0, timeEnd: 18.0
  }, 'Motion: Khói Sương Sông Đêm')
}

/**
 * Dựng Dự Án Phim Mẫu 2 ("Vân Sơn Kiếm Khúc — Hoạt Ảnh Quốc Phong 2.5D"):
 * 3 cảnh 18s (6s/cảnh), rối cắt lớp nhiều bộ phận, xương uốn mềm 60fps & chuỗi Workflow V2 nguyên tử.
 */
export function buildDonghuaWorkflowV2Project(assetInputs: DonghuaAssetInput[] = DEFAULT_DONGHUA_ASSETS): Project {
  const { project, handles } = populateDonghuaStage(assetInputs)
  applyAllDonghuaRigs(handles)
  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  wireScene1Logic(project, handles)
  wireScene2Logic(project, handles)
  wireScene3Logic(project, handles)

  // Áp các chuyển động phối hợp (nhấp nhô Linh Kiếm, chém Kiếm Khí 7.8s, dập dềnh thuyền & đèn trời) sau bbox_target
  choreographSpiritSwordShot1(handles.s1Sword)
  choreographSpiritSwordShot2(handles.s2Sword, handles.s2SwordQi)
  choreographBoatWaveAndLanternSway(handles.s3Boat, handles.s3Maiden, handles.s3WaterShimmer, handles.s3LanternsFar, handles.s3LanternsFg)

  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  return repairDonghuaTiming(project)
}
