import { resolveMotionMode } from '../../project/workflowMotionMode'
import type { WorkflowGraph, WorkflowNode } from '@shared/types'

export function workflowBboxEditTime(
  node: WorkflowNode,
  currentTime: number,
  playing: boolean,
  workflow?: WorkflowGraph
): number {
  const p = node.params
  if (p?.isCameraWaypoint && typeof p.timeStart === 'number') return p.timeStart
  if (!playing) {
    if (p?.logicCategory === 'action' && resolveMotionMode(p) !== 'cycle') return p.timeStart ?? 0
    if (workflow) {
      const edge = workflow.edges.find((e) => (e.fromNode === node.id || e.toNode === node.id) && !e.disabled)
      if (edge) {
        const otherId = edge.fromNode === node.id ? edge.toNode : edge.fromNode
        const otherNode = workflow.nodes.find((n) => n.id === otherId)
        if (otherNode?.params?.logicCategory === 'action' && resolveMotionMode(otherNode.params) !== 'cycle') {
          return otherNode.params.timeStart ?? 0
        }
      }
    }
  }
  return playing ? Math.round(currentTime * 12) / 12 : currentTime
}
