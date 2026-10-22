import type { WorkflowGraph, WorkflowNode } from '@shared/types'
import { validateWorkflowConnection } from './workflowConnectionRules'

export function isWorkflowEntity(node: WorkflowNode): boolean {
  return node.type === 'layer_assembly' && !node.params?.logicId && !!node.params?.targetLayerIds?.length
}

/** Only real, enabled wires carry scope. Effect return wires are destinations, not upstream data. */
export function getWorkflowRouting(node: WorkflowNode, graph: WorkflowGraph) {
  const nodes = new Map(graph.nodes.map((item) => [item.id, item]))
  const edges = graph.edges.filter((edge) => {
    const from = nodes.get(edge.fromNode), to = nodes.get(edge.toNode)
    return from && to && (from.enabled || from.id === node.id) && (to.enabled || to.id === node.id)
      && validateWorkflowConnection(from, edge.fromPort, to, edge.toPort).valid
  })
  const layerIds = new Set<string>()
  const shotIds = new Set<string>()
  const visited = new Set<string>()
  const visit = (current: WorkflowNode) => {
    if (visited.has(current.id)) return
    visited.add(current.id)
    if (current.params?.shotId && current.params.shotId !== 'all') shotIds.add(current.params.shotId)
    if (isWorkflowEntity(current)) {
      current.params!.targetLayerIds!.forEach((id) => layerIds.add(id))
      return
    }
    for (const edge of edges.filter((item) => item.toNode === current.id)) {
      visit(nodes.get(edge.fromNode)!)
    }
  }
  // Entity output (actors_rig) and logic output -> entity both define an explicit target set.
  for (const edge of edges.filter((item) => item.fromNode === node.id)) {
    const target = nodes.get(edge.toNode)!
    if (isWorkflowEntity(target) && edge.toPort !== 'layers_tree') visit(target)
  }
  for (const edge of edges.filter((item) => item.toNode === node.id)) visit(nodes.get(edge.fromNode)!)
  const hasLayerRoute = !!node.params?.requireLayerConnection || graph.edges.some((edge) =>
    (edge.fromNode === node.id && nodes.get(edge.toNode) && isWorkflowEntity(nodes.get(edge.toNode)!)) ||
    (edge.toNode === node.id && nodes.get(edge.fromNode) && isWorkflowEntity(nodes.get(edge.fromNode)!)))
  return { layerIds: [...layerIds], shotIds: [...shotIds], hasLayerRoute }
}
