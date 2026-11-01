import type { Project, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { applyLayerShifts } from './layerTimeShift'
import { isTimeNode } from './workflowTiming'

type SyncNode = (project: Project, node: WorkflowNode, patch?: Partial<WorkflowNodeParams>) => void

const EPS = 1e-3

/** Các Node đang ăn theo Node Time `timeId` (dây `time_range` đang bật) */
export function timeGroupConsumers(project: Project, timeId: string): WorkflowNode[] {
  const wf = project.workflow
  if (!wf) return []
  const ids = new Set(wf.edges.filter(e => e.fromNode === timeId && e.fromPort === 'time_range' && !e.disabled).map(e => e.toNode))
  return wf.nodes.filter(n => ids.has(n.id))
}

/** Node Layer thật (không phải Group / Logic) và Layer mà nó đại diện */
function layerOfNode(project: Project, node: WorkflowNode) {
  if (node.type !== 'layer_assembly' || node.params?.groupKind || node.params?.logicCategory) return undefined
  const id = node.params?.targetLayerIds?.[0]
  return id ? project.layers.find(l => l.id === id) : undefined
}

/** Kiểm tra khoảng thời gian hợp lệ của một Node Time trong thời lượng dự án */
export function assertTimeRange(project: Project, start: number, end: number): void {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > project.comp.duration + EPS) {
    throw new Error('Khoảng Time không hợp lệ: phải nằm trong thời lượng dự án và điểm cuối lớn hơn điểm đầu.')
  }
}

/**
 * Lan truyền khoảng thời gian của Node Time tới mọi Node đang ăn theo nó:
 * - Layer có cùng độ dài với nhóm được DỜI NGUYÊN KHỐI (keyframe, hiệu ứng, âm thanh đi theo) thay vì chỉ cắt in/out.
 * - Mốc lộ trình Camera được xử lý trước theo thứ tự thời gian để các mốc sau dời theo đúng chuỗi.
 * - Sau đó mọi Node con được đồng bộ xuống dữ liệu thật qua `syncNode` (cùng đường với Timeline / MCP).
 */
export function syncTimeGroupConsumers(project: Project, timeNode: WorkflowNode, syncNode: SyncNode): void {
  if (!isTimeNode(timeNode)) return
  const start = timeNode.params?.timeStart ?? 0
  const end = timeNode.params?.timeEnd ?? project.comp.duration
  assertTimeRange(project, start, end)
  const consumers = timeGroupConsumers(project, timeNode.id)
  if (!consumers.length) return

  if (timeNode.enabled) {
    const shifts = new Map<string, number>()
    for (const node of consumers) {
      const layer = layerOfNode(project, node)
      if (!layer || layer.locked) continue
      const sameLength = Math.abs(layer.outPoint - layer.inPoint - (end - start)) < EPS
      const delta = start - layer.inPoint
      if (sameLength && Math.abs(delta) > EPS) shifts.set(layer.id, delta)
    }
    applyLayerShifts(project, shifts)
    const waypoints = consumers
      .filter((n) => n.params?.isCameraWaypoint)
      .sort((a, b) => (a.params?.waypointIndex ?? 0) - (b.params?.waypointIndex ?? 0))
    const rest = consumers.filter((n) => !n.params?.isCameraWaypoint)
    for (const node of [...waypoints, ...rest]) {
      const fresh = project.workflow?.nodes.find((n) => n.id === node.id) ?? node
      syncNode(project, fresh)
    }
  } else {
    // Khi Node Time TẮT: huỷ bỏ khoảng thời gian chung, hoàn trả mốc thời gian riêng (localTimeRange) cho từng consumer
    for (const node of consumers) {
      const shotId = node.params?.shotId
      const rootNode = shotId && project.workflow ? project.workflow.nodes.find((n) => n.id === `v2-root-${shotId}`) : undefined
      const defaultDuration = rootNode?.params?.timeEnd ?? project.comp.duration
      const local = node.params?.localTimeRange
      const localStart = local ? local.start : (rootNode?.params?.timeStart ?? 0)
      const localEnd = local ? local.end : defaultDuration

      const layer = layerOfNode(project, node)
      if (layer && !layer.locked) {
        layer.inPoint = Number(localStart.toFixed(2))
        layer.outPoint = Number(localEnd.toFixed(2))
      }

      if (project.workflow) {
        const idx = project.workflow.nodes.findIndex((n) => n.id === node.id)
        if (idx >= 0) {
          const cur = project.workflow.nodes[idx]
          project.workflow.nodes[idx] = {
            ...cur,
            params: {
              ...(cur.params ?? {}),
              timeStart: localStart,
              timeEnd: localEnd
            }
          }
        }
      }

      const fresh = project.workflow?.nodes.find((n) => n.id === node.id) ?? node
      syncNode(project, fresh)
    }
  }
}
