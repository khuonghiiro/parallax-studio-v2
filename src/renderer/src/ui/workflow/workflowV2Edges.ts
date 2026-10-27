import type { WorkflowEdge, WorkflowNode } from '@shared/types'
import { WF_V2_CAMERA_LANE_X, WF_V2_NODE_H, WF_V2_NODE_W, isCameraChainEdge } from '../../project/workflowV2Engine'

/** Điểm neo cổng: giữa mép trái/phải của thẻ, ngang dòng tiêu đề */
export const WF_V2_PORT_Y = 22

/**
 * Loại dây để thể hiện logic bằng hình ảnh:
 * - `hierarchy`: cấu trúc Cảnh → Camera / Nhóm → Layer (nét trung tính)
 * - `logic`: Layer → Node Logic (màu theo loại logic)
 * - `data`: Vật liệu → Va chạm (nét đứt — truyền chất liệu)
 * - `camera`: Camera cảnh trước → Camera cảnh sau (làn chuyển cảnh bên trái)
 */
export type V2EdgeKind = 'hierarchy' | 'logic' | 'data' | 'camera'

/** Playback pulses describe active processing, independently of selection highlighting. */
export function isV2EdgeFlowing(
  edge: WorkflowEdge, from: WorkflowNode, to: WorkflowNode, kind: V2EdgeKind,
  active: Set<string>, time: number, playing: boolean,
  transition?: { start: number; end: number }
): boolean {
  if (!playing || edge.disabled || from.enabled === false || to.enabled === false) return false
  if (kind === 'camera') {
    const start = transition?.start ?? from.params?.timeEnd
    const end = transition?.end ?? to.params?.timeStart
    return start !== undefined && end !== undefined && end > start && time >= start && time < end
  }
  // A waypoint is driven by the camera clock; its preceding waypoint has already finished.
  if (to.params?.isCameraWaypoint) return active.has(to.id)
  return active.has(from.id) && active.has(to.id)
}

export function classifyV2Edge(edge: WorkflowEdge, from: WorkflowNode, to: WorkflowNode): V2EdgeKind {
  if (isCameraChainEdge(edge)) return 'camera'
  if (from.params?.logicCategory === 'material' && to.params?.logicCategory === 'collision') return 'data'
  if (to.params?.isCameraWaypoint) return 'logic'
  const toIsLogic = to.type !== 'scene_shot' && to.type !== 'layer_assembly' && to.type !== 'camera_director'
  return toIsLogic ? 'logic' : 'hierarchy'
}

function roundedOrthogonal(points: [number, number][], radius = 12): string {
  let d = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]
    const [cx, cy] = points[i]
    const [nx, ny] = points[i + 1]
    const r = Math.max(2, Math.min(radius, Math.hypot(cx - px, cy - py) / 2, Math.hypot(nx - cx, ny - cy) / 2))
    const inX = cx - Math.sign(cx - px) * r
    const inY = cy - Math.sign(cy - py) * r
    const outX = cx + Math.sign(nx - cx) * r
    const outY = cy + Math.sign(ny - cy) * r
    d += ` L ${inX} ${inY} Q ${cx} ${cy} ${outX} ${outY}`
  }
  const last = points[points.length - 1]
  return `${d} L ${last[0]} ${last[1]}`
}

/** Dây vuông bo góc chuẩn React Flow / n8n: ngang → dọc tại kênh `channelX` → ngang vào cổng đích */
export function buildSmoothStepWirePath(x1: number, y1: number, x2: number, y2: number, channelX: number): string {
  if (Math.abs(y2 - y1) <= 1 || x2 <= x1 + 16) return `M ${x1} ${y1} L ${x2} ${y2}`
  return roundedOrthogonal([[x1, y1], [channelX, y1], [channelX, y2], [x2, y2]])
}

export function buildBezierWirePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.5)
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

/** Dây Camera chuyển cảnh: rời cổng trái Camera cảnh trước → chạy dọc làn bên trái → vào cổng trái Camera cảnh sau */
export function buildCameraChainPath(from: WorkflowNode, to: WorkflowNode): string {
  const x1 = from.position.x - 8
  const y1 = from.position.y + WF_V2_PORT_Y
  const x2 = to.position.x - 8
  const y2 = to.position.y + WF_V2_PORT_Y
  return roundedOrthogonal([[x1, y1], [WF_V2_CAMERA_LANE_X, y1], [WF_V2_CAMERA_LANE_X, y2], [x2, y2]], 14)
}

/**
 * Đường nối giữa 2 thẻ. `lane` (0..n) tách nhẹ kênh dọc khi nhiều dây cùng đổ vào 1 Node dùng chung
 * để các đoạn dọc không chồng khít lên nhau.
 */
export function buildEdgePath(from: WorkflowNode, to: WorkflowNode, kind: V2EdgeKind, style: 'smoothstep' | 'bezier', lane = 0): string {
  if (kind === 'camera') return buildCameraChainPath(from, to)
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
  const channel = Math.round(x1 + (x2 - x1) * 0.5 + lane * 10)
  return buildSmoothStepWirePath(x1, y1, x2, y2, Math.max(x1 + 12, Math.min(x2 - 12, channel)))
}

/**
 * Dòng dõi của Node đang chọn: toàn bộ nhánh con phía dưới và chuỗi cha lên tới Root
 * (không đi theo dây Camera chuyển cảnh để không làm sáng cả các cảnh khác).
 */
export function computeV2Lineage(selectedNodeId: string | null, edges: WorkflowEdge[], rootIds: Set<string>): { nodeIds: Set<string>; edgeIds: Set<string>; active: boolean } {
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  if (!selectedNodeId || rootIds.has(selectedNodeId)) return { nodeIds, edgeIds, active: false }
  const tree = edges.filter((e) => !isCameraChainEdge(e))
  nodeIds.add(selectedNodeId)
  const down = [selectedNodeId]
  while (down.length) {
    const cur = down.shift()!
    for (const e of tree) {
      if (e.fromNode !== cur) continue
      edgeIds.add(e.id)
      if (!nodeIds.has(e.toNode)) {
        nodeIds.add(e.toNode)
        down.push(e.toNode)
      }
    }
  }
  const up = [selectedNodeId]
  const visited = new Set(up)
  while (up.length) {
    const cur = up.shift()!
    for (const e of tree) {
      if (e.toNode !== cur || visited.has(e.fromNode)) continue
      visited.add(e.fromNode)
      nodeIds.add(e.fromNode)
      edgeIds.add(e.id)
      up.push(e.fromNode)
    }
  }
  return { nodeIds, edgeIds, active: true }
}
