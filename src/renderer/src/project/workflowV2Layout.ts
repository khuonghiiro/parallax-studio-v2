import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from '@shared/types'

/** Khoảng cách tiêu chuẩn giữa các cột (thẻ 236px + hành lang dây nối 180px = 416px, rộng rãi và thoáng đãng) */
export const WF_V2_COL_STEP = 416

/** Trục X của 4 cột phân cấp: Root/Camera → Nhóm → Layer → Logic (khoảng hở 180px để dây nối thông thoáng) */
export const WF_V2_COL_X = {
  ROOT: 48,
  GROUP: 48 + WF_V2_COL_STEP, // 464
  LAYER: 48 + WF_V2_COL_STEP * 2, // 880
  LOGIC: 48 + WF_V2_COL_STEP * 3 // 1296
} as const

/** Làn dọc bên trái cột Root dành riêng cho dây Camera chuyển cảnh */
export const WF_V2_CAMERA_LANE_X = -18
/** Cột riêng cho các Node Time chung độc lập (chia hết cho 8px) */
export const WF_V2_TIME_COL_X = -336

/** Kích thước thẻ Node cố định (CSS `.wf-v2-card` dùng đúng các giá trị này) */
export const WF_V2_NODE_W = 236
export const WF_V2_NODE_H = 64
/** Khoảng đệm tối thiểu giữa 2 thẻ (dùng cho tự xếp & chống đè khi kéo thả) */
export const WF_V2_NODE_GAP = 16

export const WF_V2_CLUSTER_HEADER = 34
const TOP_Y = 96
const LOGIC_GAP = 24
const LAYER_GAP = 42
export const CAM_WAYPOINT_GAP = 68
const GROUP_GAP = 52
const CLUSTER_GAP = 84

/** Chiều cao chuẩn của mọi thẻ Workflow V2 (thẻ có chiều cao cố định để bố cục & hit-test chính xác) */
export function estimateV2NodeHeight(_node?: WorkflowNode): number {
  return WF_V2_NODE_H
}

const isRoot = (n: WorkflowNode): boolean => n.type === 'scene_shot'
const isGroup = (n: WorkflowNode): boolean => Boolean(n.params?.groupKind)
const isLayer = (n: WorkflowNode): boolean => n.type === 'layer_assembly' && !n.params?.groupKind && !n.params?.logicCategory
const isCamera = (n: WorkflowNode): boolean => n.type === 'camera_director'
const isParentCamera = (n: WorkflowNode): boolean => n.type === 'camera_director' && !n.params?.isCameraWaypoint
const isCameraWaypoint = (n: WorkflowNode): boolean => n.type === 'camera_director' && Boolean(n.params?.isCameraWaypoint)
const isLogic = (n: WorkflowNode): boolean => !isRoot(n) && !isCamera(n) && !isGroup(n) && !isLayer(n)

/** Thứ tự ưu tiên sắp xếp các nhóm logic từ trên xuống dưới trong cùng Layer */
const LOGIC_CATEGORY_PRIORITY: Record<string, number> = {
  loop_anim: 0,
  action: 1,
  anim_fx: 2,
  cluster_lock: 3,
  part_swap: 4,
  light: 5,
  cave: 6,
  fx: 7,
  material: 8,
  collision: 9,
  audio: 10
}

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
  for (const n of nodes) {
    if (n.params?.logicCategory === 'rig_bone') hidden.add(n.id)
  }
  // Nếu một Node Khoá Cụm đang bật thu gọn mảnh con (`collapsedSubLayers`), ẩn các Node Layer con phụ (chỉ giữ lại Node Gốc neo)
  for (const n of nodes) {
    if (n.params?.logicCategory !== 'cluster_lock' || !n.params.collapsedSubLayers) continue
    for (const e of edges) {
      if (e.toNode === n.id && e.fromNode !== (n.params.rootLayerId ? `v2-layer-${n.params.rootLayerId}` : undefined)) {
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
        for (const subChild of childrenOf(downstream.id, edges, byId, isLogic)) {
          if (!taken.has(subChild.id)) {
            taken.add(subChild.id)
            list.push(subChild)
          }
        }
      }
    }
    owned.set(layer.id, list)
  }
  return owned
}

/** Xây dựng bản đồ quan hệ cha-con giữa các node logic trong cùng một Layer */
function buildLogicChildrenMap(logics: WorkflowNode[], edges: WorkflowEdge[]): Map<string, WorkflowNode[]> {
  const byId = new Map(logics.map((n) => [n.id, n]))
  const childMap = new Map<string, WorkflowNode[]>()
  const visited = new Set<string>()

  for (const e of edges) {
    if (!byId.has(e.fromNode) || !byId.has(e.toNode)) continue
    const child = byId.get(e.toNode)!
    const list = childMap.get(e.fromNode) ?? []
    if (!list.includes(child)) {
      list.push(child)
      childMap.set(e.fromNode, list)
      visited.add(child.id)
    }
  }

  // Quan hệ cấu trúc phân cấp (ví dụ Part Child -> Part Hub)
  for (const n of logics) {
    const parentId = n.params?.hierarchyParentNodeId ?? n.params?.linkedMotionNodeId
    if (parentId && byId.has(parentId) && !visited.has(n.id)) {
      const list = childMap.get(parentId) ?? []
      if (!list.includes(n)) {
        list.push(n)
        childMap.set(parentId, list)
        visited.add(n.id)
      }
    }
  }

  return childMap
}

/** Tìm các node gốc của từng nhánh logic trong Layer (những node không có cha logic trong layer) */
function findBranchRoots(logics: WorkflowNode[], childMap: Map<string, WorkflowNode[]>): WorkflowNode[] {
  const childIds = new Set<string>()
  for (const list of childMap.values()) {
    for (const c of list) childIds.add(c.id)
  }
  const roots = logics.filter((n) => !childIds.has(n.id))
  roots.sort((a, b) => {
    const pA = LOGIC_CATEGORY_PRIORITY[a.params?.logicCategory ?? ''] ?? 99
    const pB = LOGIC_CATEGORY_PRIORITY[b.params?.logicCategory ?? ''] ?? 99
    if (pA !== pB) return pA - pB
    const tA = a.params?.timeStart ?? 0
    const tB = b.params?.timeStart ?? 0
    if (tA !== tB) return tA - tB
    return a.id.localeCompare(b.id)
  })
  return roots
}

interface LogicLayoutResult {
  nextY: number
  centerY: number
}

/**
 * Đệ quy tính toạ độ cho một nhánh logic:
 * - Chuỗi tuyến tính (1 con duy nhất như Followup BBox #1 → #2 → #3): xếp THẲNG HÀNG NGANG trên cùng một hàng Y.
 * - Rẽ nhánh (nhiều con như Part Hub → các Part Child): xếp các con dọc, cha nằm ở TRUNG TÂM của các con.
 */
function layoutLogicBranch(
  node: WorkflowNode,
  depth: number,
  startY: number,
  childMap: Map<string, WorkflowNode[]>,
  hidden: Set<string>,
  visited: Set<string>
): LogicLayoutResult {
  visited.add(node.id)
  node.position = { x: WF_V2_COL_X.LOGIC + depth * WF_V2_COL_STEP, y: startY }
  const rawChildren = (childMap.get(node.id) ?? []).filter((c) => !visited.has(c.id))
  const visibleChildren = rawChildren.filter((c) => !hidden.has(c.id))

  // Đặt toạ độ các con bị ẩn bằng toạ độ của cha hiển thị
  rawChildren
    .filter((c) => hidden.has(c.id))
    .forEach((c) => {
      c.position = { ...node.position }
      visited.add(c.id)
    })

  if (visibleChildren.length === 0) {
    return { nextY: startY + WF_V2_NODE_H + LOGIC_GAP, centerY: startY + WF_V2_NODE_H / 2 }
  }

  // Chuỗi nối tiếp tuyến tính (1 con duy nhất): giữ cùng Y để dây nối đi thẳng ngang tuyệt đẹp
  if (visibleChildren.length === 1) {
    const child = visibleChildren[0]
    const childRes = layoutLogicBranch(child, depth + 1, startY, childMap, hidden, visited)
    return { nextY: childRes.nextY, centerY: startY + WF_V2_NODE_H / 2 }
  }

  // Rẽ nhiều nhánh: các con xếp dọc, cha căn giữa theo các con
  let childCursorY = startY
  const centers: number[] = []
  for (const child of visibleChildren) {
    const res = layoutLogicBranch(child, depth + 1, childCursorY, childMap, hidden, visited)
    centers.push(res.centerY)
    childCursorY = res.nextY
  }
  const midCenter = (centers[0] + centers[centers.length - 1]) / 2
  node.position.y = Math.round(midCenter - WF_V2_NODE_H / 2)
  return { nextY: childCursorY, centerY: midCenter }
}

/** Sắp xếp toàn bộ các nhánh logic của một Layer và căn giữa Layer theo các nhánh */
function layoutLayerLogics(
  layer: WorkflowNode,
  logics: WorkflowNode[],
  edges: WorkflowEdge[],
  startY: number,
  hidden: Set<string>
): number {
  if (logics.length === 0) {
    layer.position = { x: WF_V2_COL_X.LAYER, y: startY }
    return startY + WF_V2_NODE_H + LAYER_GAP
  }

  const childMap = buildLogicChildrenMap(logics, edges)
  const roots = findBranchRoots(logics, childMap)
  const visited = new Set<string>()
  let cursorY = startY
  const branchCenters: number[] = []

  for (const r of roots) {
    if (visited.has(r.id)) continue
    const res = layoutLogicBranch(r, 0, cursorY, childMap, hidden, visited)
    branchCenters.push(res.centerY)
    cursorY = res.nextY
  }

  // Bất kỳ node nào chưa được duyệt (trường hợp cạnh vòng)
  for (const n of logics) {
    if (!visited.has(n.id)) {
      const res = layoutLogicBranch(n, 0, cursorY, childMap, hidden, visited)
      branchCenters.push(res.centerY)
      cursorY = res.nextY
    }
  }

  // Căn giữa Layer cha theo các nhánh logic của nó
  const midCenter = branchCenters.length
    ? (branchCenters[0] + branchCenters[branchCenters.length - 1]) / 2
    : startY + WF_V2_NODE_H / 2
  layer.position = { x: WF_V2_COL_X.LAYER, y: Math.max(startY, Math.round(midCenter - WF_V2_NODE_H / 2)) }

  const clusterBottom = Math.max(cursorY - LOGIC_GAP, layer.position.y + WF_V2_NODE_H)
  return clusterBottom + LAYER_GAP
}

/** Xếp chuỗi mốc lộ trình Camera bên dưới Camera ở cột ROOT */
function layoutCameraWaypoints(
  cam: WorkflowNode,
  startCamY: number,
  edges: WorkflowEdge[],
  byId: Map<string, WorkflowNode>
): number {
  cam.position = { x: WF_V2_COL_X.ROOT, y: startCamY }
  let camBottom = startCamY + WF_V2_NODE_H
  let wpY = startCamY + WF_V2_NODE_H + CAM_WAYPOINT_GAP
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
    return camBottom
  }

  for (const wp of waypoints) {
    wp.position = { x: WF_V2_COL_X.ROOT, y: wpY }
    camBottom = Math.max(camBottom, wp.position.y + WF_V2_NODE_H)
    wpY += WF_V2_NODE_H + CAM_WAYPOINT_GAP
  }
  return camBottom
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
    const camEnd = layoutCameraWaypoints(cam, camCursorY, edges, byId)
    bottom = Math.max(bottom, camEnd)
    camCursorY = camEnd + LAYER_GAP
  }

  let cursorY = startY
  for (const grp of childrenOf(root.id, edges, byId, isGroup)) {
    const layers = childrenOf(grp.id, edges, byId, isLayer)
    if (grp.params?.collapsedGroup || layers.length === 0) {
      grp.position = { x: WF_V2_COL_X.GROUP, y: cursorY }
      layers.forEach((ln) => (ln.position = { x: WF_V2_COL_X.LAYER, y: cursorY }))
      cursorY += WF_V2_NODE_H + GROUP_GAP
      continue
    }

    const startGroupLayerY = cursorY
    const layerPositions: number[] = []

    for (const layer of layers) {
      if (hidden.has(layer.id)) {
        layer.position = { x: WF_V2_COL_X.LAYER, y: cursorY }
        continue
      }
      const logics = owners.get(layer.id) ?? []
      cursorY = layoutLayerLogics(layer, logics, edges, cursorY, hidden)
      layerPositions.push(layer.position.y)
    }

    // Căn giữa Group cha theo các Layer con hiển thị
    const midGroupY = layerPositions.length
      ? Math.round((Math.min(...layerPositions) + Math.max(...layerPositions)) / 2)
      : startGroupLayerY
    grp.position = { x: WF_V2_COL_X.GROUP, y: midGroupY }
    cursorY += GROUP_GAP - LAYER_GAP
  }

  return Math.max(bottom, cursorY - GROUP_GAP)
}

/**
 * Xếp toàn bộ không gian Workflow: các cụm cảnh xếp chồng theo thứ tự camera, mỗi cụm phân cấp từ trái sang phải.
 * - Node đã ghim thủ công (`pinned: true`) giữ nguyên 100% toạ độ người dùng đã đặt.
 * - Node Time chung được đặt ngay cạnh các node tiêu thụ của nó để đường nối ngắn và đẹp.
 * - Các thẻ còn lại tự động tính toán khoảng cách chuẩn, luồng kết nối thẳng hàng và né thẻ cố định.
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
  let timeY = TOP_Y

  for (const ln of cloned) {
    if (!isLogic(ln) || ownedIds.has(ln.id)) continue
    // Node Time chung: đặt ngay lân cận các node tiêu thụ để đường nối ngắn, gọn và trực quan
    if (ln.params?.logicCategory === 'time') {
      const consumerIds = new Set(
        edges.filter((e) => e.fromNode === ln.id && (e.fromPort === 'time_range' || !e.fromPort)).map((e) => e.toNode)
      )
      const consumers = cloned.filter((n) => consumerIds.has(n.id) && !hidden.has(n.id))
      if (consumers.length > 0) {
        const minX = Math.min(...consumers.map((c) => c.position.x))
        const minY = Math.min(...consumers.map((c) => c.position.y))
        const maxY = Math.max(...consumers.map((c) => c.position.y))
        const midY = Math.round((minY + maxY) / 2)
        const targetX = Math.max(WF_V2_COL_X.ROOT, minX - WF_V2_COL_STEP)
        const targetY = Math.max(TOP_Y, midY - Math.round(WF_V2_NODE_H / 2))
        ln.position = findFreeV2Spot(cloned, edges, ln.id, { x: targetX, y: targetY })
      } else {
        ln.position = findFreeV2Spot(cloned, edges, ln.id, { x: WF_V2_TIME_COL_X, y: timeY })
        timeY += WF_V2_NODE_H + LOGIC_GAP
      }
      continue
    }
    const parentEdge = edges.find((e) => e.toNode === ln.id && byId.has(e.fromNode))
    if (hidden.has(ln.id) && parentEdge) {
      ln.position = { x: WF_V2_COL_X.LOGIC, y: byId.get(parentEdge.fromNode)!.position.y }
      continue
    }
    ln.position = { x: WF_V2_COL_X.LOGIC, y: orphanY }
    orphanY += WF_V2_NODE_H + LOGIC_GAP
  }

  for (const [id, pos] of pinnedPos) {
    const node = byId.get(id)
    if (node) node.position = pos
  }

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
  const movable = visible
    .filter((n) => !fixedIds.has(n.id))
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)

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
export function findFreeV2Spot(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nodeId: string,
  desired: { x: number; y: number }
): { x: number; y: number } {
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
  for (const n of nodes) {
    if (isParentCamera(n) || isGroup(n)) {
      clusterOf.set(n.id, parentOf(n.id, isRoot)?.id ?? (n.params?.shotId ? rootByShot.get(n.params.shotId) ?? '' : ''))
    }
  }
  for (const n of nodes) {
    if (isCameraWaypoint(n)) {
      const parentCluster =
        clusterOf.get(n.params?.hierarchyParentNodeId ?? '') ??
        (n.params?.shotId ? rootByShot.get(n.params.shotId) : '') ??
        ''
      clusterOf.set(n.id, parentCluster)
    }
  }
  for (const n of nodes) if (isLayer(n)) clusterOf.set(n.id, clusterOf.get(parentOf(n.id, isGroup)?.id ?? '') ?? '')
  for (const n of nodes) {
    // Node Time chung nối được nhiều cảnh nên đứng ngoài mọi khung cụm cảnh
    if (isLogic(n) && n.params?.logicCategory !== 'time') {
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
