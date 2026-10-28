import { isDraft } from 'immer'
import type { Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import { getProjectAudioTracks } from './audioTracks'
import { deleteLayerEffect } from '../ui/timeline/timelineEffects'
import { removeCameraWaypoint } from '../ui/viewer/animateCamera/animateCameraRouteLogic'
import {
  bakeCustomMotionPathToScene,
  clearClusterRigKeysFromScene,
  clearPartPoseKeysFromLayers,
  getClusterMemberLayers
} from './workflowV2ClusterRigAndSwap'
import { clearBboxMotionKeysFromScene } from './workflowV2BboxMotionAndCollision'
import { syncWorkflowV2NodeToProject } from './workflowV2Mutations'
import { getNodeLogicCategory } from './workflowV2PhysicsAndValidation'
import { syncWorkflowV2Graph } from './workflowV2Sync'

/** Loại Node Logic gắn vào Layer (bỏ qua Root / Group / Layer / Camera / Khoá Cụm khung xương) */
export function logicCategoryOf(node: WorkflowNode): string | undefined {
  const cat = getNodeLogicCategory(node)
  return cat && cat !== 'camera' && cat !== 'cluster_lock' ? cat : undefined
}

const resolvedWorkflowCache = new WeakMap<Project, WorkflowGraph>()

/** Đồ thị Workflow V2 khớp dữ liệu Project hiện tại (giữ tham chiếu khi không đổi & cache theo tham chiếu Project) */
export function resolveWorkflowV2(project: Project): WorkflowGraph {
  if (!isDraft(project) && Object.isFrozen(project)) {
    const cached = resolvedWorkflowCache.get(project)
    if (cached) return cached
  }
  const next = syncWorkflowV2Graph(project, project.workflow)
  if (!isDraft(project) && Object.isFrozen(project)) {
    resolvedWorkflowCache.set(project, next)
  }
  return next
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
  const logic = workflow.nodes.filter((n) => logicCategoryOf(n) || n.params?.logicCategory === 'cluster_lock' || n.type === 'camera_director')
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
    bakeCustomMotionPathToScene(project, Array.from(targets), [], { nodeId: node.id })
    clearBboxMotionKeysFromScene(project, node.id)
    const compInstIds = Array.from(new Set(layers.map((l) => l.composite?.instanceId).filter((v): v is string => Boolean(v))))
    for (const instId of compInstIds) clearClusterRigKeysFromScene(getClusterMemberLayers(project, instId), node.id)
    return
  }
  if (cat === 'part_swap') {
    clearPartPoseKeysFromLayers(layers, node.id)
    if (project.workflow && node.params?.isPartChild && node.params?.partGroupId) {
      const hubId = node.params.hierarchyParentNodeId
      const hub = project.workflow.nodes.find((n) => n.id === hubId)
      if (hub && !node.id.match(/-t\d+(-\d+)?$/)) {
        const curHidden = hub.params?.hiddenPartGroupIds ?? []
        if (!curHidden.includes(node.params.partGroupId)) {
          hub.params = { ...hub.params, hiddenPartGroupIds: [...curHidden, node.params.partGroupId] }
        }
      }
    } else if (project.workflow && node.params?.isPartHub) {
      const childIds = new Set(
        project.workflow.nodes
          .filter((n) => n.params?.isPartChild && n.params?.hierarchyParentNodeId === node.id)
          .map((n) => n.id)
      )
      for (const cid of childIds) {
        clearPartPoseKeysFromLayers(project.layers, cid)
      }
      project.workflow.nodes = project.workflow.nodes.filter((n) => !childIds.has(n.id))
      project.workflow.edges = project.workflow.edges.filter((e) => !childIds.has(e.fromNode) && !childIds.has(e.toNode))
    }
    return
  }
  if (cat === 'rig_bone') {
    const compInstIds = Array.from(new Set(layers.map((l) => l.composite?.instanceId).filter((v): v is string => Boolean(v))))
    for (const instId of compInstIds) clearClusterRigKeysFromScene(getClusterMemberLayers(project, instId), node.id)
    return
  }
  if (cat === 'anim_fx') {
    const compInstIds = Array.from(new Set(layers.map((l) => l.composite?.instanceId).filter((v): v is string => Boolean(v))))
    for (const instId of compInstIds) clearClusterRigKeysFromScene(getClusterMemberLayers(project, instId), node.id)
    for (const l of layers) {
      const fxIds = (l.appliedEffects ?? []).filter((f) => f.category !== 'motion').map((f) => f.id)
      for (const fxId of fxIds) deleteLayerEffect(l, fxId)
    }
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
