import type { Project, WorkflowNode } from '@shared/types'
import { choreographCinematicCameraRoute } from '../animation/cinematicCameraRoute'
import { recordExplicitActionMode, type CameraActionMode } from '../ui/viewer/animateCamera/animateCameraActionModes'
import { createTimeGroup } from './workflowTimeGroups'
import {
  attachLogicNodeToLayerV2,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  v2LayerNodeId
} from './workflowV2Engine'
import {
  getImmortalSwordCameraBeats,
  populateImmortalSwordStage,
  type ImmortalSwordStageHandles
} from './immortalSwordDemoScenes'

function chainLayerLogic(
  project: Project,
  upstreamNodeId: string,
  category: Parameters<typeof attachLogicNodeToLayerV2>[2],
  presetId: string,
  params: Record<string, unknown>,
  title: string
): WorkflowNode {
  const res = attachLogicNodeToLayerV2(project.workflow!, upstreamNodeId, category, presetId, params, title)
  project.workflow = res.workflow
  const node = project.workflow.nodes.find((n) => n.id === res.createdNodeId)
  if (!node) throw new Error(`Không thể gắn node logic ${presetId} sau ${upstreamNodeId}`)
  syncWorkflowV2NodeToProject(project, node)
  return node
}

function wireImmortalWorkflowLogic(project: Project, h: ImmortalSwordStageHandles): void {
  project.workflow = syncWorkflowV2Graph(project)

  // Cảnh 1: Gió tiên đài cho dải lụa + nhịp thở kiếm tiên + hoà sương
  const s1CapeWind = chainLayerLogic(
    project, v2LayerNodeId(h.s1Cape.id), 'action', 'v2:action:wind',
    { actionPreset: 'wind', speed: 0.9, amount: 0.45, timeStart: 0, timeEnd: 4.5 },
    'Motion: Lụa Tiên Phiêu Vũ'
  )
  chainLayerLogic(
    project, s1CapeWind.id, 'fx', 'v2:fx:fade_in_out',
    { animFxPreset: 'fadeInOut', loopFadeInSec: 0.35, loopFadeOutSec: 0.25, timeStart: 0, timeEnd: 4.5 },
    'FX: Mờ Dần Chuyển Cảnh'
  )
  chainLayerLogic(
    project, v2LayerNodeId(h.s1Hero.id), 'action', 'v2:action:sway',
    { actionPreset: 'sway', speed: 0.65, amount: 0.22, timeStart: 0, timeEnd: 4.5 },
    'Motion: Tụ Khí Thanh Vân'
  )

  // Cảnh 2: Nhịp lướt ngự phong xuyên hành lang phối cảnh 1/(Z+d)
  chainLayerLogic(
    project, v2LayerNodeId(h.s2Hero.id), 'action', 'v2:action:float',
    { actionPreset: 'float', speed: 0.85, amount: 0.24, timeStart: 4.5, timeEnd: 9.0 },
    'Motion: Ngự Phong Hành Lang Sâu'
  )
  chainLayerLogic(
    project, v2LayerNodeId(h.s2Crane.id), 'action', 'v2:action:float',
    { actionPreset: 'float', speed: 1.15, amount: 0.36, timeStart: 4.5, timeEnd: 9.0 },
    'Motion: Linh Hạc Lướt Trăng'
  )

  // Cảnh 3: Oai áp Huyền Băng Cổ Long & Kiếm Khí Bán Nguyệt bùng nổ
  chainLayerLogic(
    project, v2LayerNodeId(h.s3Dragon.id), 'action', 'v2:action:sway',
    { actionPreset: 'sway', speed: 0.95, amount: 0.38, timeStart: 9.0, timeEnd: 13.5 },
    'Motion: Uy Áp Cổ Long'
  )
  chainLayerLogic(
    project, v2LayerNodeId(h.s3SlashVfx.id), 'fx', 'v2:fx:pulse',
    { animFxPreset: 'pulse', speed: 2.2, amount: 0.35, timeStart: 11.45, timeEnd: 13.45 },
    'FX: Xung Kích Kiếm Khí'
  )

  // Cảnh 4: Vạn Kiếm Quy Tông đồng bộ theo Node Time chung (13.5s .. 18.0s)
  const s4MainFloat = chainLayerLogic(
    project, v2LayerNodeId(h.s4SwordsMain.id), 'action', 'v2:action:float',
    { actionPreset: 'float', speed: 1.05, amount: 0.35, timeStart: 13.5, timeEnd: 18.0 },
    'Motion: Kiếm Trận Thăng Thiên'
  )
  chainLayerLogic(
    project, v2LayerNodeId(h.s4Cape.id), 'action', 'v2:action:wind',
    { actionPreset: 'wind', speed: 1.0, amount: 0.5, timeStart: 13.5, timeEnd: 18.0 },
    'Motion: Thiên Y Nghịch Phong'
  )
  const s4TargetIds = new Set([
    v2LayerNodeId(h.s4SwordsMain.id),
    v2LayerNodeId(h.s4SwordsLeft.id),
    v2LayerNodeId(h.s4SwordsRight.id),
    s4MainFloat.id
  ])
  const s4TargetNodes = project.workflow.nodes.filter((n) => s4TargetIds.has(n.id))
  createTimeGroup(project, s4TargetNodes, {
    title: 'Nhịp Vạn Kiếm Quy Tông (13.5s–18s)',
    color: '#a855f7',
    start: 13.5,
    end: 18.0
  })

  project.workflow = syncWorkflowV2Graph(project, project.workflow)
}

const EXPLICIT_ROUTE_BADGES: ReadonlyArray<[number, CameraActionMode]> = [
  [0.0, 'crane-up'],
  [2.7, 'crane-down'],
  [2.8, 'sweep-right'],
  [4.488, 'whip-pan'],
  [4.5, 'pan'],
  [5.4, 'push-in'],
  [6.3, 'push-in'],
  [7.2, 'push-in'],
  [7.3, 'low-angle'],
  [8.988, 'crane-up'],
  [9.0, 'orbit-left'],
  [10.05, 'push-in'],
  [11.1, 'orbit-right'],
  [11.2, 'pan'],
  [12.028, 'extreme-closeup'],
  [12.228, 'dutch-tilt'],
  [13.488, 'pull-out'],
  [13.5, 'low-angle'],
  [15.8, 'hero-low'],
  [15.9, 'corkscrew'],
  [18.0, 'pull-out']
]

/** Khôi phục nhãn động tác quay 3D và đồng bộ sơ đồ Workflow V2 sau khi nạp từ JSON. */
export function repairImmortalSwordTiming(project: Project): Project {
  project.comp.duration = 18
  project.comp.fps = 30
  for (const [t, mode] of EXPLICIT_ROUTE_BADGES) {
    recordExplicitActionMode(t, mode)
  }
  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  return project
}

/** Dựng bản gốc hoàn chỉnh của Mẫu 4: Thương Lan Kiếm Cảnh — Tiên Hiệp Điện Ảnh 2.5D. */
export function buildImmortalSwordMasterProject(): Project {
  const { project, handles } = populateImmortalSwordStage()
  wireImmortalWorkflowLogic(project, handles)
  choreographCinematicCameraRoute(project, getImmortalSwordCameraBeats(handles), { clearExisting: true })
  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  return repairImmortalSwordTiming(project)
}
