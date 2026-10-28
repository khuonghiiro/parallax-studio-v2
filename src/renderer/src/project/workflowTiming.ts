import { nanoid } from 'nanoid'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'

export const acceptsSharedTime = (node: WorkflowNode): boolean => !node.params?.groupKind && !['time', 'material', 'cave', 'rig_bone'].includes(node.params?.logicCategory ?? '') && ['layer_assembly', 'motion_choreography', 'physics_fx', 'audio_lipsync'].includes(node.type)

export const isTimeNode = (node: WorkflowNode): boolean => node.params?.logicCategory === 'time'

export function createTimeNode(project: Project): WorkflowNode {
  return { id: `time-${nanoid(8)}`, type: 'motion_choreography', title: 'Time · Thời gian chung',
    enabled: true, position: { x: 48, y: 16 }, preset: 'shared_time',
    aiAgentRole: 'MotionChoreographyAgent', aiDirective: 'Chia sẻ khoảng thời gian qua cổng Time.',
    params: { logicCategory: 'time', logicId: 'logic-shared-time', timeStart: 0,
      timeEnd: project.comp.duration, pinned: true } }
}

export function timeSource(workflow: WorkflowGraph | undefined, nodeId: string): WorkflowNode | undefined {
  const edge = workflow?.edges.find(e => e.toNode === nodeId && e.fromPort === 'time_range' && !e.disabled)
  return edge ? workflow?.nodes.find(n => n.id === edge.fromNode && n.enabled && isTimeNode(n)) : undefined
}

/** Local timing stays on the consumer; only the evaluated copy inherits the shared range. */
export function effectiveTimeParams(project: Project, node: WorkflowNode, params: WorkflowNodeParams): WorkflowNodeParams {
  const source = timeSource(project.workflow, node.id)
  if (!source) return params.localTimeRange ? { ...params, timeStart: params.localTimeRange.start, timeEnd: params.localTimeRange.end } : params
  const start = source.params?.timeStart ?? 0
  const end = source.params?.timeEnd ?? project.comp.duration
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > project.comp.duration) {
    throw new Error('Time: khoảng thời gian phải nằm trong dự án và có điểm cuối lớn hơn điểm đầu.')
  }
  return { ...params, timeStart: start, timeEnd: end, duration: end - start }
}

export function connectTimeNode(workflow: WorkflowGraph, sourceId: string, targetId: string): WorkflowGraph {
  const source = workflow.nodes.find(n => n.id === sourceId)
  const target = workflow.nodes.find(n => n.id === targetId)
  if (!source || !target || !isTimeNode(source) || !acceptsSharedTime(target)) {
    throw new Error('Time nối tới Layer, Motion, Animation, ánh sáng/FX, va chạm hoặc âm thanh; Camera và cấu trúc cảnh dùng lộ trình riêng.')
  }
  const nodes = workflow.nodes.map(n => n.id !== targetId || n.params?.localTimeRange ? n : { ...n, params: { ...n.params, localTimeRange: { start: n.params?.timeStart ?? 0, end: n.params?.timeEnd ?? 1 } } })
  return { ...workflow, nodes, edges: [...workflow.edges.filter(e => !(e.toNode === targetId && e.fromPort === 'time_range')),
    { id: `time-${sourceId}-${targetId}`, fromNode: sourceId, fromPort: 'time_range', toNode: targetId, toPort: 'time_range' }] }
}
