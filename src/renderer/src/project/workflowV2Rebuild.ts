import type { Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import { getProjectAudioTracks } from './audioTracks'
import { removeCameraWaypoint } from '../ui/viewer/animateCamera/animateCameraRouteLogic'
import { syncWorkflowV2NodeToProject } from './workflowV2Mutations'
import { getNodeLogicCategory } from './workflowV2PhysicsAndValidation'
import { syncWorkflowV2Graph } from './workflowV2Sync'

/** Loại Node Logic gắn vào Layer (bỏ qua Root / Group / Layer / Camera) */
export function logicCategoryOf(node: WorkflowNode): string | undefined {
  const cat = getNodeLogicCategory(node)
  return cat && cat !== 'camera' ? cat : undefined
}

/** Đồ thị Workflow V2 khớp dữ liệu Project hiện tại (giữ tham chiếu khi không đổi) — dùng chung cho Timeline & Workflow */
export function resolveWorkflowV2(project: Project): WorkflowGraph {
  return syncWorkflowV2Graph(project, project.workflow)
}

/** Xếp lại toàn bộ không gian Workflow (tuỳ chọn bỏ ghim các thẻ đã kéo tay) */
export function relayoutWorkflowV2(project: Project, resetPins = true): WorkflowGraph {
  return syncWorkflowV2Graph(project, project.workflow, { relayout: true, resetPins })
}

/** Áp dụng các Node vật lý (Vật liệu trước, rồi Va chạm) xuống Project — đồng bộ idempotent */
export function applyWorkflowV2PhysicsNodes(project: Project, workflow: WorkflowGraph): void {
  for (const n of workflow.nodes) if (n.params?.logicCategory === 'material') syncWorkflowV2NodeToProject(project, n)
  for (const n of workflow.nodes) if (n.params?.logicCategory === 'collision') syncWorkflowV2NodeToProject(project, n)
}

/** Áp dụng toàn bộ Node Logic xuống Project theo đúng thứ tự phụ thuộc (Va chạm sau cùng vì đọc chất liệu) */
export function applyWorkflowV2ToProject(project: Project, workflow: WorkflowGraph): void {
  const logic = workflow.nodes.filter((n) => logicCategoryOf(n) || n.type === 'camera_director')
  for (const n of logic) if (n.params?.logicCategory !== 'collision') syncWorkflowV2NodeToProject(project, n)
  for (const n of logic) if (n.params?.logicCategory === 'collision') syncWorkflowV2NodeToProject(project, n)
}

/**
 * Gỡ hẳn hiệu ứng của một Node Logic khỏi Layer khi Node bị xoá (khác với tắt Node: tắt thì giữ cấu hình).
 * Sau khi gỡ, dữ liệu Layer không còn hiệu ứng nên Node không bị suy diễn hồi sinh ở Timeline / Workflow.
 */
export function detachWorkflowV2NodeFromProject(project: Project, node: WorkflowNode): void {
  if (node.type === 'camera_director' && node.params?.isCameraWaypoint) {
    removeCameraWaypoint(project, node.params.timeStart ?? 0)
    return
  }
  const cat = logicCategoryOf(node)
  if (!cat) return
  const targets = new Set(node.params?.targetLayerIds ?? [])
  const layers = project.layers.filter((l) => targets.has(l.id))
  if (cat === 'action') {
    for (const l of layers) l.motion = { enabled: false, type: 'none', speed: 1, amount: 0 }
    return
  }
  if (cat === 'audio') {
    const ids = new Set([...targets, ...layers.flatMap((l) => [l.composite?.instanceId, l.model3d?.instanceId]).filter((v): v is string => Boolean(v))])
    for (const tr of getProjectAudioTracks(project)) {
      if (tr.targetId && ids.has(tr.targetId)) {
        tr.targetId = undefined
        tr.targetType = undefined
        tr.targetName = undefined
      }
    }
    return
  }
  syncWorkflowV2NodeToProject(project, { ...node, enabled: false })
}
