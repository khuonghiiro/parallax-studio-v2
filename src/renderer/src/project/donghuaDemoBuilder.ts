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
import { DEFAULT_DONGHUA_ASSETS, populateDonghuaStage, type DonghuaAssetInput } from './donghuaDemoScenes'

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

function wireScene1Logic(project: Project, h: ReturnType<typeof populateDonghuaStage>['handles']): void {
  const heroLockId = v2ClusterLockId(h.s1HeroInst)
  const heroLock = project.workflow!.nodes.find((n) => n.id === heroLockId)
  if (heroLock) {
    attachExternalLayerToClusterV2(project, [h.s1Sword.id], heroLock)
    updateClusterMemberOffsetV2(project, h.s1HeroInst, h.s1Sword.id, { offsetX: 185, offsetY: 62, scalePct: 48, rotDeg: -42 })
  }
  project.workflow = syncWorkflowV2Graph(project, project.workflow)

  // Chuỗi 3 bước Kiếm Khách Cảnh 1: Khoá cụm -> B1 Ngự Phong -> B2 Nhịp Nội Lực -> B3 Mờ Dần Mở Màn
  const s1HeroMot = chainNode(
    project,
    heroLockId,
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: 215,
      bboxTargetY: -102,
      bboxTargetScalePct: 108,
      depthMode: 'depth_z',
      depthRefLayerId: h.s1Cliff.id,
      depthRelation: 'in_front',
      bboxStartZ: 190,
      bboxTargetZ: 155,
      timeStart: 0.2,
      timeEnd: 5.6
    },
    'Motion: Ngự Phong Đỉnh Mây'
  )
  const s1HeroPulse = chainNode(
    project,
    s1HeroMot.id,
    'fx',
    'v2:fx:pulse_beat',
    { animFxPreset: 'pulse', intensity: 1.03, animFxCount: 3, timeStart: 0.4, timeEnd: 5.8 },
    'FX: Nhịp Thở Nội Lực'
  )
  chainNode(
    project,
    s1HeroPulse.id,
    'fx',
    'v2:fx:fade_in_out',
    { animFxPreset: 'fadeInOut', loopFadeInSec: 0.45, loopFadeOutSec: 0.35, loopEndAction: 'fade_out', timeStart: 0, timeEnd: 6 },
    'FX: Hiện/Ẩn Mở Cảnh'
  )

  // Chuỗi Bạch Hạc Cảnh 1: Layer -> B1 Bay Ngang Biển Mây -> B2 Mờ Dần
  const craneMot = chainNode(
    project,
    v2LayerNodeId(h.s1Crane.id),
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'curved_arc',
      bboxTargetX: 360,
      bboxTargetY: 255,
      bboxTargetScalePct: 92,
      depthMode: 'keep',
      bboxStartZ: 440,
      bboxTargetZ: 480,
      timeStart: 0.1,
      timeEnd: 5.8
    },
    'Motion: Hạc Trắng Lướt Mây'
  )
  chainNode(
    project,
    craneMot.id,
    'fx',
    'v2:fx:fade_in_out',
    { animFxPreset: 'fadeInOut', loopFadeInSec: 0.4, loopFadeOutSec: 0.4, loopEndAction: 'fade_out', timeStart: 0.1, timeEnd: 5.9 },
    'FX: Hoà Sương Biển Mây'
  )

  // Cành đào tiền cảnh: Vật liệu cành lá mềm -> Nhịp gió nhẹ
  const peachMat = chainNode(project, v2LayerNodeId(h.s1Peach.id), 'material', 'v2:material:foliage_bush', {})
  chainNode(
    project,
    peachMat.id,
    'fx',
    'v2:fx:pulse_beat',
    { animFxPreset: 'pulse', intensity: 1.04, animFxCount: 4, timeStart: 0.2, timeEnd: 5.8 },
    'FX: Gió Sớm Đong Đưa'
  )
}

function wireScene2Logic(project: Project, h: ReturnType<typeof populateDonghuaStage>['handles']): void {
  const heroLockId = v2ClusterLockId(h.s2HeroInst)
  const heroLock = project.workflow!.nodes.find((n) => n.id === heroLockId)
  if (heroLock) {
    attachExternalLayerToClusterV2(project, [h.s2Sword.id], heroLock)
    updateClusterMemberOffsetV2(project, h.s2HeroInst, h.s2Sword.id, { offsetX: 195, offsetY: 68, scalePct: 44, rotDeg: -42 })
  }
  project.workflow = syncWorkflowV2Graph(project, project.workflow)

  // Gắn node Bộ phận để tự động chuyển Thần Thái Điềm Tĩnh -> Khai Phong Kiếm Ý từ 7.8s
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

  // Chuỗi 3 bước Kiếm Khách Cảnh 2: B1 Phi Thân Qua Cầu -> B2 Hào Quang Kiếm Khí -> B3 Chấn Động
  const s2HeroMot = chainNode(
    project,
    heroLockId,
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: 165,
      bboxTargetY: -18,
      bboxTargetScalePct: 114,
      depthMode: 'depth_z',
      depthRefLayerId: h.s2Bridge.id,
      depthRelation: 'in_front',
      bboxStartZ: 220,
      bboxTargetZ: 130,
      timeStart: 6.3,
      timeEnd: 11.6
    },
    'Motion: Phi Thân Cầu Đá'
  )
  const s2HeroGlow = chainNode(
    project,
    s2HeroMot.id,
    'fx',
    'v2:fx:glow',
    { animFxPreset: 'neonBreathe', animFxColor: '#2dd4bf', intensity: 0.58, animFxThickness: 7, animFxSpeed: 1.5, timeStart: 7.6, timeEnd: 11.8 },
    'FX: Kiếm Khí Thanh Ngọc'
  )
  chainNode(
    project,
    s2HeroGlow.id,
    'fx',
    'v2:fx:pulse_beat',
    { animFxPreset: 'pulse', intensity: 1.05, animFxCount: 4, timeStart: 7.8, timeEnd: 11.7 },
    'FX: Chấn Động Kiếm Phong'
  )

  const bambooMat = chainNode(project, v2LayerNodeId(h.s2Bamboo.id), 'material', 'v2:material:foliage_bush', {})
  const bambooPulse = chainNode(
    project,
    bambooMat.id,
    'fx',
    'v2:fx:pulse_beat',
    { animFxPreset: 'pulse', intensity: 1.05, animFxCount: 5, timeStart: 6.4, timeEnd: 11.6 },
    'FX: Rừng Trúc Rung Chuyển'
  )

  // Nhóm Thời gian chung cho nhịp cao trào Cảnh 2
  createTimeGroup(project, [s2HeroMot, bambooPulse], {
    title: 'Cao Trào Kiếm Khí Trúc Lâm',
    color: '#06b6d4',
    start: 6.3,
    end: 11.7
  })
}

function wireScene3Logic(project: Project, h: ReturnType<typeof populateDonghuaStage>['handles']): void {
  // Chuỗi 3 bước Thiếu Nữ Thuyền Sen: B1 Trôi Sông -> B2 Ánh Đèn Hoa Sen Ấm -> B3 Lắng Đọng Kết Phim
  const maidenMot = chainNode(
    project,
    v2LayerNodeId(h.s3Maiden.id),
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: 125,
      bboxTargetY: -175,
      bboxTargetScalePct: 108,
      depthMode: 'keep',
      bboxStartZ: 190,
      bboxTargetZ: 145,
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
    { lightMode: 'candle', lightColor: '#fbbf24', intensity: 0.55, timeStart: 12.0, timeEnd: 18.0 },
    'Ánh sáng: Đèn Hoa Sen Ấm'
  )
  if (h.s3Maiden.virtualLight) {
    h.s3Maiden.virtualLight.originUV = [0.36, 0.72]
    h.s3Maiden.virtualLight.radius = 360
  }
  chainNode(
    project,
    lotusLight.id,
    'fx',
    'v2:fx:fade_in_out',
    { animFxPreset: 'fadeInOut', loopFadeInSec: 0.45, loopFadeOutSec: 0.55, loopEndAction: 'fade_out', timeStart: 12.0, timeEnd: 18.0 },
    'FX: Lắng Đọng Kết Phim'
  )

  // Chuỗi Đèn Trời Xa & Gần: B1 Bay Lên Ngân Hà -> B2 Hào Quang Vàng Ấm
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
      bboxTargetX: -395,
      bboxTargetY: 195,
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
    'v2:fx:pulse_beat',
    { animFxPreset: 'pulse', intensity: 1.04, animFxCount: 4, timeStart: 12.1, timeEnd: 17.9 },
    'FX: Nhịp Lửa Đèn Trời'
  )
}

/**
 * Dựng Dự Án Phim Mẫu 2 ("Vân Sơn Kiếm Khúc — Hoạt Ảnh Quốc Phong 2.5D"):
 * 3 cảnh 18s (6s/cảnh), dùng bộ ảnh vẽ mỹ thuật tách nền alpha-matte thật và chuỗi Workflow V2 nguyên tử.
 */
export function buildDonghuaWorkflowV2Project(assetInputs: DonghuaAssetInput[] = DEFAULT_DONGHUA_ASSETS): Project {
  const { project, handles } = populateDonghuaStage(assetInputs)
  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  wireScene1Logic(project, handles)
  wireScene2Logic(project, handles)
  wireScene3Logic(project, handles)
  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  return repairDonghuaTiming(project)
}
