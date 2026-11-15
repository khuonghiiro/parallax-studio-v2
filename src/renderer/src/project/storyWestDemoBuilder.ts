import type { Project, WorkflowNode } from '@shared/types'
import { createTimeGroup } from './workflowTimeGroups'
import {
  attachLogicNodeToLayerV2,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  v2LayerNodeId
} from './workflowV2Engine'
import {
  populateStoryWestStage,
  type StoryWestStageHandles
} from './storyWestDemoScenes'

function chainStoryLogic(
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

function wireStoryWestWorkflowLogic(project: Project, h: StoryWestStageHandles): void {
  project.workflow = syncWorkflowV2Graph(project)

  // Cảnh 1: Cự thú gầm lắc + Gãi đầu ngơ ngác
  chainStoryLogic(
    project, v2LayerNodeId(h.s1Beast.id), 'action', 'v2:action:sway',
    { actionPreset: 'sway', speed: 1.4, amount: 0.25, timeStart: 0, timeEnd: 2.8 },
    'Motion: Cự Thú Rùng Mình'
  )
  chainStoryLogic(
    project, v2LayerNodeId(h.s1SkelConfused.id), 'action', 'v2:action:sway',
    { actionPreset: 'sway', speed: 1.1, amount: 0.18, timeStart: 2.8, timeEnd: 5.5 },
    'Motion: Gãi Đầu Ngơ Ngác'
  )

  // Cảnh 2: Uy áp sát khí của Đoàn Đường Tăng
  chainStoryLogic(
    project, v2LayerNodeId(h.s2CrewMenace.id), 'fx', 'v2:fx:pulse',
    { animFxPreset: 'pulse', speed: 1.2, amount: 0.06, timeStart: 11.6, timeEnd: 15.6 },
    'FX: Nhịp Thở Uy Áp Ác Ma'
  )

  // Cảnh 3: Tủi thân dưới đèn Spotlight & Con khỉ phát điên
  chainStoryLogic(
    project, v2LayerNodeId(h.s3SkelSpotlight.id), 'action', 'v2:action:sway',
    { actionPreset: 'sway', speed: 0.85, amount: 0.15, timeStart: 15.6, timeEnd: 18.7 },
    'Motion: Thút Thít Tủi Thân'
  )
  chainStoryLogic(
    project, v2LayerNodeId(h.s3WukongRage.id), 'fx', 'v2:fx:pulse',
    { animFxPreset: 'pulse', speed: 2.8, amount: 0.08, timeStart: 18.7, timeEnd: 21.8 },
    'FX: Xung Huyết Giận Điên'
  )

  // Cảnh 4: Hầu Vương chỉ bổng quát mắng
  chainStoryLogic(
    project, v2LayerNodeId(h.s4WukongPoint.id), 'action', 'v2:action:sway',
    { actionPreset: 'sway', speed: 1.2, amount: 0.16, timeStart: 21.8, timeEnd: 24.9 },
    'Motion: Chỉ Bổng Quát Tháo'
  )

  // Cảnh 5: Tách 2 Nhóm Time đúng 2 nhịp cốt truyện (Giải Thi Thuật 27.8–31.0s & Đập Kim Cô Bổng 31.0–34.0s)
  const s5ObserverBob = chainStoryLogic(
    project, v2LayerNodeId(h.s5SkelObserver.id), 'action', 'v2:action:float',
    { actionPreset: 'float', speed: 1.2, amount: 0.16, timeStart: 27.8, timeEnd: 31.0 },
    'Motion: Hóng Chuyện Tiền Cảnh'
  )
  const s5EscapeIds = new Set([
    v2LayerNodeId(h.s5SoulEscape.id),
    v2LayerNodeId('s5-s5-mid-cloud'),
    v2LayerNodeId('s5-s5-far-party'),
    v2LayerNodeId(h.s5SkelObserver.id),
    s5ObserverBob.id
  ])
  const s5EscapeNodes = project.workflow.nodes.filter((n) => s5EscapeIds.has(n.id))
  createTimeGroup(project, s5EscapeNodes, {
    title: 'Nhịp 10: Giải Thi Thuật 3 Tầng Z (27.8s–31.0s)',
    color: '#38bdf8',
    start: 27.8,
    end: 31.0
  })

  const s5SlamIds = new Set([
    v2LayerNodeId(h.s5StaffFg.id),
    v2LayerNodeId('s5-s5-empty-shell'),
    v2LayerNodeId('s5-s5-impact-sparks')
  ])
  const s5SlamNodes = project.workflow.nodes.filter((n) => s5SlamIds.has(n.id))
  createTimeGroup(project, s5SlamNodes, {
    title: 'Nhịp 11: Kim Cô Bổng Đập Tiền Cảnh (31.0s–34s)',
    color: '#facc15',
    start: 31.0,
    end: 34.0
  })
  void s5ObserverBob

  project.workflow = syncWorkflowV2Graph(project, project.workflow)
}

export function createFreshStoryWestProject(): Project {
  const { project, handles } = populateStoryWestStage()
  wireStoryWestWorkflowLogic(project, handles)
  return project
}

export function repairStoryWestTiming(project: Project): Project {
  project.comp.duration = Math.max(project.comp.duration, 34)
  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  return project
}
