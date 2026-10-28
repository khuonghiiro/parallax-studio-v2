import type { Project, WorkflowEdge, WorkflowGraph, WorkflowNode } from '@shared/types'
import { deriveLogicFromLayers } from './workflowV2Derive'
import { derivePhysicsLogic } from './workflowV2DerivePhysics'
import { layoutWorkflowV2Tree } from './workflowV2Layout'
import { getNodeLogicCategory, recomputeSharedLogicTargets } from './workflowV2PhysicsAndValidation'
import { isWorkflowV2Graph } from './workflowV2Scope'
import { buildV2Skeleton } from './workflowV2Skeleton'

export interface SyncWorkflowV2Options {
  /** Buộc xếp lại toàn bộ cây (nút "Sắp xếp" / "Đồng bộ") */
  relayout?: boolean
  /** Bỏ ghim mọi thẻ đã kéo tay trước khi xếp lại */
  resetPins?: boolean
}

const CAMERA_KEEP = ['camPreset', 'camShakeAmount', 'camShakeSpeed', 'intensity'] as const
const LEGACY_CAMERA_ID = 'v2-logic-camera'

const isLogicNode = (n: WorkflowNode): boolean => {
  const cat = getNodeLogicCategory(n)
  return Boolean(cat) && cat !== 'camera' && cat !== 'cluster_lock' && n.type !== 'camera_director'
}

/** Chuyển trạng thái người dùng (vị trí, thu gọn, ghim, cấu hình camera / cụm khoá) từ cây cũ sang bộ khung mới */
function carryUserState(node: WorkflowNode, prev: WorkflowNode | undefined, legacyCamera: WorkflowNode | undefined): WorkflowNode {
  const isParentCam = node.type === 'camera_director' && !node.params?.isCameraWaypoint
  const isClusterLock = node.params?.logicCategory === 'cluster_lock'
  const src = prev ?? (isParentCam ? legacyCamera : undefined)
  if (!src) return node
  const params = { ...node.params }
  if (src.params?.localTimeRange) params.localTimeRange = src.params.localTimeRange
  if (src.params?.collapsedGroup !== undefined && (node.params?.groupKind || isParentCam)) {
    params.collapsedGroup = src.params.collapsedGroup
  }
  if (isClusterLock) {
    if (src.params?.collapsedSubLayers !== undefined) params.collapsedSubLayers = src.params.collapsedSubLayers
    if (src.params?.rigActionPreset !== undefined) params.rigActionPreset = src.params.rigActionPreset
    if (src.params?.staggerPhase !== undefined) params.staggerPhase = src.params.staggerPhase
  }
  if (src.params?.pinned) params.pinned = true
  let enabled = node.enabled
  if (isParentCam) {
    for (const key of CAMERA_KEEP) if (src.params?.[key] !== undefined) (params as Record<string, unknown>)[key] = src.params[key]
    enabled = src.enabled
  }
  return { ...node, enabled, params, position: prev ? { ...prev.position } : node.position }
}

/** Node Logic của cây cũ được giữ lại (bỏ những Node mà toàn bộ Layer đích đã bị xoá khỏi dự án) */
function preservedLogic(
  project: Project,
  prev: WorkflowGraph,
  layerNodeIds: Set<string>,
  clusterLockIds: Set<string>
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const layerIds = new Set(project.layers.map((l) => l.id))
  const nodes = prev.nodes.filter((n) => {
    if (!isLogicNode(n)) return false
    const targets = n.params?.targetLayerIds ?? []
    return targets.length === 0 || targets.some((id) => layerIds.has(id))
  })
  const ids = new Set(nodes.map((n) => n.id))
  const edges = prev.edges.filter(
    (e) => ids.has(e.toNode) && (layerNodeIds.has(e.fromNode) || ids.has(e.fromNode) || clusterLockIds.has(e.fromNode))
  )
  return { nodes, edges }
}

const signature = (nodes: WorkflowNode[], edges: WorkflowEdge[]): string =>
  `${nodes.map((n) => `${n.id}:${n.params?.collapsedGroup ? 1 : 0}:${n.params?.collapsedSubLayers ? 1 : 0}`).sort().join(',')}|${edges.map((e) => `${e.id}:${e.disabled ? 1 : 0}`).sort().join(',')}`

/** Giữ lại trạng thái disabled trên các đường dây của cây cũ (bao gồm cả dây Layer -> Khoá Cụm đang tạm ngắt) */
function mergeDisabledEdges(
  skeletonEdges: WorkflowEdge[],
  prevEdges: WorkflowEdge[] | undefined,
  layerNodeIds: Set<string>,
  clusterLockIds: Set<string>
): WorkflowEdge[] {
  if (!prevEdges || prevEdges.length === 0) return skeletonEdges
  const disabledById = new Map<string, WorkflowEdge>()
  for (const pe of prevEdges) {
    if (pe.disabled) disabledById.set(pe.id, pe)
  }
  if (disabledById.size === 0) return skeletonEdges

  const out = skeletonEdges.map((se) => (disabledById.has(se.id) ? { ...se, disabled: true } : se))
  const existingIds = new Set(out.map((e) => e.id))
  for (const pe of disabledById.values()) {
    if (existingIds.has(pe.id)) continue
    if (layerNodeIds.has(pe.fromNode) && clusterLockIds.has(pe.toNode)) {
      out.push({ ...pe, disabled: true })
    }
  }
  return out
}

/**
 * Đồng bộ MỘT đồ thị Workflow V2 cho toàn dự án từ dữ liệu thật (Layer, Shot, Camera, Audio):
 * Timeline và Workflow cùng đọc đồ thị này nên thêm / sửa ở bên nào cũng hiện ở bên kia.
 * Trả về đúng tham chiếu cũ khi không có gì thay đổi để không phát sinh cập nhật thừa.
 */
export function syncWorkflowV2Graph(project: Project, previous?: WorkflowGraph | null, opts: SyncWorkflowV2Options = {}): WorkflowGraph {
  const prev = isWorkflowV2Graph(previous) ? previous : undefined
  const skeleton = buildV2Skeleton(project)
  const prevById = new Map((prev?.nodes ?? []).map((n) => [n.id, n]))
  const legacyCamera = prevById.get(LEGACY_CAMERA_ID)
  const layerNodeIds = new Set(skeleton.nodes.filter((n) => n.type === 'layer_assembly' && !n.params?.groupKind).map((n) => n.id))
  const clusterLockIds = new Set(skeleton.nodes.filter((n) => n.params?.logicCategory === 'cluster_lock').map((n) => n.id))
  const logic = prev ? preservedLogic(project, prev, layerNodeIds, clusterLockIds) : { nodes: [], edges: [] }
  const skeletonEdges = mergeDisabledEdges(skeleton.edges, prev?.edges, layerNodeIds, clusterLockIds)

  const derivedEffects = deriveLogicFromLayers(
    project,
    [...skeleton.nodes.map((n) => carryUserState(n, prevById.get(n.id), legacyCamera)), ...logic.nodes],
    [...skeletonEdges, ...logic.edges]
  )
  const derived = derivePhysicsLogic(project, derivedEffects.nodes, derivedEffects.edges)
  let nodes = recomputeSharedLogicTargets(derived.nodes, derived.edges)
  const nodeIds = new Set(nodes.map(n => n.id))
  const timingEdges = (prev?.edges ?? []).filter(e => e.fromPort === 'time_range' && nodeIds.has(e.fromNode) && nodeIds.has(e.toNode))
  const edges = [...derived.edges.filter(e => e.fromPort !== 'time_range'), ...timingEdges]
  if (opts.resetPins) nodes = nodes.map((n) => (n.params?.pinned ? { ...n, params: { ...n.params, pinned: undefined } } : n))
  if (!prev || opts.relayout || signature(nodes, edges) !== signature(prev.nodes, prev.edges)) {
    nodes = layoutWorkflowV2Tree(nodes, edges)
  }
  if (prev && !opts.relayout && JSON.stringify(nodes) === JSON.stringify(prev.nodes) && JSON.stringify(edges) === JSON.stringify(prev.edges)) {
    return prev
  }
  return {
    version: 1,
    id: 'wf-v2-project',
    name: 'Workflow V2 — Toàn dự án',
    presetId: 'v2_scene_hierarchy',
    description: 'Không gian chung: mỗi Cảnh là một cụm Root → Camera / Nhóm → Layer → Logic, nối nhau bằng dây Camera chuyển cảnh.',
    lastAppliedAt: prev?.lastAppliedAt,
    nodes,
    edges
  }
}
