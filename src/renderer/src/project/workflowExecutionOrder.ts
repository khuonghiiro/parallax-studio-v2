import type { WorkflowGraph, WorkflowNode } from '@shared/types'
import { CANONICAL_NODE_ORDER, WORKFLOW_NODE_SPECS } from './workflowCatalog'
import { validateWorkflowConnection } from './workflowConnectionRules'
import { isWorkflowEntity } from './workflowRouting'

function reachableNodes(graph: WorkflowGraph, nodes: WorkflowNode[], edges: WorkflowGraph['edges']): Set<string> {
  const roots = nodes.filter((node) => WORKFLOW_NODE_SPECS[node.type]?.inputs.length === 0)
  const queue = roots.filter((node) => graph.nodes.length === 1 || edges.some((edge) => edge.fromNode === node.id)).map((node) => node.id)
  const reached = new Set(queue)
  for (let index = 0; index < queue.length; index++) {
    for (const edge of edges) {
      if (edge.fromNode !== queue[index] || reached.has(edge.toNode)) continue
      reached.add(edge.toNode); queue.push(edge.toNode)
    }
  }
  return reached
}

function topologicalNodes(nodes: WorkflowNode[], edges: WorkflowGraph['edges'], reached: Set<string>): WorkflowNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const dependencies = edges.filter((edge) => reached.has(edge.fromNode) && reached.has(edge.toNode)
    && !(isWorkflowEntity(byId.get(edge.toNode)!) && ['motion_stream', 'vfx_stage', 'audio_mix'].includes(edge.toPort)))
  const degree = new Map([...reached].map((id) => [id, dependencies.filter((edge) => edge.toNode === id).length]))
  const order = (id: string) => CANONICAL_NODE_ORDER.indexOf(byId.get(id)!.type)
  const queue = [...reached].filter((id) => degree.get(id) === 0)
  const sorted: WorkflowNode[] = []
  while (queue.length) {
    queue.sort((a, b) => order(a) - order(b))
    const id = queue.shift()!
    sorted.push(byId.get(id)!)
    for (const edge of dependencies.filter((item) => item.fromNode === id)) {
      const next = degree.get(edge.toNode)! - 1
      degree.set(edge.toNode, next)
      if (next === 0) queue.push(edge.toNode)
    }
  }
  return sorted
}

/** Scene triggers activate directed flows. Invalid wires and cyclic processors never execute. */
export function resolveConnectedWorkflowNodes(graph: WorkflowGraph): { activeNodes: WorkflowNode[]; disconnectedNodes: WorkflowNode[] } {
  const nodes = graph.nodes.filter((node) => node.enabled)
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const edges = graph.edges.filter((edge) => {
    const from = byId.get(edge.fromNode), to = byId.get(edge.toNode)
    return from && to && validateWorkflowConnection(from, edge.fromPort, to, edge.toPort).valid
  })
  const activeNodes = topologicalNodes(nodes, edges, reachableNodes(graph, nodes, edges))
  const active = new Set(activeNodes.map((node) => node.id))
  return { activeNodes, disconnectedNodes: graph.nodes.filter((node) => !active.has(node.id)) }
}
