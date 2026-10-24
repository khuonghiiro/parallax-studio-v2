import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from '@shared/types'
import { CANONICAL_NODE_ORDER, WORKFLOW_NODE_SPECS } from './workflowCatalog'
import { validateWorkflowConnection } from './workflowConnectionRules'
import { isWorkflowEntity } from './workflowRouting'

function isMainTargetHub(node: WorkflowNode): boolean {
  if (isWorkflowEntity(node)) return true
  if (node.params?.logicId) return false
  return node.type === 'camera_director' || node.type === 'scene_shot'
}

function reachableNodes(workflow: WorkflowGraph, enabled: WorkflowNode[], edges: WorkflowEdge[]) {
  const byId = new Map(enabled.map((n) => [n.id, n]))
  const roots = enabled.filter((node) => (WORKFLOW_NODE_SPECS[node.type]?.inputs.length ?? 0) === 0)
  const queue = roots
    .filter((node) => workflow.nodes.length === 1 || edges.some((edge) => edge.fromNode === node.id))
    .map((node) => node.id)
  const reachable = new Set<string>(queue)
  while (queue.length) {
    const id = queue.shift()!
    for (const edge of edges) {
      if (edge.fromNode === id && !reachable.has(edge.toNode)) {
        reachable.add(edge.toNode)
        queue.push(edge.toNode)
      }
    }
  }

  // Cho phép các Node chức năng đơn lẻ (logicId) nối trực tiếp VÀO một Node Chính đang hoạt động (Atomic -> Main Hub)
  const feedQueue = [...reachable].filter((id) => {
    const n = byId.get(id)
    return n ? isMainTargetHub(n) : false
  })
  while (feedQueue.length) {
    const targetId = feedQueue.shift()!
    for (const edge of edges) {
      if (edge.toNode === targetId && !reachable.has(edge.fromNode)) {
        const src = byId.get(edge.fromNode)
        if (src && Boolean(src.params?.logicId)) {
          reachable.add(src.id)
          feedQueue.push(src.id)
        }
      }
    }
  }
  return reachable
}

function validEdges(workflow: WorkflowGraph, byId: Map<string, WorkflowNode>): WorkflowEdge[] {
  return workflow.edges.filter((edge) => {
    const from = byId.get(edge.fromNode), to = byId.get(edge.toNode)
    return Boolean(from && to && validateWorkflowConnection(from, edge.fromPort, to, edge.toPort).valid)
  })
}

function hasCycle(startId: string, workflow: WorkflowGraph, edges: WorkflowEdge[]): boolean {
  const byId = new Map(workflow.nodes.map((node) => [node.id, node]))
  const seen = new Set<string>(), stack = [startId]
  while (stack.length) {
    const id = stack.pop()!
    for (const edge of edges) {
      const from = byId.get(edge.fromNode), to = byId.get(edge.toNode)
      if (edge.fromNode !== id || !from || !to || isWorkflowEntity(from) || isWorkflowEntity(to)) continue
      if (edge.toNode === startId) return true
      if (!seen.has(edge.toNode)) { seen.add(edge.toNode); stack.push(edge.toNode) }
    }
  }
  return false
}

export function resolveConnectedWorkflowNodes(workflow: WorkflowGraph) {
  const enabled = workflow.nodes.filter((node) => node.enabled)
  const byId = new Map(enabled.map((node) => [node.id, node]))
  const edges = validEdges(workflow, byId)
  const reachable = reachableNodes(workflow, enabled, edges)
  for (const id of [...reachable]) if (hasCycle(id, workflow, edges)) reachable.delete(id)
  const dependencies = edges.filter(
    (edge) =>
      reachable.has(edge.fromNode) &&
      reachable.has(edge.toNode) &&
      !(
        isWorkflowEntity(byId.get(edge.toNode)!) &&
        ['motion_stream', 'vfx_stage', 'audio_mix', 'actors_rig'].includes(edge.toPort)
      )
  )
  const inDegree = new Map([...reachable].map((id) => [id, 0]))
  const outgoing = new Map([...reachable].map((id) => [id, new Set<string>()]))
  for (const edge of dependencies) {
    if (outgoing.get(edge.fromNode)!.has(edge.toNode)) continue
    outgoing.get(edge.fromNode)!.add(edge.toNode)
    inDegree.set(edge.toNode, (inDegree.get(edge.toNode) ?? 0) + 1)
  }
  const order = (id: string) => {
    const node = byId.get(id)!
    return CANONICAL_NODE_ORDER.indexOf(node.type) * 1000 + workflow.nodes.indexOf(node)
  }
  const ready = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id).sort((a, b) => order(a) - order(b))
  const activeNodes: WorkflowNode[] = []
  while (ready.length) {
    const id = ready.shift()!
    activeNodes.push(byId.get(id)!)
    for (const next of outgoing.get(id) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 1) - 1)
      if (inDegree.get(next) === 0) ready.push(next)
    }
    ready.sort((a, b) => order(a) - order(b))
  }
  return { activeNodes, disconnectedNodes: workflow.nodes.filter((node) => !reachable.has(node.id)) }
}
