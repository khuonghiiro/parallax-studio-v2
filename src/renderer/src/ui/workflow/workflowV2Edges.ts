import type { WorkflowEdge, WorkflowNode } from '@shared/types'
import { WF_V2_NODE_H, WF_V2_NODE_W } from '../../project/workflowV2Engine'

/** Điểm neo cổng: giữa mép trái/phải của thẻ, ngang dòng tiêu đề */
export const WF_V2_PORT_Y = 22

/**
 * Đường Smooth-Step bo góc chuẩn React Flow / n8n:
 * đi ngang từ cổng ra → rẽ dọc tại kênh `channelX` → rẽ ngang vào cổng đích.
 */
export function buildSmoothStepWirePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  channelX: number,
  cornerRadius = 12
): string {
  const dy = y2 - y1
  if (Math.abs(dy) <= 1 || x2 <= x1 + 16) return `M ${x1} ${y1} L ${x2} ${y2}`
  const dirY = dy > 0 ? 1 : -1
  const r = Math.max(
    3,
    Math.min(cornerRadius, Math.abs(channelX - x1) * 0.45, Math.abs(x2 - channelX) * 0.45, Math.abs(dy) * 0.45)
  )
  return [
    `M ${x1} ${y1}`,
    `L ${channelX - r} ${y1}`,
    `Q ${channelX} ${y1} ${channelX} ${y1 + dirY * r}`,
    `L ${channelX} ${y2 - dirY * r}`,
    `Q ${channelX} ${y2} ${channelX + r} ${y2}`,
    `L ${x2} ${y2}`
  ].join(' ')
}

export function buildBezierWirePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.5)
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

/** Đường nối giữa 2 thẻ (cùng cột: nối dọc từ đáy lên đỉnh; khác cột: smooth-step / bezier) */
export function buildEdgePath(from: WorkflowNode, to: WorkflowNode, style: 'smoothstep' | 'bezier'): string {
  if (Math.abs(from.position.x - to.position.x) < 40) {
    const cx = Math.round(from.position.x + WF_V2_NODE_W / 2)
    const down = to.position.y > from.position.y
    const y1 = down ? from.position.y + WF_V2_NODE_H : from.position.y
    const y2 = down ? to.position.y - 2 : to.position.y + WF_V2_NODE_H + 2
    return `M ${cx} ${y1} L ${cx} ${y2}`
  }
  const x1 = from.position.x + WF_V2_NODE_W + 6
  const y1 = from.position.y + WF_V2_PORT_Y
  const x2 = to.position.x - 8
  const y2 = to.position.y + WF_V2_PORT_Y
  if (style === 'bezier') return buildBezierWirePath(x1, y1, x2, y2)
  return buildSmoothStepWirePath(x1, y1, x2, y2, Math.round(x1 + (x2 - x1) * 0.5))
}

/**
 * Dòng dõi của Node đang chọn: toàn bộ nhánh con phía dưới và chuỗi cha lên tới Root
 * (dùng để làm nổi bật nhánh liên quan, làm mờ phần còn lại).
 */
export function computeV2Lineage(
  selectedNodeId: string | null,
  edges: WorkflowEdge[]
): { nodeIds: Set<string>; edgeIds: Set<string>; active: boolean } {
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  if (!selectedNodeId || selectedNodeId === 'v2-root-scene') return { nodeIds, edgeIds, active: false }
  nodeIds.add(selectedNodeId)
  const queue = [selectedNodeId]
  while (queue.length) {
    const cur = queue.shift()!
    for (const e of edges) {
      if (e.fromNode !== cur) continue
      edgeIds.add(e.id)
      if (!nodeIds.has(e.toNode)) {
        nodeIds.add(e.toNode)
        queue.push(e.toNode)
      }
    }
  }
  const up = [selectedNodeId]
  const visited = new Set(up)
  while (up.length) {
    const cur = up.shift()!
    for (const e of edges) {
      if (e.toNode !== cur || visited.has(e.fromNode)) continue
      visited.add(e.fromNode)
      nodeIds.add(e.fromNode)
      edgeIds.add(e.id)
      up.push(e.fromNode)
    }
  }
  return { nodeIds, edgeIds, active: true }
}
