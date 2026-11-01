import type { WorkflowGraph, WorkflowNode } from '@shared/types'

export const HANDLES: { key: 'nw' | 'ne' | 'sw' | 'se'; cls: string }[] = [
  { key: 'nw', cls: 'nw' },
  { key: 'ne', cls: 'ne' },
  { key: 'sw', cls: 'sw' },
  { key: 'se', cls: 'se' }
]

/**
 * Tìm Node Motion (`action`) đang gắn với Node hiện tại (hoặc chính nó nếu đang chọn Node Motion).
 */
export function resolveActiveMotionNode(
  workflow: WorkflowGraph,
  node: WorkflowNode,
  repLayerId?: string,
  clusterInstId?: string
): WorkflowNode | undefined {
  if (node.params?.logicCategory === 'action' || (!node.params?.logicCategory && node.type === 'motion_choreography')) {
    return node
  }
  // Nếu đang chọn Node Va chạm, tìm Node Motion của Chủ thể A (strikerLayerId)
  const lookupLayerId =
    node.params?.logicCategory === 'collision'
      ? (node.params?.strikerLayerId ?? node.params?.targetLayerIds?.[0])
      : repLayerId

  return workflow.nodes.find((n) => {
    if (n.params?.logicCategory !== 'action' && (n.params?.logicCategory || n.type !== 'motion_choreography')) return false
    if (clusterInstId && n.params?.instanceId === clusterInstId) return true
    if (lookupLayerId && n.params?.targetLayerIds?.includes(lookupLayerId)) return true
    return workflow.edges.some((e) => !e.disabled && e.fromNode === node.id && e.toNode === n.id)
  })
}
