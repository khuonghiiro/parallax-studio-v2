import type { WorkflowNode } from '@shared/types'

export function workflowBboxEditTime(node: WorkflowNode, currentTime: number, playing: boolean): number {
  const p = node.params
  if (p?.isCameraWaypoint && typeof p.timeStart === 'number') return p.timeStart
  if (!playing && p?.logicCategory === 'action' && (p.motionMode === 'bbox' || p.actionPreset === 'bbox_target')) return p.timeStart ?? 0
  return playing ? Math.round(currentTime * 12) / 12 : currentTime
}
