import { nanoid } from 'nanoid'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { resolvePartMotionTriggerWindow } from './workflowPartMotionTrigger'
import { stepTimeParams } from './workflowStepGraph'

/** Bảng màu nhận diện các nhóm Time chung (đủ tương phản trên cả Dark và Light Theme) */
export const TIME_GROUP_PALETTE = ['#06b6d4', '#f59e0b', '#a855f7', '#22c55e', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6'] as const

export const acceptsSharedTime = (node: WorkflowNode): boolean =>
  Boolean(node.params?.isCameraWaypoint) ||
  (!node.params?.groupKind &&
    !['time', 'material', 'cave', 'rig_bone'].includes(node.params?.logicCategory ?? '') &&
    ['layer_assembly', 'motion_choreography', 'physics_fx', 'audio_lipsync'].includes(node.type))

export const isTimeNode = (node: WorkflowNode): boolean => node.params?.logicCategory === 'time'

/** Màu nhận diện của một nhóm Time (Node Time cũ chưa có màu dùng màu cyan mặc định) */
export const timeGroupColor = (node?: WorkflowNode | null): string => node?.params?.timeGroupColor ?? TIME_GROUP_PALETTE[0]

/** Tên ngắn của nhóm Time để hiển thị trên chip (bỏ phần mô tả sau dấu `·`) */
export const timeGroupLabel = (node?: { title?: string } | null): string => (node?.title ?? 'Time').split('·')[0].trim() || 'Time'

export interface CreateTimeNodeOptions {
  start?: number
  end?: number
  title?: string
  color?: string
}

/** Tạo Node Time chung; tự chọn màu chưa dùng và tên nối tiếp (Time A, Time B…) để phân biệt nhiều nhóm */
export function createTimeNode(project: Project, opts: CreateTimeNodeOptions = {}): WorkflowNode {
  const existing = (project.workflow?.nodes ?? []).filter(isTimeNode)
  const used = new Set(existing.map((n) => n.params?.timeGroupColor))
  const color = opts.color ?? TIME_GROUP_PALETTE.find((c) => !used.has(c)) ?? TIME_GROUP_PALETTE[existing.length % TIME_GROUP_PALETTE.length]
  const letter = String.fromCharCode(65 + (existing.length % 26))
  const start = opts.start ?? 0
  const end = opts.end ?? project.comp.duration
  return {
    id: `time-${nanoid(8)}`,
    type: 'motion_choreography',
    title: opts.title ?? `Time ${letter} · Thời gian chung`,
    enabled: true,
    position: { x: 48, y: 16 },
    preset: 'shared_time',
    aiAgentRole: 'MotionChoreographyAgent',
    aiDirective: 'Chia sẻ khoảng thời gian qua cổng Time.',
    params: {
      logicCategory: 'time',
      logicId: 'logic-shared-time',
      timeStart: Number(start.toFixed(2)),
      timeEnd: Number(end.toFixed(2)),
      timeGroupColor: color
    }
  }
}

export function timeSource(workflow: WorkflowGraph | undefined, nodeId: string): WorkflowNode | undefined {
  const edge = workflow?.edges.find((e) => e.toNode === nodeId && e.fromPort === 'time_range' && !e.disabled)
  return edge ? workflow?.nodes.find((n) => n.id === edge.fromNode && n.enabled && isTimeNode(n)) : undefined
}

/** Node Time đang kết nối vào node này (kể cả khi Node Time đang bật hay tắt) */
export function timeGroupConnection(workflow: WorkflowGraph | undefined, nodeId: string): WorkflowNode | undefined {
  const edge = workflow?.edges.find((e) => e.toNode === nodeId && e.fromPort === 'time_range' && !e.disabled)
  return edge ? workflow?.nodes.find((n) => n.id === edge.fromNode && isTimeNode(n)) : undefined
}

/** Local timing stays on the consumer; only the evaluated copy inherits shared Time or Motion BBox trigger timing. */
export function effectiveTimeParams(project: Project, node: WorkflowNode, params: WorkflowNodeParams): WorkflowNodeParams {
  const source = timeSource(project.workflow, node.id)
  // Mốc lộ trình Camera hiển thị thời gian THẬT của keyframe Camera (đã được Node Time đẩy tới, có thể bị kẹp bởi mốc trước)
  if (source && !node.params?.isCameraWaypoint) {
    const start = source.params?.timeStart ?? 0
    const end = source.params?.timeEnd ?? project.comp.duration
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > project.comp.duration) {
      throw new Error('Time: khoảng thời gian phải nằm trong dự án và có điểm cuối lớn hơn điểm đầu.')
    }
    return { ...params, timeStart: start, timeEnd: end, duration: end - start }
  }

  const base = stepTimeParams(
    project.workflow,
    node,
    params.localTimeRange
      ? { ...params, timeStart: params.localTimeRange.start, timeEnd: params.localTimeRange.end }
      : params
  )

  if (base.logicCategory === 'part_swap' && !base.isPartHub) {
    const trig = resolvePartMotionTriggerWindow(project, node, base)
    if (trig.triggeredByMotion) {
      return {
        ...base,
        timeStart: trig.start,
        timeEnd: trig.end,
        duration: Number((trig.end - trig.start).toFixed(2)),
        partSwapHoldAfterEnd: base.partSwapHoldAfterEnd ?? true
      }
    }
  }

  return base
}

export function connectTimeNode(workflow: WorkflowGraph, sourceId: string, targetId: string): WorkflowGraph {
  const source = workflow.nodes.find((n) => n.id === sourceId)
  const target = workflow.nodes.find((n) => n.id === targetId)
  if (!source || !target || !isTimeNode(source) || !acceptsSharedTime(target)) {
    throw new Error('Time nối tới Layer, Motion, Animation, ánh sáng/FX, va chạm, âm thanh hoặc mốc lộ trình Camera; cấu trúc cảnh dùng phạm vi riêng.')
  }
  // Mốc lộ trình Camera lấy thời gian thật từ keyframe Camera nên không cần lưu khoảng riêng
  const keepLocal = (n: WorkflowNode): boolean => n.id !== targetId || Boolean(n.params?.localTimeRange) || Boolean(n.params?.isCameraWaypoint)
  const nodes = workflow.nodes.map((n) =>
    keepLocal(n)
      ? n
      : { ...n, params: { ...n.params, localTimeRange: { start: n.params?.timeStart ?? 0, end: n.params?.timeEnd ?? 1 } } }
  )
  return {
    ...workflow,
    nodes,
    edges: [
      ...workflow.edges.filter((e) => !(e.toNode === targetId && e.fromPort === 'time_range')),
      { id: `time-${sourceId}-${targetId}`, fromNode: sourceId, fromPort: 'time_range', toNode: targetId, toPort: 'time_range' }
    ]
  }
}
