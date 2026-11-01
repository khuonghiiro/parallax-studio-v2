import type { Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import { snapToFrame } from '../animation/math'
import { connectTimeNode, createTimeNode, effectiveTimeParams, isTimeNode, timeSource, acceptsSharedTime, type CreateTimeNodeOptions } from './workflowTiming'
import { assertTimeRange, timeGroupConsumers } from './workflowTimeGroupSync'
import { syncWorkflowV2NodeToProject } from './workflowV2Mutations'
import { WF_V2_TIME_COL_X, findFreeV2Spot } from './workflowV2Layout'

/** Tóm tắt một nhóm Time chung để hiển thị trên làn thời gian, Inspector, Timeline và MCP */
export interface TimeGroupSummary {
  id: string
  title: string
  color: string
  start: number
  end: number
  enabled: boolean
  consumerIds: string[]
  layerIds: string[]
}

export const layerNodeIdOf = (layerId: string): string => `v2-layer-${layerId}`

const requireWorkflow = (project: Project): WorkflowGraph => {
  if (!project.workflow) throw new Error('Dự án chưa có Workflow V2.')
  return project.workflow
}

const requireTimeNode = (project: Project, timeId: string): WorkflowNode => {
  const node = requireWorkflow(project).nodes.find(n => n.id === timeId)
  if (!node || !isTimeNode(node)) throw new Error(`Không tìm thấy Node Time "${timeId}".`)
  return node
}

/** Danh sách các nhóm Time chung của dự án (sắp theo mốc bắt đầu) */
export function listTimeGroups(project: Project): TimeGroupSummary[] {
  const wf = project.workflow
  if (!wf) return []
  return wf.nodes
    .filter(isTimeNode)
    .map((n) => {
      const consumers = timeGroupConsumers(project, n.id)
      return {
        id: n.id,
        title: n.title,
        color: n.params?.timeGroupColor ?? '#06b6d4',
        start: n.params?.timeStart ?? 0,
        end: n.params?.timeEnd ?? project.comp.duration,
        enabled: n.enabled,
        consumerIds: consumers.map(c => c.id),
        layerIds: [...new Set(consumers.filter(c => c.type === 'layer_assembly' && !c.params?.logicCategory).flatMap(c => c.params?.targetLayerIds ?? []))]
      }
    })
    .sort((a, b) => a.start - b.start || a.title.localeCompare(b.title))
}

/** Node Time đang điều khiển Layer `layerId` (qua Node Layer của nó), nếu có */
export function timeGroupOfLayer(project: Project, layerId: string): WorkflowNode | undefined {
  return timeSource(project.workflow, layerNodeIdOf(layerId))
}

/** Chuẩn hoá danh sách đích: Layer ID → Node Layer, bỏ trùng, chỉ giữ Node nhận được Time */
export function resolveTimeTargets(project: Project, nodeIds: string[] = [], layerIds: string[] = []): WorkflowNode[] {
  const wf = requireWorkflow(project)
  // Layer đứng trước để làm mục neo khi tạo nhóm (camera / logic bám theo Layer)
  const ids = [...new Set([...layerIds.map(layerNodeIdOf), ...nodeIds])]
  const nodes = ids.map(id => wf.nodes.find(n => n.id === id)).filter((n): n is WorkflowNode => Boolean(n))
  return nodes.filter(acceptsSharedTime)
}

/**
 * Khoảng khởi tạo cho nhóm Time mới = khoảng của mục ĐẦU TIÊN được chọn (giống "căn theo clip neo" của các app dựng phim):
 * các mục còn lại ăn theo mục neo, nên chọn Layer trước rồi mới tới mốc Camera để camera bám theo Layer.
 */
function anchorRange(project: Project, nodes: WorkflowNode[]): { start: number; end: number } {
  const r = effectiveTimeParams(project, nodes[0], nodes[0].params ?? {})
  const start = Math.max(0, r.timeStart ?? 0)
  const end = Math.min(project.comp.duration, r.timeEnd ?? project.comp.duration)
  return end > start ? { start, end } : { start: 0, end: project.comp.duration }
}

/** Nối các Node đích vào Node Time rồi đồng bộ cả nhóm xuống dữ liệu thật (một lần, cùng một bước Undo) */
export function linkToTimeGroup(project: Project, timeId: string, targets: WorkflowNode[]): number {
  const time = requireTimeNode(project, timeId)
  let wf = requireWorkflow(project)
  let linked = 0
  for (const target of targets) {
    if (target.id === time.id || !acceptsSharedTime(target)) continue
    wf = connectTimeNode(wf, time.id, target.id)
    linked++
  }
  project.workflow = wf
  if (linked) syncWorkflowV2NodeToProject(project, requireTimeNode(project, timeId))
  return linked
}

/** Tạo nhóm Time mới từ các Node / Layer đang chọn; mặc định khoảng = khoảng của mục đầu tiên (mục neo) */
export function createTimeGroup(
  project: Project,
  targets: WorkflowNode[],
  opts: CreateTimeNodeOptions = {}
): WorkflowNode {
  const wf = requireWorkflow(project)
  const valid = targets.filter(acceptsSharedTime)
  const range = valid.length ? anchorRange(project, valid) : { start: 0, end: project.comp.duration }
  const start = snapToFrame(opts.start ?? range.start, project.comp.fps)
  const end = snapToFrame(opts.end ?? range.end, project.comp.fps)
  assertTimeRange(project, start, end)
  const node = createTimeNode(project, { ...opts, start, end })
  const anchor = valid[0]?.position
  const desired = { x: WF_V2_TIME_COL_X, y: anchor ? anchor.y : node.position.y }
  node.position = findFreeV2Spot(wf.nodes, wf.edges, node.id, desired)
  project.workflow = { ...wf, nodes: [...wf.nodes, node] }
  if (valid.length) linkToTimeGroup(project, node.id, valid)
  return requireTimeNode(project, node.id)
}

/** Tách các Node khỏi nhóm Time: gỡ dây rồi trả lại khoảng thời gian riêng của từng Node */
export function unlinkFromTimeGroup(project: Project, nodeIds: string[]): number {
  const wf = requireWorkflow(project)
  const ids = new Set(nodeIds)
  const removed = wf.edges.filter(e => e.fromPort === 'time_range' && ids.has(e.toNode))
  if (!removed.length) return 0
  project.workflow = { ...wf, edges: wf.edges.filter(e => !(e.fromPort === 'time_range' && ids.has(e.toNode))) }
  for (const id of new Set(removed.map(e => e.toNode))) {
    const node = project.workflow.nodes.find(n => n.id === id)
    if (node && !node.params?.isCameraWaypoint) syncWorkflowV2NodeToProject(project, node)
  }
  return removed.length
}

/** Đặt khoảng mới cho nhóm Time — mọi Layer, Logic và mốc lộ trình Camera đang nối sẽ ăn theo ngay */
export function setTimeGroupRange(project: Project, timeId: string, start: number, end: number): void {
  const fps = project.comp.fps
  const s = snapToFrame(start, fps)
  const e = snapToFrame(end, fps)
  assertTimeRange(project, s, e)
  const wf = requireWorkflow(project)
  project.workflow = {
    ...wf,
    nodes: wf.nodes.map(n => (n.id === timeId && isTimeNode(n) ? { ...n, params: { ...n.params, timeStart: s, timeEnd: e } } : n))
  }
  syncWorkflowV2NodeToProject(project, requireTimeNode(project, timeId))
}

/** Dời cả nhóm Time một khoảng `delta` giây (kẹp trong thời lượng dự án, giữ nguyên độ dài) */
export function shiftTimeGroup(project: Project, timeId: string, delta: number): number {
  const node = requireTimeNode(project, timeId)
  const start = node.params?.timeStart ?? 0
  const end = node.params?.timeEnd ?? project.comp.duration
  const clamped = Math.max(-start, Math.min(project.comp.duration - end, delta))
  if (Math.abs(clamped) > 1e-6) setTimeGroupRange(project, timeId, start + clamped, end + clamped)
  return clamped
}

/** Đổi tên / màu nhóm Time (không ảnh hưởng thời gian) */
export function updateTimeGroupMeta(project: Project, timeId: string, meta: { title?: string; color?: string }): void {
  requireTimeNode(project, timeId)
  const wf = requireWorkflow(project)
  project.workflow = {
    ...wf,
    nodes: wf.nodes.map(n =>
      n.id === timeId
        ? { ...n, title: meta.title?.trim() || n.title, params: { ...n.params, timeGroupColor: meta.color ?? n.params?.timeGroupColor } }
        : n
    )
  }
}
