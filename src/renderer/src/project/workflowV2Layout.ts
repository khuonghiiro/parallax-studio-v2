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
const isParentCamera = (n: WorkflowNode): boolean => n.type === 'camera_director' && !n.params?.isCameraWaypoint
const isCameraWaypoint = (n: WorkflowNode): boolean => n.type === 'camera_director' && Boolean(n.params?.isCameraWaypoint)
const isLogic = (n: WorkflowNode): boolean => !isRoot(n) && !isCamera(n) && n.type !== 'layer_assembly'

/**
 * Tập Node bị ẩn khi thu gọn Nhóm hoặc Camera:
 * - Layer con của Nhóm đang thu gọn bị ẩn; các cảnh con lộ trình quay của Camera đang thu gọn bị ẩn.
 * - Node Logic chỉ bị ẩn khi TẤT CẢ Layer cha đều bị ẩn (Node dùng chung vẫn hiện nếu còn 1 cha hiển thị).
 */
export function resolveHiddenV2NodeIds(nodes: WorkflowNode[], edges: WorkflowEdge[]): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const parentsOf = new Map<string, WorkflowNode[]>()
  for (const e of edges) {
    if (e.id.startsWith('e-camchain-')) continue
    const from = byId.get(e.fromNode)
    if (!from || !byId.has(e.toNode)) continue
    const list = parentsOf.get(e.toNode) ?? []
    if (!list.includes(from)) list.push(from)
    parentsOf.set(e.toNode, list)
  }
  const hidden = new Set<string>()
  // Nếu một Node Khoá Cụm đang bật thu gọn mảnh con (`collapsedSubLayers`), ẩn các Node Layer con phụ (chỉ giữ lại Node Gốc neo)
  for (const n of nodes) {
    if (n.params?.logicCategory !== 'cluster_lock' || !n.params.collapsedSubLayers) continue
    const rootLayerNodeId = n.params.rootLayerId ? `v2-layer-${n.params.rootLayerId}` : undefined
    for (const e of edges) {
      if (e.toNode === n.id && e.fromNode !== rootLayerNodeId) {
        const subLayer = byId.get(e.fromNode)
        if (subLayer && isLayer(subLayer)) hidden.add(subLayer.id)
      }
    }
  }
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
    const direct = childrenOf(layer.id, edges, byId, isLogic).filter((c) => !taken.has(c.id))
    const list: WorkflowNode[] = []
    for (const c of direct) {
      taken.add(c.id)
      list.push(c)
      for (const downstream of childrenOf(c.id, edges, byId, isLogic)) {
        if (!taken.has(downstream.id)) {
          taken.add(downstream.id)
          list.push(downstream)
        }
      }
    }
    owned.set(layer.id, list)
  }
  return owned
}

/** Xếp 1 cụm cảnh bắt đầu tại `startY`, trả về đáy cụm */
function layoutCluster(
  root: WorkflowNode,
  startY: number,
  edges: WorkflowEdge[],
  byId: Map<string, WorkflowNode>,
  owners: Map<string, WorkflowNode[]>,
  hidden: Set<string>
): number {
  root.position = { x: WF_V2_COL_X.ROOT, y: startY }
  let bottom = startY + WF_V2_NODE_H
  let camCursorY = startY + WF_V2_NODE_H + LAYER_GAP
  for (const cam of childrenOf(root.id, edges, byId, isParentCamera)) {
    cam.position = { x: WF_V2_COL_X.ROOT, y: camCursorY }
    bottom = Math.max(bottom, cam.position.y + WF_V2_NODE_H)
    camCursorY += WF_V2_NODE_H + LAYER_GAP

    // Xếp chuỗi các node con lộ trình quay / cảnh con ngay bên dưới Node Camera của cảnh đó
    const waypoints: WorkflowNode[] = []
    let curId = cam.id
    const visited = new Set<string>([cam.id])
    while (true) {
      const next = childrenOf(curId, edges, byId, isCameraWaypoint).find((w) => !visited.has(w.id))
      if (!next) break
      visited.add(next.id)
      waypoints.push(next)
      curId = next.id
    }
    if (cam.params?.collapsedGroup) {
      waypoints.forEach((wp) => (wp.position = { ...cam.position }))
      continue
    }
    for (const wp of waypoints) {
      wp.position = { x: WF_V2_COL_X.ROOT, y: camCursorY }
      bottom = Math.max(bottom, wp.position.y + WF_V2_NODE_H)
      camCursorY += WF_V2_NODE_H + LAYER_GAP
    }
  }
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
      if (hidden.has(layer.id)) {
        layer.position = { x: WF_V2_COL_X.LAYER, y: cursorY }
        continue
      }
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
    cursorY = layoutCluster(root, cursorY, edges, byId, owners, hidden) + CLUSTER_GAP + WF_V2_CLUSTER_HEADER
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
  const rootByShot = new Map<string, string>()
  for (const n of nodes) {
    if (isRoot(n)) {
      clusterOf.set(n.id, n.id)
      if (n.params?.shotId) rootByShot.set(n.params.shotId, n.id)
    }
  }
  for (const n of nodes) if (isParentCamera(n) || isGroup(n)) clusterOf.set(n.id, parentOf(n.id, isRoot)?.id ?? (n.params?.shotId ? rootByShot.get(n.params.shotId) ?? '' : ''))
  for (const n of nodes) {
    if (isCameraWaypoint(n)) {
      const parentCluster = clusterOf.get(n.params?.hierarchyParentNodeId ?? '') ?? (n.params?.shotId ? rootByShot.get(n.params.shotId) : '') ?? ''
      clusterOf.set(n.id, parentCluster)
    }
  }
  for (const n of nodes) if (isLayer(n)) clusterOf.set(n.id, clusterOf.get(parentOf(n.id, isGroup)?.id ?? '') ?? '')
  for (const n of nodes) {
    if (isLogic(n)) {
      const parentLayer = parentOf(n.id, isLayer)
      if (parentLayer) {
        clusterOf.set(n.id, clusterOf.get(parentLayer.id) ?? '')
      } else {
        const parentLogic = parentOf(n.id, isLogic)
        const fallback = n.params?.shotId ? rootByShot.get(n.params.shotId) ?? '' : rootByShot.values().next().value ?? ''
        clusterOf.set(n.id, (parentLogic ? clusterOf.get(parentLogic.id) : undefined) ?? fallback)
      }
    }
  }
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
