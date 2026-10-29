import type { WorkflowEdge, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'

export function workflowSourceOwners(id: string, byId: Map<string, WorkflowNode>, edges: WorkflowEdge[]): string[] {
  const owners = new Set<string>(), seen = new Set<string>()
  const pending = [id]
  while (pending.length) {
    const current = pending.pop()!
    if (seen.has(current)) continue
    seen.add(current)
    const node = byId.get(current)
    if (!node) continue
    if (node.params?.logicCategory === 'cluster_lock' ||
      (node.type === 'layer_assembly' && !node.params?.logicCategory && !node.params?.groupKind)) {
      owners.add(current)
    } else {
      pending.push(...edges.filter(e => e.toNode === current && !e.disabled && e.fromPort !== 'time_range').map(e => e.fromNode))
    }
  }
  return [...owners]
}

/** A chain starts after its predecessor finishes, while preserving its own duration. */
export function stepTimeParams(graph: WorkflowGraph | undefined, node: WorkflowNode, params: WorkflowNodeParams, seen = new Set<string>()): WorkflowNodeParams {
  const sharedEdge = graph?.edges.find(e => e.toNode === node.id && e.fromPort === 'time_range' && !e.disabled)
  const shared = sharedEdge && graph?.nodes.find(n => n.id === sharedEdge.fromNode && n.enabled)
  if (shared) return { ...params, timeStart: shared.params?.timeStart, timeEnd: shared.params?.timeEnd }
  if (params.localTimeRange) params = { ...params, timeStart: params.localTimeRange.start, timeEnd: params.localTimeRange.end }
  if (!graph || seen.has(node.id) || !['action', 'collision'].includes(params.logicCategory ?? '')) return params
  seen.add(node.id)
  const edge = graph.edges.find(e => e.toNode === node.id && !e.disabled &&
    ['motion_stream', 'vfx_stage'].includes(e.fromPort) &&
    graph.nodes.find(n => n.id === e.fromNode)?.params?.logicCategory === params.logicCategory)
  const previous = edge && graph.nodes.find(n => n.id === edge.fromNode)
  if (!previous) return params
  const upstream = stepTimeParams(graph, previous, previous.params ?? {}, seen)
  const timeStart = upstream.timeEnd ?? params.timeStart ?? 0
  const duration = Math.max(0.3, (params.timeEnd ?? timeStart + 3) - (params.timeStart ?? timeStart))
  return { ...params, timeStart, timeEnd: timeStart + duration }
}
