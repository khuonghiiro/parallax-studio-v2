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
export type V2EdgeKind = 'hierarchy' | 'logic' | 'data' | 'camera' | 'time'

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
  if (edge.fromPort === 'time_range') return 'time'
  if (from.params?.logicCategory === 'material' && to.params?.logicCategory === 'collision') return 'data'
  if (from.params?.logicCategory === 'action' && to.params?.logicCategory === 'part_swap') return 'data'
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
  const laneX = Math.min(WF_V2_CAMERA_LANE_X, x1 - 56, x2 - 56)
  return roundedOrthogonal([[x1, y1], [laneX, y1], [laneX, y2], [x2, y2]], 14)
}

/**
 * Đường nối giữa 2 thẻ. `lane` (0..n) tách nhẹ kênh dọc khi nhiều dây cùng đổ vào 1 Node dùng chung
 * để các đoạn dọc không chồng khít lên nhau.
 */
/**
 * Tự động tính toán cổng kết nối thông minh 4 hướng (Trái / Phải / Trên / Dưới) cho Node Time:
 * - Chọn cổng tối ưu hướng thẳng về phía Node đối tác để không bao giờ bị xiên chéo,
 * - Bo góc 12px mượt mà (Orthogonal Rounded Step),
 * - Tách kênh song song khi nhiều dây cùng đổ vào một hướng.
 */
export function computeSmartTimeEdgeRoute(
  from: WorkflowNode,
  to: WorkflowNode,
  lane = 0
): { path: string; controlPoint: [number, number] } {
  const isFromTime = from.params?.logicCategory === 'time'
  const timeNode = isFromTime ? from : to
  const otherNode = isFromTime ? to : from
  const reverse = !isFromTime

  const timeW = WF_V2_NODE_W
  const timeH = WF_V2_NODE_H
  const otherW = WF_V2_NODE_W
  const otherH = WF_V2_NODE_H

  const timeCenter = { x: timeNode.position.x + timeW / 2, y: timeNode.position.y + timeH / 2 }
  const otherCenter = { x: otherNode.position.x + otherW / 2, y: otherNode.position.y + otherH / 2 }

  const dx = otherCenter.x - timeCenter.x
  const dy = otherCenter.y - timeCenter.y

  let pTime: [number, number]
  let pOther: [number, number]
  let points: [number, number][]
  let controlPoint: [number, number]

  // A. Node đối tác ở BÊN TRÁI của Node Time (ví dụ Camera Waypoint ở cột 48)
  if (dx < -timeW * 0.3) {
    pTime = [timeNode.position.x, Math.round(timeNode.position.y + timeH / 2)]
    pOther = [otherNode.position.x + otherW, Math.round(otherNode.position.y + WF_V2_PORT_Y)]
    const gap = pTime[0] - pOther[0]
    const channelX = Math.round(pOther[0] + Math.max(18, Math.min(gap - 18, gap * 0.5 + lane * 18)))
    points = [
      pTime,
      [channelX, pTime[1]],
      [channelX, pOther[1]],
      pOther
    ]
    controlPoint = [channelX, Math.round((pTime[1] + pOther[1]) / 2)]
  }
  // B. Node đối tác ở BÊN PHẢI của Node Time (ví dụ Layer 2.5D ở các cột bên phải)
  else if (dx > timeW * 0.3) {
    pTime = [timeNode.position.x + timeW, Math.round(timeNode.position.y + timeH / 2)]
    pOther = [otherNode.position.x, Math.round(otherNode.position.y + WF_V2_PORT_Y)]
    const gap = pOther[0] - pTime[0]
    const channelX = Math.round(pTime[0] + Math.max(18, Math.min(gap - 18, gap * 0.5 + lane * 22)))
    points = [
      pTime,
      [channelX, pTime[1]],
      [channelX, pOther[1]],
      pOther
    ]
    controlPoint = [Math.round(pOther[0] - 28), pOther[1]]
  }
  // C. Node đối tác ở THẲNG DƯỚI Node Time
  else if (dy > 0) {
    pTime = [Math.round(timeCenter.x + lane * 16), timeNode.position.y + timeH]
    pOther = [Math.round(otherCenter.x + lane * 16), otherNode.position.y]
    if (Math.abs(pOther[0] - pTime[0]) <= 8) {
      points = [pTime, pOther]
      controlPoint = [pTime[0], Math.round((pTime[1] + pOther[1]) / 2)]
    } else {
      const midY = Math.round((pTime[1] + pOther[1]) / 2)
      points = [
        pTime,
        [pTime[0], midY],
        [pOther[0], midY],
        pOther
      ]
      controlPoint = [Math.round((pTime[0] + pOther[0]) / 2), midY]
    }
  }
  // D. Node đối tác ở THẲNG TRÊN Node Time
  else {
    pTime = [Math.round(timeCenter.x + lane * 16), timeNode.position.y]
    pOther = [Math.round(otherCenter.x + lane * 16), otherNode.position.y + otherH]
    if (Math.abs(pOther[0] - pTime[0]) <= 8) {
      points = [pTime, pOther]
      controlPoint = [pTime[0], Math.round((pTime[1] + pOther[1]) / 2)]
    } else {
      const midY = Math.round((pTime[1] + pOther[1]) / 2)
      points = [
        pTime,
        [pTime[0], midY],
        [pOther[0], midY],
        pOther
      ]
      controlPoint = [Math.round((pTime[0] + pOther[0]) / 2), midY]
    }
  }

  const finalPoints = reverse ? [...points].reverse() : points
  const path = points.length === 2
    ? `M ${finalPoints[0][0]} ${finalPoints[0][1]} L ${finalPoints[1][0]} ${finalPoints[1][1]}`
    : roundedOrthogonal(finalPoints, 12)

  return { path, controlPoint }
}

export function buildEdgePath(from: WorkflowNode, to: WorkflowNode, kind: V2EdgeKind, style: 'smoothstep' | 'bezier', lane = 0): string {
  if (kind === 'camera') return buildCameraChainPath(from, to)
  if (kind === 'time' || from.params?.logicCategory === 'time' || to.params?.logicCategory === 'time') {
    return computeSmartTimeEdgeRoute(from, to, lane).path
  }
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
  const channel = Math.round(x1 + (x2 - x1) * 0.5 + lane * 22)
  return buildSmoothStepWirePath(x1, y1, x2, y2, Math.max(x1 + 18, Math.min(x2 - 18, channel)))
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
