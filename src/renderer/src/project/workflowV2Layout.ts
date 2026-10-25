import type { WorkflowEdge, WorkflowNode } from '@shared/types'

/** Trục X của 4 cột phân cấp: Root/Camera → Nhóm → Layer → Logic (khoảng hở 120px để dây nối dễ nhìn) */
export const WF_V2_COL_X = {
  ROOT: 48,
  GROUP: 404,
  LAYER: 760,
  LOGIC: 1116
} as const

/** Làn dọc bên trái cột Root dành riêng cho dây Camera chuyển cảnh */
export const WF_V2_CAMERA_LANE_X = 18

/** Kích thước thẻ Node cố định (CSS `.wf-v2-card` dùng đúng các giá trị này) */
export const WF_V2_NODE_W = 236
export const WF_V2_NODE_H = 64
/** Khoảng đệm tối thiểu giữa 2 thẻ (dùng cho tự xếp & chống đè khi kéo thả) */
export const WF_V2_NODE_GAP = 16

export const WF_V2_CLUSTER_HEADER = 34
const TOP_Y = 96
const LOGIC_GAP = 18
const LAYER_GAP = 30
const GROUP_GAP = 44
const CLUSTER_GAP = 76

/** Chiều cao chuẩn của mọi thẻ Workflow V2 (thẻ có chiều cao cố định để bố cục & hit-test chính xác) */
export function estimateV2NodeHeight(_node?: WorkflowNode): number {
  return WF_V2_NODE_H
}

const isRoot = (n: WorkflowNode): boolean => n.type === 'scene_shot'
const isGroup = (n: WorkflowNode): boolean => Boolean(n.params?.groupKind)
const isLayer = (n: WorkflowNode): boolean => n.type === 'layer_assembly' && !n.params?.groupKind
const isCamera = (n: WorkflowNode): boolean => n.type === 'camera_director'
const isLogic = (n: WorkflowNode): boolean => !isRoot(n) && !isCamera(n) && n.type !== 'layer_assembly'

/**
 * Tập Node bị ẩn khi thu gọn Nhóm: Layer con của Nhóm đang thu gọn bị ẩn;
 * Node Logic chỉ bị ẩn khi TẤT CẢ Layer cha đều bị ẩn (Node dùng chung vẫn hiện nếu còn 1 cha hiển thị).
 */
export function resolveHiddenV2NodeIds(nodes: WorkflowNode[], edges: WorkflowEdge[]): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const parentsOf = new Map<string, WorkflowNode[]>()
  for (const e of edges) {
    const from = byId.get(e.fromNode)
    if (!from || !byId.has(e.toNode) || isCamera(from)) continue
    const list = parentsOf.get(e.toNode) ?? []
    if (!list.includes(from)) list.push(from)
    parentsOf.set(e.toNode, list)
  }
  const hidden = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const n of nodes) {
      const parents = parentsOf.get(n.id) ?? []
      if (hidden.has(n.id) || parents.length === 0) continue
      if (parents.every((p) => hidden.has(p.id) || Boolean(p.params?.collapsedGroup))) {
        hidden.add(n.id)
        changed = true
      }
    }
  }
  return hidden
}

function childrenOf(id: string, edges: WorkflowEdge[], byId: Map<string, WorkflowNode>, pick: (n: WorkflowNode) => boolean): WorkflowNode[] {
  const out: WorkflowNode[] = []
  for (const e of edges) {
    const c = byId.get(e.toNode)
    if (e.fromNode === id && c && pick(c) && !out.includes(c)) out.push(c)
  }
  return out
}

/** Gán mỗi Node Logic cho đúng 1 Layer "chủ" hiển thị đầu tiên để xếp hàng không trùng lặp */
function assignLogicOwners(layers: WorkflowNode[], edges: WorkflowEdge[], byId: Map<string, WorkflowNode>, hidden: Set<string>): Map<string, WorkflowNode[]> {
  const owned = new Map<string, WorkflowNode[]>()
  const taken = new Set<string>()
  for (const layer of layers) {
    if (hidden.has(layer.id)) continue
    const list = childrenOf(layer.id, edges, byId, isLogic).filter((c) => !taken.has(c.id))
    list.forEach((c) => taken.add(c.id))
    owned.set(layer.id, list)
  }
  return owned
}

/** Xếp 1 cụm cảnh bắt đầu tại `startY`, trả về đáy cụm */
function layoutCluster(root: WorkflowNode, startY: number, edges: WorkflowEdge[], byId: Map<string, WorkflowNode>, owners: Map<string, WorkflowNode[]>): number {
  root.position = { x: WF_V2_COL_X.ROOT, y: startY }
  let bottom = startY + WF_V2_NODE_H
  childrenOf(root.id, edges, byId, isCamera).forEach((cam, idx) => {
    cam.position = { x: WF_V2_COL_X.ROOT, y: startY + (idx + 1) * (WF_V2_NODE_H + LAYER_GAP) }
    bottom = Math.max(bottom, cam.position.y + WF_V2_NODE_H)
  })
  let cursorY = startY
  for (const grp of childrenOf(root.id, edges, byId, isGroup)) {
    const layers = childrenOf(grp.id, edges, byId, isLayer)
    grp.position = { x: WF_V2_COL_X.GROUP, y: cursorY }
    if (grp.params?.collapsedGroup || layers.length === 0) {
      layers.forEach((ln) => (ln.position = { x: WF_V2_COL_X.LAYER, y: cursorY }))
      cursorY += WF_V2_NODE_H + GROUP_GAP
      continue
    }
    for (const layer of layers) {
      layer.position = { x: WF_V2_COL_X.LAYER, y: cursorY }
      const logics = owners.get(layer.id) ?? []
      logics.forEach((ln, idx) => (ln.position = { x: WF_V2_COL_X.LOGIC, y: cursorY + idx * (WF_V2_NODE_H + LOGIC_GAP) }))
      const rows = Math.max(1, logics.length)
      cursorY += rows * WF_V2_NODE_H + (rows - 1) * LOGIC_GAP + LAYER_GAP
    }
    cursorY += GROUP_GAP - LAYER_GAP
  }
  return Math.max(bottom, cursorY - GROUP_GAP)
}

/**
 * Xếp toàn bộ không gian Workflow: các cụm cảnh xếp chồng theo thứ tự camera, mỗi cụm 4 cột căn đỉnh theo nhánh.
 * Node đã ghim (`pinned`) giữ nguyên vị trí; các thẻ còn lại được đẩy tránh đè lên nhau.
 */
export function layoutWorkflowV2Tree(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const pinnedPos = new Map(nodes.filter((n) => n.params?.pinned).map((n) => [n.id, { ...n.position }]))
  const cloned = nodes.map((n) => ({ ...n, position: { ...n.position } }))
  const byId = new Map(cloned.map((n) => [n.id, n]))
  const hidden = resolveHiddenV2NodeIds(cloned, edges)
  const roots = cloned.filter(isRoot)
  const orderedLayers = roots.flatMap((r) =>
    childrenOf(r.id, edges, byId, isGroup).flatMap((g) => childrenOf(g.id, edges, byId, isLayer))
  )
  const owners = assignLogicOwners(orderedLayers, edges, byId, hidden)
  let cursorY = TOP_Y
  for (const root of roots) {
    cursorY = layoutCluster(root, cursorY, edges, byId, owners) + CLUSTER_GAP + WF_V2_CLUSTER_HEADER
  }
  const ownedIds = new Set([...owners.values()].flat().map((n) => n.id))
  let orphanY = cursorY
  for (const ln of cloned) {
    if (!isLogic(ln) || ownedIds.has(ln.id)) continue
    const parentEdge = edges.find((e) => e.toNode === ln.id && byId.has(e.fromNode))
    if (hidden.has(ln.id) && parentEdge) {
      ln.position = { x: WF_V2_COL_X.LOGIC, y: byId.get(parentEdge.fromNode)!.position.y }
      continue
    }
    ln.position = { x: WF_V2_COL_X.LOGIC, y: orphanY }
    orphanY += WF_V2_NODE_H + LOGIC_GAP
  }
  for (const [id, pos] of pinnedPos) byId.get(id)!.position = pos
  return pinnedPos.size ? resolveV2Overlaps(cloned, edges, new Set(pinnedPos.keys())) : cloned
}

const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }): boolean =>
  a.x < b.x + WF_V2_NODE_W + WF_V2_NODE_GAP &&
  b.x < a.x + WF_V2_NODE_W + WF_V2_NODE_GAP &&
  a.y < b.y + WF_V2_NODE_H + WF_V2_NODE_GAP &&
  b.y < a.y + WF_V2_NODE_H + WF_V2_NODE_GAP

/** Đẩy các thẻ không cố định xuống dưới cho tới khi không còn đè lên thẻ nào đang hiển thị */
export function resolveV2Overlaps(nodes: WorkflowNode[], edges: WorkflowEdge[], fixedIds: Set<string>): WorkflowNode[] {
  const hidden = resolveHiddenV2NodeIds(nodes, edges)
  const visible = nodes.filter((n) => !hidden.has(n.id))
  const placed = visible.filter((n) => fixedIds.has(n.id)).map((n) => n.position)
  const movable = visible.filter((n) => !fixedIds.has(n.id)).sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
  for (const n of movable) {
    let guard = 0
    let hit = placed.find((p) => overlaps(p, n.position))
    while (hit && guard++ < 200) {
      n.position = { x: n.position.x, y: hit.y + WF_V2_NODE_H + WF_V2_NODE_GAP }
      hit = placed.find((p) => overlaps(p, n.position))
    }
    placed.push(n.position)
  }
  return nodes
}

/** Vị trí trống gần nhất cho thẻ vừa kéo thả (không đè thẻ khác), làm tròn theo lưới 8px */
export function findFreeV2Spot(nodes: WorkflowNode[], edges: WorkflowEdge[], nodeId: string, desired: { x: number; y: number }): { x: number; y: number } {
  const hidden = resolveHiddenV2NodeIds(nodes, edges)
  const others = nodes.filter((n) => n.id !== nodeId && !hidden.has(n.id)).map((n) => n.position)
  const snap = (v: number): number => Math.round(v / 8) * 8
  const start = { x: snap(desired.x), y: snap(desired.y) }
  for (let ring = 0; ring < 60; ring++) {
    for (const dir of ring === 0 ? [0] : [1, -1]) {
      const cand = { x: start.x, y: start.y + dir * ring * 16 }
      if (!others.some((p) => overlaps(p, cand))) return cand
    }
  }
  return start
}

export interface V2Cluster {
  rootId: string
  shotId?: string
  nodeIds: string[]
  bounds: { x: number; y: number; w: number; h: number }
}

/** Gom Node theo cụm cảnh (Logic thuộc cụm của Layer chủ đầu tiên) và tính khung bao để vẽ nền cụm */
export function computeV2Clusters(nodes: WorkflowNode[], edges: WorkflowEdge[], hidden: Set<string>): V2Cluster[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const order = new Map(nodes.map((n, i) => [n.id, i]))
  const clusterOf = new Map<string, string>()
  const parentOf = (id: string, pick: (n: WorkflowNode) => boolean): WorkflowNode | undefined =>
    edges
      .filter((e) => e.toNode === id)
      .map((e) => byId.get(e.fromNode))
      .filter((n): n is WorkflowNode => Boolean(n && pick(n)))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))[0]
  for (const n of nodes) if (isRoot(n)) clusterOf.set(n.id, n.id)
  for (const n of nodes) if (isCamera(n) || isGroup(n)) clusterOf.set(n.id, parentOf(n.id, isRoot)?.id ?? '')
  for (const n of nodes) if (isLayer(n)) clusterOf.set(n.id, clusterOf.get(parentOf(n.id, isGroup)?.id ?? '') ?? '')
  for (const n of nodes) if (isLogic(n)) clusterOf.set(n.id, clusterOf.get(parentOf(n.id, isLayer)?.id ?? '') ?? '')
  return nodes.filter(isRoot).map((root) => {
    const members = nodes.filter((n) => clusterOf.get(n.id) === root.id && !hidden.has(n.id))
    const xs = members.map((n) => n.position.x)
    const ys = members.map((n) => n.position.y)
    const x = Math.min(...xs) - 24
    const y = Math.min(...ys) - WF_V2_CLUSTER_HEADER - 10
    return {
      rootId: root.id,
      shotId: root.params?.shotId,
      nodeIds: nodes.filter((n) => clusterOf.get(n.id) === root.id).map((n) => n.id),
      bounds: { x, y, w: Math.max(...xs) + WF_V2_NODE_W + 24 - x, h: Math.max(...ys) + WF_V2_NODE_H + 18 - y }
    }
  })
}
