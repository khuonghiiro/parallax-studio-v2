import type { Project, WorkflowEdge, WorkflowGraph, WorkflowNode } from '@shared/types'
import { buildWorkflowV2SceneTree, reconcileWorkflowV2WithProject, syncWorkflowV2NodeToProject } from './workflowV2Engine'
import { layoutWorkflowV2Tree } from './workflowV2Layout'
import { getNodeLogicCategory, recomputeSharedLogicTargets } from './workflowV2PhysicsAndValidation'
import { isWorkflowV2Graph, workflowV2ScopeOf } from './workflowV2Scope'

const CAMERA_NODE_ID = 'v2-logic-camera'
const CAMERA_KEEP_KEYS = ['camPreset', 'enableDof', 'camShakeAmount', 'intensity'] as const

const isLayerNode = (n: WorkflowNode): boolean => n.type === 'layer_assembly' && !n.params?.groupKind

/** Loại Node Logic gắn vào Layer (bỏ qua Root / Group / Layer / Camera) */
export function logicCategoryOf(node: WorkflowNode): string | undefined {
  const cat = getNodeLogicCategory(node)
  return cat && cat !== 'camera' ? cat : undefined
}

/** Node Logic cũ còn ít nhất 1 Layer cha trong cây mới → được giữ lại cùng các dây nối hợp lệ */
function collectPreservedLogic(
  previous: WorkflowGraph,
  freshLayerIds: Set<string>
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const nodes: WorkflowNode[] = []
  const edges: WorkflowEdge[] = []
  for (const node of previous.nodes) {
    if (!logicCategoryOf(node)) continue
    const parentEdges = previous.edges.filter((e) => e.toNode === node.id && freshLayerIds.has(e.fromNode))
    if (parentEdges.length === 0) continue
    nodes.push(node)
    edges.push(...parentEdges)
  }
  const keptIds = new Set(nodes.map((n) => n.id))
  for (const e of previous.edges) {
    const bridge = keptIds.has(e.fromNode) && keptIds.has(e.toNode)
    if (bridge && !edges.some((x) => x.id === e.id)) edges.push(e)
  }
  return { nodes, edges }
}

/**
 * Gộp cây mới dựng với cấu hình người dùng của cây cũ:
 * - Node Logic cũ (Hành động, Vật liệu, Va chạm, Ánh sáng...) thay thế Node suy luận cùng loại trên cùng Layer.
 * - Giữ tham số Camera và trạng thái thu gọn của Group.
 */
export function mergePreservedWorkflowV2Logic(fresh: WorkflowGraph, previous: WorkflowGraph): WorkflowGraph {
  const freshLayerIds = new Set(fresh.nodes.filter(isLayerNode).map((n) => n.id))
  const preserved = collectPreservedLogic(previous, freshLayerIds)
  if (preserved.nodes.length === 0 && !previous.nodes.some((n) => n.id === CAMERA_NODE_ID || n.params?.groupKind)) {
    return fresh
  }
  const preservedIds = new Set(preserved.nodes.map((n) => n.id))
  const freshById = new Map(fresh.nodes.map((n) => [n.id, n]))

  // Gỡ dây Layer → Node suy luận bị trùng loại với Node đã được người dùng cấu hình
  const takenSlots = new Set(
    preserved.edges.map((e) => `${e.fromNode}|${logicCategoryOf(preserved.nodes.find((n) => n.id === e.toNode)!)}`)
  )
  let edges = fresh.edges.filter((e) => {
    if (preservedIds.has(e.toNode) || preservedIds.has(e.fromNode)) return false
    const target = freshById.get(e.toNode)
    const cat = target ? logicCategoryOf(target) : undefined
    return !(cat && takenSlots.has(`${e.fromNode}|${cat}`))
  })
  edges = [...edges, ...preserved.edges.filter((e) => !edges.some((x) => x.id === e.id))]

  const prevById = new Map(previous.nodes.map((n) => [n.id, n]))
  const nodes = fresh.nodes
    .filter((n) => !preservedIds.has(n.id))
    .filter((n) => !logicCategoryOf(n) || edges.some((e) => e.toNode === n.id))
    .map((n) => restoreUserState(n, prevById.get(n.id)))
  nodes.push(...preserved.nodes.map((n) => ({ ...n, position: { ...n.position } })))

  const synced = recomputeSharedLogicTargets(nodes, edges)
  return { ...fresh, nodes: layoutWorkflowV2Tree(synced, edges), edges }
}

function restoreUserState(node: WorkflowNode, prev?: WorkflowNode): WorkflowNode {
  if (!prev) return node
  if (node.id === CAMERA_NODE_ID) {
    const kept: Record<string, unknown> = {}
    for (const key of CAMERA_KEEP_KEYS) {
      if (prev.params?.[key] !== undefined) kept[key] = prev.params[key]
    }
    return { ...node, enabled: prev.enabled, params: { ...node.params, ...kept } }
  }
  if (node.params?.groupKind && prev.params?.collapsedGroup !== undefined) {
    return { ...node, params: { ...node.params, collapsedGroup: prev.params.collapsedGroup } }
  }
  return node
}

/**
 * Dựng lại cây Workflow V2 cho phạm vi cảnh `scope` mà KHÔNG làm mất cấu hình người dùng:
 * Node Va chạm mẫu chỉ được tự tạo khi bung cây lần đầu (chưa có cây cũ).
 */
export function rebuildWorkflowV2PreservingLogic(
  project: Project,
  scope: string,
  previous?: WorkflowGraph | null
): WorkflowGraph {
  const hasPrevious = isWorkflowV2Graph(previous)
  const fresh = buildWorkflowV2SceneTree(project, scope, { autoCollision: !hasPrevious })
  return hasPrevious ? mergePreservedWorkflowV2Logic(fresh, previous) : fresh
}

/**
 * Đồ thị Workflow V2 đúng cho phạm vi cảnh: cùng phạm vi → khớp lại theo Layer (giữ tham chiếu nếu không đổi);
 * khác phạm vi / chưa có cây → dựng lại nhưng giữ cấu hình Node Logic của người dùng.
 */
export function resolveWorkflowForScope(project: Project, scope: string): WorkflowGraph {
  const current = project.workflow
  if (isWorkflowV2Graph(current) && workflowV2ScopeOf(current) === scope) {
    return reconcileWorkflowV2WithProject(project, current, scope)
  }
  return rebuildWorkflowV2PreservingLogic(project, scope, isWorkflowV2Graph(current) ? current : undefined)
}

/** Áp dụng các Node vật lý (Vật liệu trước, rồi Va chạm) của cây xuống Project — đồng bộ idempotent */
export function applyWorkflowV2PhysicsNodes(project: Project, workflow: WorkflowGraph): void {
  for (const n of workflow.nodes) {
    if (n.params?.logicCategory === 'material') syncWorkflowV2NodeToProject(project, n)
  }
  for (const n of workflow.nodes) {
    if (n.params?.logicCategory === 'collision') syncWorkflowV2NodeToProject(project, n)
  }
}

/** Áp dụng toàn bộ cây xuống Project theo đúng thứ tự phụ thuộc (mọi Node, rồi Va chạm sau cùng) */
export function applyWorkflowV2ToProject(project: Project, workflow: WorkflowGraph): void {
  for (const n of workflow.nodes) {
    if (n.params?.logicCategory !== 'collision') syncWorkflowV2NodeToProject(project, n)
  }
  for (const n of workflow.nodes) {
    if (n.params?.logicCategory === 'collision') syncWorkflowV2NodeToProject(project, n)
  }
}

/**
 * Gỡ hiệu ứng của một Node Logic khỏi Project khi Node bị xoá khỏi cây
 * (đồng bộ như khi tắt Node) — tránh hiệu ứng "mồ côi" còn sót trên Layer và Timeline.
 */
export function detachWorkflowV2NodeFromProject(project: Project, node: WorkflowNode): void {
  if (!logicCategoryOf(node)) return
  syncWorkflowV2NodeToProject(project, { ...node, enabled: false })
}
