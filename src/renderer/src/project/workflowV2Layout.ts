import type { WorkflowEdge, WorkflowNode } from '@shared/types'

/** Trục X của 4 cột phân cấp Workflow V2: Root/Camera → Group → Layer → Logic */
export const WF_V2_COL_X = {
  ROOT: 40,
  GROUP: 356,
  LAYER: 672,
  LOGIC: 988
} as const

/** Kích thước thẻ Node cố định (CSS `.wf-v2-card` dùng đúng các giá trị này) */
export const WF_V2_NODE_W = 236
export const WF_V2_NODE_H = 64

const TOP_Y = 48
const LOGIC_GAP = 14
const LAYER_GAP = 22
const GROUP_GAP = 36

/** Chiều cao chuẩn của mọi thẻ Workflow V2 (thẻ có chiều cao cố định để bố cục & hit-test chính xác) */
export function estimateV2NodeHeight(_node?: WorkflowNode): number {
  return WF_V2_NODE_H
}

function isGroupNode(n: WorkflowNode): boolean {
  return Boolean(n.params?.groupKind)
}

function isLayerNode(n: WorkflowNode): boolean {
  return n.type === 'layer_assembly' && !n.params?.groupKind
}

function isLogicNode(n: WorkflowNode): boolean {
  return n.type !== 'scene_shot' && n.type !== 'camera_director' && n.type !== 'layer_assembly'
}

/**
 * Tập Node bị ẩn khi thu gọn Group: Layer con của Group đang thu gọn bị ẩn;
 * Node Logic chỉ bị ẩn khi TẤT CẢ Layer cha của nó đều bị ẩn (Node dùng chung vẫn hiện nếu còn 1 cha hiển thị).
 */
export function resolveHiddenV2NodeIds(nodes: WorkflowNode[], edges: WorkflowEdge[]): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const parentsOf = new Map<string, WorkflowNode[]>()
  for (const e of edges) {
    const from = byId.get(e.fromNode)
    if (!from || !byId.has(e.toNode)) continue
    const list = parentsOf.get(e.toNode) ?? []
    if (!list.includes(from)) list.push(from)
    parentsOf.set(e.toNode, list)
  }
  const hidden = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const n of nodes) {
      if (hidden.has(n.id)) continue
      const parents = parentsOf.get(n.id) ?? []
      if (parents.length === 0) continue
      const allBlocked = parents.every((p) => hidden.has(p.id) || Boolean(p.params?.collapsedGroup))
      if (allBlocked) {
        hidden.add(n.id)
        changed = true
      }
    }
  }
  return hidden
}

/** Gán mỗi Node Logic cho đúng 1 Layer "chủ" hiển thị đầu tiên (theo thứ tự Layer) để xếp hàng không trùng lặp */
function assignLogicOwners(
  orderedLayers: WorkflowNode[],
  edges: WorkflowEdge[],
  byId: Map<string, WorkflowNode>,
  hidden: Set<string>
): Map<string, WorkflowNode[]> {
  const owned = new Map<string, WorkflowNode[]>()
  const taken = new Set<string>()
  for (const layer of orderedLayers) {
    if (hidden.has(layer.id)) continue
    const list: WorkflowNode[] = []
    for (const e of edges) {
      if (e.fromNode !== layer.id) continue
      const child = byId.get(e.toNode)
      if (!child || !isLogicNode(child) || taken.has(child.id)) continue
      taken.add(child.id)
      list.push(child)
    }
    owned.set(layer.id, list)
  }
  return owned
}

/**
 * Thuật toán xếp cây 4 cột (Root → Group → Layer → Logic) căn đỉnh theo nhánh:
 * - Group đứng ngang hàng Layer con đầu tiên, Layer đứng ngang hàng Node Logic đầu tiên của nó (dây nối thẳng).
 * - Node Logic dùng chung nhiều Layer chỉ chiếm 1 ô (thuộc Layer chủ đầu tiên) nên không bao giờ đè nhau.
 * - Nhánh của Group đang thu gọn không chiếm chỗ trên khung vẽ.
 */
export function layoutWorkflowV2Tree(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const cloned = nodes.map((n) => ({ ...n, position: { ...n.position } }))
  const byId = new Map(cloned.map((n) => [n.id, n]))
  const hidden = resolveHiddenV2NodeIds(cloned, edges)
  const layerChildrenOf = (groupId: string): WorkflowNode[] => {
    const out: WorkflowNode[] = []
    for (const e of edges) {
      const child = byId.get(e.toNode)
      if (e.fromNode === groupId && child && isLayerNode(child) && !out.includes(child)) out.push(child)
    }
    return out
  }

  const groups = cloned.filter(isGroupNode)
  const orderedLayers = groups.flatMap((g) => layerChildrenOf(g.id))
  const owners = assignLogicOwners(orderedLayers, edges, byId, hidden)
  let cursorY = TOP_Y

  for (const grp of groups) {
    const layers = layerChildrenOf(grp.id)
    grp.position = { x: WF_V2_COL_X.GROUP, y: cursorY }
    if (grp.params?.collapsedGroup || layers.length === 0) {
      layers.forEach((ln) => (ln.position = { x: WF_V2_COL_X.LAYER, y: cursorY }))
      cursorY += WF_V2_NODE_H + GROUP_GAP
      continue
    }
    for (const layer of layers) {
      layer.position = { x: WF_V2_COL_X.LAYER, y: cursorY }
      const logics = owners.get(layer.id) ?? []
      logics.forEach((ln, idx) => {
        ln.position = { x: WF_V2_COL_X.LOGIC, y: cursorY + idx * (WF_V2_NODE_H + LOGIC_GAP) }
      })
      const rows = Math.max(1, logics.length)
      cursorY += rows * WF_V2_NODE_H + (rows - 1) * LOGIC_GAP + LAYER_GAP
    }
    cursorY += GROUP_GAP - LAYER_GAP
  }

  // Node Logic còn lại: bị ẩn → đặt theo cha đầu tiên (không chiếm ô); chưa có cha (mồ côi) → xếp cuối cột Logic
  const ownedIds = new Set([...owners.values()].flat().map((n) => n.id))
  let orphanY = cursorY
  for (const ln of cloned) {
    if (!isLogicNode(ln) || ownedIds.has(ln.id)) continue
    const parentEdge = edges.find((e) => e.toNode === ln.id && byId.has(e.fromNode))
    if (hidden.has(ln.id) && parentEdge) {
      ln.position = { x: WF_V2_COL_X.LOGIC, y: byId.get(parentEdge.fromNode)!.position.y }
      continue
    }
    ln.position = { x: WF_V2_COL_X.LOGIC, y: orphanY }
    orphanY += WF_V2_NODE_H + LOGIC_GAP
  }

  const root = cloned.find((n) => n.type === 'scene_shot')
  if (root) root.position = { x: WF_V2_COL_X.ROOT, y: TOP_Y }
  cloned
    .filter((n) => n.type === 'camera_director')
    .forEach((cam, idx) => {
      cam.position = {
        x: WF_V2_COL_X.ROOT,
        y: TOP_Y + (idx + 1) * (WF_V2_NODE_H + LAYER_GAP)
      }
    })
  return cloned
}
