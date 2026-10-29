import type { WorkflowGraph, WorkflowNode } from '@shared/types'
import { stepTimeParams, workflowSourceOwners } from './workflowStepGraph'

export function isBboxStep(node: WorkflowNode): boolean {
  return node.params?.logicCategory === 'action' &&
    (node.params.motionMode === 'bbox' || node.params.actionPreset === 'bbox_target')
}

/** Number endpoints by graph ancestry, not by array order or editable titles. */
export function bboxStepNumber(graph: WorkflowGraph, nodeId: string, seen = new Set<string>()): number {
  if (seen.has(nodeId)) return 1
  seen.add(nodeId)
  const previous = graph.edges.find(e => !e.disabled && e.toNode === nodeId && e.fromPort === 'motion_stream' &&
    graph.nodes.some(n => n.id === e.fromNode && isBboxStep(n)))
  return previous ? bboxStepNumber(graph, previous.fromNode, seen) + 1 : 1
}

export function bboxStepsForLayer(graph: WorkflowGraph, layerId: string, instanceId?: string) {
  const byId = new Map(graph.nodes.map(n => [n.id, n]))
  return graph.nodes.filter(n => isBboxStep(n) && (
    n.params?.targetLayerIds?.includes(layerId) ||
    (instanceId && n.params?.instanceId === instanceId) ||
    workflowSourceOwners(n.id, byId, graph.edges).some(id => byId.get(id)?.params?.targetLayerIds?.includes(layerId))
  )).map(node => ({ node, number: bboxStepNumber(graph, node.id), timing: stepTimeParams(graph, node, node.params ?? {}) }))
    .sort((a, b) => (a.timing.timeStart ?? 0) - (b.timing.timeStart ?? 0) || a.node.id.localeCompare(b.node.id))
}
