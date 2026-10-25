import type { Layer, Project, Shot, WorkflowEdge, WorkflowGraph, WorkflowNode } from '@shared/types'
import {
  buildWorkflowV2SceneTree,
  classifyLayerGroupKind,
  collectRepresentativeLayers,
  getLayerDisplayName,
  getLayerX,
  getLayerY,
  getLayerZ,
  recomputeSharedLogicTargets
} from './workflowV2Engine'
import { WF_V2_COL_X, layoutWorkflowV2Tree } from './workflowV2Layout'
import {
  getShotTimeRange,
  isWorkflowV2Graph,
  normalizeWorkflowV2Scope,
  resolveGroupTimeRange,
  resolveLayerNodeTimeRange,
  resolveWorkflowV2ActiveShot,
  scopedWorkflowV2Layers,
  workflowV2RootTitle,
  workflowV2ScopeOf
} from './workflowV2Scope'

type RepItem = ReturnType<typeof collectRepresentativeLayers>[number]
type TimeRange = { start: number; end: number }

interface ReconcileCtx {
  project: Project
  activeShot?: Shot
  compDur: number
  shotRange: TimeRange
  repItems: RepItem[]
  repByNodeId: Map<string, RepItem>
}

const GROUP_META: Record<'group_3d' | 'group_25d' | 'group_env', { id: string; title: string }> = {
  group_3d: { id: 'v2-group-3d', title: 'Group Layer 3D & Lắp Ráp' },
  group_25d: { id: 'v2-group-25d', title: 'Group Layer 2.5D' },
  group_env: { id: 'v2-group-env', title: 'Group Không Gian & Bầu Trời' }
}

const isLayerNode = (n: WorkflowNode): boolean =>
  n.type === 'layer_assembly' && !n.params?.groupKind && n.id.startsWith('v2-layer-')

function makeEdge(fromNode: string, toNode: string, port: 'scene_ctx' | 'layers_tree'): WorkflowEdge {
  return { id: `e-${fromNode}-${toNode}`, fromNode, fromPort: port, toNode, toPort: port }
}

function makeGroupNode(ctx: ReconcileCtx, kind: keyof typeof GROUP_META, item: RepItem): WorkflowNode {
  const meta = GROUP_META[kind]
  return {
    id: meta.id,
    type: 'layer_assembly',
    title: meta.title,
    enabled: true,
    position: { x: WF_V2_COL_X.GROUP, y: 100 },
    preset: 'character_prop_cluster',
    aiAgentRole: 'AssemblyRigAgent',
    aiDirective: meta.title,
    params: {
      shotId: ctx.activeShot?.id,
      groupKind: kind,
      isAssemblyRoot: true,
      childLayerCount: 1,
      targetMode: 'custom',
      targetLayerIds: item.memberIds,
      timeStart: ctx.shotRange.start,
      timeEnd: ctx.shotRange.end,
      hierarchyParentNodeId: 'v2-root-scene'
    }
  }
}

function makeLayerNode(ctx: ReconcileCtx, item: RepItem, groupId: string): WorkflowNode {
  const l = item.layer
  const { start, end } = resolveLayerNodeTimeRange(l, ctx.compDur)
  const displayTitle = getLayerDisplayName(l)
  return {
    id: `v2-layer-${l.id}`,
    type: 'layer_assembly',
    title: displayTitle,
    enabled: l.visible !== false,
    position: { x: WF_V2_COL_X.LAYER, y: 100 },
    preset: 'character_prop_cluster',
    aiAgentRole: 'AssemblyRigAgent',
    aiDirective: `Layer "${displayTitle}" hoạt động từ ${start}s đến ${end}s.`,
    params: {
      shotId: ctx.activeShot?.id,
      targetMode: 'custom',
      targetLayerIds: item.memberIds,
      requireLayerConnection: true,
      assemblyKind: l.model3d ? 'model3d' : l.composite ? 'composite' : undefined,
      childLayerCount: item.memberIds.length,
      transformX: getLayerX(l),
      transformY: getLayerY(l),
      transformZ: getLayerZ(l),
      timeStart: start,
      timeEnd: end,
      hierarchyParentNodeId: groupId
    }
  }
}

/** Thêm / xoá Node Layer theo danh sách Layer thật của Project (bảo toàn Node Logic còn Layer cha) */
function reconcileLayerStructure(
  ctx: ReconcileCtx,
  workflow: WorkflowGraph
): { nodes: WorkflowNode[]; edges: WorkflowEdge[]; changed: boolean } {
  const existingLayerNodes = workflow.nodes.filter(isLayerNode)
  const existingIds = new Set(existingLayerNodes.map((n) => n.id))
  const changed =
    existingLayerNodes.length !== ctx.repItems.length ||
    ctx.repItems.some((it) => !existingIds.has(`v2-layer-${it.layer.id}`))
  if (!changed) return { nodes: workflow.nodes, edges: workflow.edges, changed: false }

  let nodes = workflow.nodes
  let edges = workflow.edges
  const removed = new Set(existingLayerNodes.filter((n) => !ctx.repByNodeId.has(n.id)).map((n) => n.id))
  if (removed.size > 0) {
    edges = edges.filter((e) => !removed.has(e.fromNode) && !removed.has(e.toNode))
    nodes = nodes.filter((n) => {
      if (removed.has(n.id)) return false
      if (n.params?.logicCategory && n.params.logicCategory !== 'camera') {
        return edges.some((e) => e.toNode === n.id)
      }
      return true
    })
  }

  for (const item of ctx.repItems) {
    const layerNodeId = `v2-layer-${item.layer.id}`
    if (existingIds.has(layerNodeId)) continue
    const kind = classifyLayerGroupKind(item.layer)
    const groupId = GROUP_META[kind].id
    if (!nodes.some((n) => n.id === groupId)) {
      nodes = [...nodes, makeGroupNode(ctx, kind, item)]
      edges = [...edges, makeEdge('v2-root-scene', groupId, 'scene_ctx')]
    }
    nodes = [...nodes, makeLayerNode(ctx, item, groupId)]
    edges = [...edges, makeEdge(groupId, layerNodeId, 'layers_tree')]
  }
  return { nodes, edges, changed: true }
}

/** Đồng bộ tiêu đề / bật-tắt / khoảng thời gian / toạ độ từ Layer thật lên Node Layer */
function reconcileLayerNodeProps(ctx: ReconcileCtx, node: WorkflowNode): WorkflowNode | null {
  const rep = ctx.repByNodeId.get(node.id)
  if (!rep) return null
  const l: Layer = rep.layer
  const want = resolveLayerNodeTimeRange(l, ctx.compDur)
  const wantTitle = getLayerDisplayName(l)
  const wantEnabled = l.visible !== false
  const [wantX, wantY, wantZ] = [getLayerX(l), getLayerY(l), getLayerZ(l)]
  const same =
    node.title === wantTitle &&
    node.enabled === wantEnabled &&
    Math.abs((node.params?.timeStart ?? 0) - want.start) <= 0.005 &&
    Math.abs((node.params?.timeEnd ?? 0) - want.end) <= 0.005 &&
    node.params?.transformX === wantX &&
    node.params?.transformY === wantY &&
    node.params?.transformZ === wantZ &&
    node.params?.childLayerCount === rep.memberIds.length
  if (same) return null
  return {
    ...node,
    title: wantTitle,
    enabled: wantEnabled,
    params: {
      ...node.params,
      targetLayerIds: rep.memberIds,
      childLayerCount: rep.memberIds.length,
      timeStart: want.start,
      timeEnd: want.end,
      transformX: wantX,
      transformY: wantY,
      transformZ: wantZ
    }
  }
}

function reconcileGroupNodeProps(ctx: ReconcileCtx, node: WorkflowNode): WorkflowNode | null {
  const items = ctx.repItems.filter((it) => classifyLayerGroupKind(it.layer) === node.params?.groupKind)
  const want = resolveGroupTimeRange(items.map((it) => it.layer), ctx.compDur, ctx.shotRange)
  const memberIds = items.flatMap((it) => it.memberIds)
  const same =
    node.params?.childLayerCount === items.length &&
    Math.abs((node.params?.timeStart ?? 0) - want.start) <= 0.005 &&
    Math.abs((node.params?.timeEnd ?? 0) - want.end) <= 0.005 &&
    [...(node.params?.targetLayerIds ?? [])].sort().join('|') === [...memberIds].sort().join('|')
  if (same) return null
  return {
    ...node,
    params: {
      ...node.params,
      childLayerCount: items.length,
      targetLayerIds: memberIds,
      timeStart: want.start,
      timeEnd: want.end
    }
  }
}

function reconcileRootNodeProps(ctx: ReconcileCtx, node: WorkflowNode): WorkflowNode | null {
  const wantTitle = workflowV2RootTitle(ctx.project, ctx.activeShot)
  const same =
    node.title === wantTitle &&
    node.params?.shotId === ctx.activeShot?.id &&
    Math.abs((node.params?.timeStart ?? 0) - ctx.shotRange.start) <= 0.005 &&
    Math.abs((node.params?.timeEnd ?? 0) - ctx.shotRange.end) <= 0.005
  if (same) return null
  return {
    ...node,
    title: wantTitle,
    params: {
      ...node.params,
      shotId: ctx.activeShot?.id,
      timeStart: ctx.shotRange.start,
      timeEnd: ctx.shotRange.end
    }
  }
}

/** Node Logic gắn riêng 1 Layer mà đang trùng khoảng thời gian cũ của Layer sẽ dịch theo khoảng mới */
function followLayerTimeShifts(nodes: WorkflowNode[], prevLayerTimes: Map<string, TimeRange>): WorkflowNode[] {
  if (prevLayerTimes.size === 0) return nodes
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return nodes.map((node) => {
    const sharedIds = node.params?.sharedLayerNodeIds
    if (sharedIds?.length !== 1 || !prevLayerTimes.has(sharedIds[0])) return node
    const prev = prevLayerTimes.get(sharedIds[0])!
    const parent = byId.get(sharedIds[0])
    const followsParent =
      Math.abs((node.params?.timeStart ?? 0) - prev.start) < 0.05 &&
      Math.abs((node.params?.timeEnd ?? 0) - prev.end) < 0.05
    if (!parent || !followsParent) return node
    return {
      ...node,
      params: { ...node.params, timeStart: parent.params?.timeStart, timeEnd: parent.params?.timeEnd }
    }
  })
}

/**
 * Đồng bộ hai chiều từ dữ liệu Project (Timeline / Inspector) ngược lên đồ thị Workflow V2 hiện có:
 * - Kéo thanh Layer trên Timeline (inPoint / outPoint), ẩn/hiện, đổi tên, đổi toạ độ X/Y/Z, thêm/xoá Layer
 *   → Node Layer, Group và Root tự cập nhật khớp 100%.
 * - Bảo toàn tất cả các Node Logic, Nhãn Vật liệu và Va chạm Vật lý mà người dùng đã cấu hình.
 * - Trả về đúng tham chiếu cũ khi không có gì thay đổi (không phát sinh cập nhật thừa).
 */
export function reconcileWorkflowV2WithProject(
  project: Project,
  workflow?: WorkflowGraph,
  shotScope?: string
): WorkflowGraph {
  if (!isWorkflowV2Graph(workflow)) return buildWorkflowV2SceneTree(project, shotScope)
  const scope = normalizeWorkflowV2Scope(project, shotScope ?? workflowV2ScopeOf(workflow))
  const activeShot = resolveWorkflowV2ActiveShot(project, scope)
  const repItems = collectRepresentativeLayers(scopedWorkflowV2Layers(project, activeShot))
  const ctx: ReconcileCtx = {
    project,
    activeShot,
    compDur: Math.max(1, project.comp.duration || 5),
    shotRange: getShotTimeRange(project, activeShot),
    repItems,
    repByNodeId: new Map(repItems.map((it) => [`v2-layer-${it.layer.id}`, it]))
  }

  const structure = reconcileLayerStructure(ctx, workflow)
  const prevLayerTimes = new Map<string, TimeRange>()
  let propChanged = false
  const updatedNodes = structure.nodes.map((node) => {
    let next: WorkflowNode | null = null
    if (node.type === 'scene_shot') next = reconcileRootNodeProps(ctx, node)
    else if (isLayerNode(node)) next = reconcileLayerNodeProps(ctx, node)
    else if (node.type === 'layer_assembly' && node.params?.groupKind) next = reconcileGroupNodeProps(ctx, node)
    if (!next) return node
    propChanged = true
    if (isLayerNode(node)) {
      prevLayerTimes.set(node.id, { start: node.params?.timeStart ?? 0, end: node.params?.timeEnd ?? 0 })
    }
    return next
  })

  if (!structure.changed && !propChanged) return workflow

  const synced = recomputeSharedLogicTargets(followLayerTimeShifts(updatedNodes, prevLayerTimes), structure.edges)
  return {
    ...workflow,
    targetShotId: activeShot?.id,
    nodes: structure.changed ? layoutWorkflowV2Tree(synced, structure.edges) : synced,
    edges: structure.edges
  }
}
