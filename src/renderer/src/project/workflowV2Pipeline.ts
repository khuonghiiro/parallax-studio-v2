import type { WorkflowEdge, WorkflowNode } from '@shared/types'

/** Vai trò nguyên tử duy nhất cho Node Hiệu ứng (tách bạch Hiện/Ẩn, Nhịp/Biến đổi, Phát sáng) */
export type FxAtomicRole = 'fade' | 'pulse' | 'glow'

const COMPOSABLE_CATEGORIES = new Set<string>([
  'loop_anim',
  'part_swap',
  'rig_bone',
  'material',
  'collision',
  'action',
  'anim_fx',
  'light',
  'cave',
  'fx',
  'audio'
])

const GLOW_PRESETS = new Set(['neonBreathe', 'neonBlink', 'neonFlicker', 'neonSolid'])
const PULSE_PRESETS = new Set(['popIn', 'pulse', 'shake', 'loop_rhythm', 'loop_flicker'])
const GLOW_KINDS = new Set(['bloom', 'blur', 'chromatic', 'vignette'])
const PULSE_KINDS = new Set(['wind_physics', 'particles'])

/** Kiểm tra Node có phải là Node Logic có thể nối chuỗi nối tiếp với nhau hay không */
export function isComposableLogicNode(node?: WorkflowNode): boolean {
  if (!node) return false
  if (node.type === 'scene_shot' || node.type === 'layer_assembly' || node.type === 'camera_director') {
    return false
  }
  return COMPOSABLE_CATEGORIES.has(node.params?.logicCategory ?? '')
}

/** Xác định vai trò nguyên tử duy nhất của Node Hiệu ứng (`fade` | `pulse` | `glow`) */
export function resolveFxAtomicRole(node?: WorkflowNode): FxAtomicRole {
  const p = node?.params
  if (!p) return 'fade'
  if (p.fxAtomicRole === 'fade' || p.fxAtomicRole === 'pulse' || p.fxAtomicRole === 'glow') {
    return p.fxAtomicRole
  }
  if (p.fxSubTab === 'pulse') return 'pulse'
  if (p.fxSubTab === 'glow') return 'glow'
  if (p.fxSubTab === 'opacity') return 'fade'
  if (p.fxKind && GLOW_KINDS.has(p.fxKind)) return 'glow'
  if (p.fxKind && PULSE_KINDS.has(p.fxKind)) return 'pulse'
  if (p.animFxPreset && GLOW_PRESETS.has(p.animFxPreset)) return 'glow'
  if (p.animFxPreset && PULSE_PRESETS.has(p.animFxPreset)) return 'pulse'
  if (p.loopRhythmMode && p.loopRhythmMode !== 'none') return 'pulse'
  return 'fade'
}

/** Chữ ký đơn nhiệm của Node để phân biệt rõ từng vai trò logic trên cùng 1 Layer */
export function resolveNodeAtomicSignature(node?: WorkflowNode): string {
  const cat = node?.params?.logicCategory
  if (!cat) return node?.type ?? 'unknown'
  if (cat === 'fx') return `fx:${resolveFxAtomicRole(node)}`
  return cat
}

/** Kiểm tra 2 Node Logic có trùng cùng vai trò đơn nhiệm khi gắn trực tiếp lên 1 Layer/Cụm hay không */
export function areAtomicNodesConflicting(a: WorkflowNode, b: WorkflowNode): boolean {
  return resolveNodeAtomicSignature(a) === resolveNodeAtomicSignature(b)
}

/** Lọc các cạnh điều phối luồng chính (bỏ qua cạnh disabled và cạnh nối cụm thời gian `time_range`) */
export function getPipelineFlowEdges(edges: WorkflowEdge[]): WorkflowEdge[] {
  return edges.filter((e) => !e.disabled && e.fromPort !== 'time_range')
}

function collectLayerAncestryTargets(
  parent: WorkflowNode,
  isSelfCollision: boolean
): { targets: string[]; shared: string[] } {
  const pCat = parent.params?.logicCategory
  if (!isSelfCollision && pCat === 'collision' && parent.params?.strikerLayerId) {
    return {
      targets: [parent.params.strikerLayerId],
      shared: parent.params.sharedLayerNodeIds ?? []
    }
  }
  return {
    targets: parent.params?.targetLayerIds ?? [],
    shared: parent.params?.sharedLayerNodeIds ?? (parent.type === 'layer_assembly' ? [parent.id] : [])
  }
}

function topologicalNodeOrder(nodes: WorkflowNode[], flowEdges: WorkflowEdge[]): WorkflowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of nodes) {
    inDegree.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of flowEdges) {
    if (!byId.has(e.fromNode) || !byId.has(e.toNode)) continue
    adj.get(e.fromNode)!.push(e.toNode)
    inDegree.set(e.toNode, (inDegree.get(e.toNode) ?? 0) + 1)
  }
  const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id)
  const ordered: WorkflowNode[] = []
  const seen = new Set<string>()
  while (queue.length > 0) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const node = byId.get(id)
    if (node) ordered.push(node)
    for (const nxt of adj.get(id) ?? []) {
      const nextDeg = (inDegree.get(nxt) ?? 0) - 1
      inDegree.set(nxt, nextDeg)
      if (nextDeg <= 0 && !seen.has(nxt)) queue.push(nxt)
    }
  }
  for (const n of nodes) {
    if (!seen.has(n.id)) ordered.push(n)
  }
  return ordered
}

/**
 * Lan truyền mục tiêu `targetLayerIds`, `instanceId` và đánh số bước pipeline `B1, B2, B3...`
 * xuyên suốt chuỗi Node Logic nối tiếp nhau (không giới hạn độ sâu).
 */
export function propagatePipelineTargetsAndSteps(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const flowEdges = getPipelineFlowEdges(edges)
  const ordered = topologicalNodeOrder(nodes, flowEdges)
  const incomingByTo = new Map<string, WorkflowEdge[]>()
  for (const e of flowEdges) {
    const list = incomingByTo.get(e.toNode) ?? []
    list.push(e)
    incomingByTo.set(e.toNode, list)
  }

  const updatedMap = new Map(nodes.map((n) => [n.id, n]))
  for (const raw of ordered) {
    const node = updatedMap.get(raw.id) ?? raw
    if (!isComposableLogicNode(node)) continue
    const inEdges = incomingByTo.get(node.id) ?? []
    if (inEdges.length === 0) continue

    const isCollision = node.params?.logicCategory === 'collision'
    const isPartChild = Boolean(node.params?.isPartChild)
    const preserveOwnTargets = isCollision || isPartChild
    let maxStep = 0
    let upstreamLogicId: string | undefined
    const targetSet = new Set<string>()
    const sharedSet = new Set<string>()
    let inheritedInstanceId = node.params?.instanceId
    let inheritedRootId = node.params?.rootLayerId

    for (const e of inEdges) {
      const parent = updatedMap.get(e.fromNode)
      if (!parent) continue
      if (isComposableLogicNode(parent)) {
        maxStep = Math.max(maxStep, parent.params?.pipelineStepIndex ?? 1)
        if (!upstreamLogicId) upstreamLogicId = parent.id
      }
      if (!preserveOwnTargets) {
        const { targets, shared } = collectLayerAncestryTargets(parent, isCollision)
        for (const tid of targets) targetSet.add(tid)
        for (const sid of shared) sharedSet.add(sid)
      }
      if (!inheritedInstanceId && parent.params?.instanceId) inheritedInstanceId = parent.params.instanceId
      if (!inheritedRootId && parent.params?.rootLayerId) inheritedRootId = parent.params.rootLayerId
    }

    const cur = node.params ?? {}
    const nextStep = maxStep + 1
    const nextTargets = preserveOwnTargets
      ? (cur.targetLayerIds ?? [])
      : (targetSet.size > 0 ? Array.from(targetSet) : (cur.targetLayerIds ?? []))
    const nextShared = preserveOwnTargets
      ? cur.sharedLayerNodeIds
      : (sharedSet.size > 0 ? Array.from(sharedSet) : cur.sharedLayerNodeIds)
    const sameTargets = JSON.stringify(nextTargets) === JSON.stringify(cur.targetLayerIds ?? [])
    if (
      sameTargets &&
      cur.pipelineStepIndex === nextStep &&
      cur.upstreamLogicNodeId === upstreamLogicId &&
      cur.instanceId === inheritedInstanceId &&
      cur.rootLayerId === inheritedRootId
    ) {
      continue
    }
    updatedMap.set(node.id, {
      ...node,
      params: {
        ...cur,
        targetLayerIds: nextTargets,
        ...(nextShared ? { sharedLayerNodeIds: nextShared } : {}),
        ...(inheritedInstanceId ? { instanceId: inheritedInstanceId } : {}),
        ...(inheritedRootId ? { rootLayerId: inheritedRootId } : {}),
        pipelineStepIndex: nextStep,
        upstreamLogicNodeId: upstreamLogicId
      }
    })
  }
  return nodes.map((n) => updatedMap.get(n.id) ?? n)
}

/**
 * Sắp xếp danh sách Node Logic theo đúng thứ tự thực thi DAG từ thượng nguồn xuống hạ nguồn,
 * đảm bảo Vật liệu (`material`) chạy trước Va chạm (`collision`).
 */
export function sortLogicNodesByPipelineOrder(logicNodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const flowEdges = getPipelineFlowEdges(edges)
  const prio = (n: WorkflowNode): number => {
    const cat = n.params?.logicCategory
    if (cat === 'material') return 0
    if (cat === 'collision') return 200
    return (n.params?.pipelineStepIndex ?? 1)
  }
  const byPrio = [...logicNodes].sort((a, b) => prio(a) - prio(b))
  return topologicalNodeOrder(byPrio, flowEdges)
}

/**
 * Khi xoá một Node ở giữa chuỗi pipeline (`A -> B -> C`), tự nối cầu `A -> C` nếu hợp lệ
 * để không làm đứt đoạn phần logic phía sau.
 */
export function bridgeRemovedPipelineNodeEdges(
  edges: WorkflowEdge[],
  removedNodeId: string,
  canBridge: (fromId: string, toId: string, port: WorkflowEdge['fromPort']) => boolean
): WorkflowEdge[] {
  const incoming = edges.filter((e) => e.toNode === removedNodeId && e.fromPort !== 'time_range')
  const outgoing = edges.filter((e) => e.fromNode === removedNodeId && e.fromPort !== 'time_range')
  const remaining = edges.filter((e) => e.fromNode !== removedNodeId && e.toNode !== removedNodeId)
  const hasEdge = (fromId: string, toId: string): boolean =>
    remaining.some((e) => e.fromNode === fromId && e.toNode === toId && e.fromPort !== 'time_range')

  for (const inc of incoming) {
    for (const out of outgoing) {
      if (inc.fromNode === out.toNode || hasEdge(inc.fromNode, out.toNode)) continue
      if (!canBridge(inc.fromNode, out.toNode, inc.fromPort)) continue
      remaining.push({
        id: `e-${inc.fromNode}-${out.toNode}`,
        fromNode: inc.fromNode,
        fromPort: inc.fromPort,
        toNode: out.toNode,
        toPort: out.toPort
      })
    }
  }
  return remaining
}
