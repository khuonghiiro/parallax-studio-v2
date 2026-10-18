export interface Point2D {
  x: number
  y: number
}

export interface MeshCorridorResult {
  /** Trọng số hành lang mesh [0..1] cho từng đỉnh (0 = ngoài vùng nhánh/đường kẻ được vẽ). */
  weights: Float32Array
  /** Khoảng cách trắc địa (geodesic) dọc theo cạnh tam giác từ thân nét vẽ chính. */
  geoDist: Float32Array
  /** Đoạn polyline nhỏ nhất tại điểm gắn cành nhánh (dùng để uốn các nhánh con theo cành chính). */
  segMin: Int16Array
  /** Đoạn polyline lớn nhất tại điểm gắn cành nhánh. */
  segMax: Int16Array
  /** Độ dài cạnh trung bình của các tam giác bị nét vẽ đi qua. */
  avgCoreEdge: number
}

interface MeshTopology {
  vCount: number
  adjVertices: number[][]
  adjLengths: number[][]
  avgEdge: number
}

const topologyCache = new WeakMap<object, { worldKey: number; topo: MeshTopology }>()

function cross2D(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-10) return Math.hypot(px - ax, py - ay)
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
}

function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
): boolean {
  const d1 = cross2D(cx, cy, dx, dy, ax, ay)
  const d2 = cross2D(cx, cy, dx, dy, bx, by)
  const d3 = cross2D(ax, ay, bx, by, cx, cy)
  const d4 = cross2D(ax, ay, bx, by, dx, dy)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }
  return false
}

function pointInTriangle(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number
): boolean {
  const c1 = cross2D(ax, ay, bx, by, px, py)
  const c2 = cross2D(bx, by, cx, cy, px, py)
  const c3 = cross2D(cx, cy, ax, ay, px, py)
  const hasNeg = c1 < -1e-5 || c2 < -1e-5 || c3 < -1e-5
  const hasPos = c1 > 1e-5 || c2 > 1e-5 || c3 > 1e-5
  return !(hasNeg && hasPos)
}

/** Khoảng cách 2D nhỏ nhất giữa đoạn thẳng PQ và tam giác ABC (bằng 0 nếu cắt hoặc nằm trong). */
export function segmentTriangleDistance(
  px: number, py: number, qx: number, qy: number,
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number
): number {
  if (
    pointInTriangle(px, py, ax, ay, bx, by, cx, cy) ||
    pointInTriangle(qx, qy, ax, ay, bx, by, cx, cy) ||
    segmentsIntersect(px, py, qx, qy, ax, ay, bx, by) ||
    segmentsIntersect(px, py, qx, qy, bx, by, cx, cy) ||
    segmentsIntersect(px, py, qx, qy, cx, cy, ax, ay)
  ) {
    return 0
  }
  return Math.min(
    pointToSegmentDist(px, py, ax, ay, bx, by),
    pointToSegmentDist(px, py, bx, by, cx, cy),
    pointToSegmentDist(px, py, cx, cy, ax, ay),
    pointToSegmentDist(qx, qy, ax, ay, bx, by),
    pointToSegmentDist(qx, qy, bx, by, cx, cy),
    pointToSegmentDist(qx, qy, cx, cy, ax, ay),
    pointToSegmentDist(ax, ay, px, py, qx, qy),
    pointToSegmentDist(bx, by, px, py, qx, qy),
    pointToSegmentDist(cx, cy, px, py, qx, qy)
  )
}

function getMeshTopology(world: Float32Array, indices: ArrayLike<number>): MeshTopology {
  const vCount = world.length >> 1
  const worldKey = vCount > 0 ? world[0] * 31 + world[vCount - 1] : 0
  const cacheObj = typeof indices === 'object' && indices !== null ? (indices as object) : null
  if (cacheObj) {
    const cached = topologyCache.get(cacheObj)
    if (cached && cached.worldKey === worldKey && cached.topo.vCount === vCount) return cached.topo
  }
  const adjVertices: number[][] = Array.from({ length: vCount }, () => [])
  const adjLengths: number[][] = Array.from({ length: vCount }, () => [])
  let edgeSum = 0
  let edgeCount = 0
  const addEdge = (u: number, v: number) => {
    if (u < 0 || v < 0 || u >= vCount || v >= vCount || u === v) return
    const list = adjVertices[u]
    if (list.includes(v)) return
    const len = Math.hypot(world[u * 2] - world[v * 2], world[u * 2 + 1] - world[v * 2 + 1])
    list.push(v)
    adjLengths[u].push(len)
    adjVertices[v].push(u)
    adjLengths[v].push(len)
    edgeSum += len
    edgeCount++
  }
  for (let i = 0; i + 2 < indices.length; i += 3) {
    addEdge(indices[i], indices[i + 1])
    addEdge(indices[i + 1], indices[i + 2])
    addEdge(indices[i + 2], indices[i])
  }
  // Hàn nối các đỉnh trùng/sát nhau (< 0.5px) tại biên ô lưới contour (do NUDGE_X/NUDGE_Y)
  const buckets = new Map<string, number[]>()
  for (let i = 0; i < vCount; i++) {
    const gx = Math.round(world[i * 2])
    const gy = Math.round(world[i * 2 + 1])
    const key = `${gx}:${gy}`
    let b = buckets.get(key)
    if (!b) {
      b = []
      buckets.set(key, b)
    }
    for (const prev of b) {
      if (Math.hypot(world[i * 2] - world[prev * 2], world[i * 2 + 1] - world[prev * 2 + 1]) <= 0.5) {
        addEdge(i, prev)
      }
    }
    b.push(i)
  }
  const topo: MeshTopology = {
    vCount,
    adjVertices,
    adjLengths,
    avgEdge: edgeCount > 0 ? edgeSum / edgeCount : 24
  }
  if (cacheObj) topologyCache.set(cacheObj, { worldKey, topo })
  return topo
}

interface PolylineMetrics {
  cum: number[]
  totalLen: number
  dirX: number
  dirY: number
  rootCutLen: number
  rootRampLen: number
}

function buildPolylineMetrics(polyline: ReadonlyArray<Point2D>): PolylineMetrics {
  const cum = [0]
  for (let i = 1; i < polyline.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(polyline[i].x - polyline[i - 1].x, polyline[i].y - polyline[i - 1].y))
  }
  const totalLen = cum[cum.length - 1] || 1
  const target = Math.min(24, totalLen * 0.25)
  let lookIdx = 1
  while (lookIdx < polyline.length - 1 && cum[lookIdx] < target) lookIdx++
  const dx = polyline[lookIdx].x - polyline[0].x
  const dy = polyline[lookIdx].y - polyline[0].y
  const dLen = Math.hypot(dx, dy) || 1
  const rootCutLen = Math.min(16, Math.max(4, totalLen * 0.1))
  const rootRampLen = Math.min(26, Math.max(8, totalLen * 0.16))
  return { cum, totalLen, dirX: dx / dLen, dirY: dy / dLen, rootCutLen, rootRampLen }
}

function projectOnPolyline(
  px: number,
  py: number,
  polyline: ReadonlyArray<Point2D>,
  metrics: PolylineMetrics
): { dist: number; seg: number; u: number; arcLen: number } {
  let bestDist = Infinity
  let bestSeg = 0
  let bestArc = 0
  for (let s = 0; s < polyline.length - 1; s++) {
    const a = polyline[s], b = polyline[s + 1]
    const dx = b.x - a.x, dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 > 1e-10 ? Math.min(1, Math.max(0, ((px - a.x) * dx + (py - a.y) * dy) / len2)) : 0
    const d = Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t))
    if (d < bestDist) {
      bestDist = d
      bestSeg = s
      const segLen = metrics.cum[s + 1] - metrics.cum[s]
      bestArc = metrics.cum[s] + t * segLen
    }
  }
  return { dist: bestDist, seg: bestSeg, u: bestArc / metrics.totalLen, arcLen: bestArc }
}

interface SubtreeSeeds {
  activeVerts: Set<number>
  barrierVerts: Set<number>
  strokeVerts: Set<number>
  segMin: Int16Array
  segMax: Int16Array
  avgCoreEdge: number
}

function findSubtreeSeeds(
  world: Float32Array,
  indices: ArrayLike<number>,
  polyline: ReadonlyArray<Point2D>,
  topo: MeshTopology,
  metrics: PolylineMetrics
): SubtreeSeeds | null {
  const vCount = topo.vCount
  const segCount = polyline.length - 1
  const hitEps = Math.max(3, topo.avgEdge * 0.16)
  const segMin = new Int16Array(vCount).fill(32767)
  const segMax = new Int16Array(vCount).fill(-1)
  const strokeVerts = new Set<number>()
  let coreEdgeSum = 0
  let coreEdgeCount = 0
  let bestTri = -1
  let bestDist = Infinity
  let bestSeg = 0

  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2]
    const ax = world[a * 2], ay = world[a * 2 + 1]
    const bx = world[b * 2], by = world[b * 2 + 1]
    const cx = world[c * 2], cy = world[c * 2 + 1]
    const e1 = Math.hypot(ax - bx, ay - by)
    const e2 = Math.hypot(bx - cx, by - cy)
    const e3 = Math.hypot(cx - ax, cy - ay)
    const triPerim = e1 + e2 + e3
    const triMaxEdge = Math.max(e1, e2, e3)
    let triHit = false
    let tMinSeg = 32767
    let tMaxSeg = -1
    for (let s = 0; s < segCount; s++) {
      const p = polyline[s], q = polyline[s + 1]
      const px = s === 0 ? p.x + (q.x - p.x) * 0.05 : p.x
      const py = s === 0 ? p.y + (q.y - p.y) * 0.05 : p.y
      const d = segmentTriangleDistance(px, py, q.x, q.y, ax, ay, bx, by, cx, cy)
      if (d < bestDist) {
        bestDist = d
        bestTri = t
        bestSeg = s
      }
      if (d <= hitEps) {
        triHit = true
        if (s < tMinSeg) tMinSeg = s
        if (s > tMaxSeg) tMaxSeg = s
      }
    }
    if (triHit) {
      const maxVertDist = Math.max(12, Math.min(18, (triPerim / 3) * 0.65))
      for (const v of [a, b, c]) {
        const proj = projectOnPolyline(world[v * 2], world[v * 2 + 1], polyline, metrics)
        const allowedDist = proj.arcLen <= metrics.rootRampLen ? Math.min(10, maxVertDist) : maxVertDist
        if (proj.dist <= allowedDist) {
          strokeVerts.add(v)
          if (tMinSeg < segMin[v]) segMin[v] = tMinSeg
          if (tMaxSeg > segMax[v]) segMax[v] = tMaxSeg
        }
      }
      coreEdgeSum += triPerim
      coreEdgeCount += 3
    }
  }

  if (strokeVerts.size === 0) {
    if (bestTri < 0 || bestDist > Math.max(28, topo.avgEdge * 1.25)) return null
    const a = indices[bestTri], b = indices[bestTri + 1], c = indices[bestTri + 2]
    for (const v of [a, b, c]) {
      strokeVerts.add(v)
      segMin[v] = bestSeg
      segMax[v] = bestSeg
    }
  }

  const avgCoreEdge = coreEdgeCount > 0 ? coreEdgeSum / coreEdgeCount : topo.avgEdge
  const activeVerts = new Set<number>()
  const barrierVerts = new Set<number>()
  const p0 = polyline[0]

  for (const v of strokeVerts) {
    const vx = world[v * 2], vy = world[v * 2 + 1]
    const proj = projectOnPolyline(vx, vy, polyline, metrics)
    const along0 = (vx - p0.x) * metrics.dirX + (vy - p0.y) * metrics.dirY
    if (
      proj.arcLen <= metrics.rootCutLen ||
      along0 <= 2 ||
      (proj.arcLen <= metrics.rootRampLen && proj.dist > 10)
    ) {
      barrierVerts.add(v)
    } else {
      activeVerts.add(v)
    }
  }

  if (activeVerts.size === 0) {
    for (const v of strokeVerts) {
      const vx = world[v * 2], vy = world[v * 2 + 1]
      const along0 = (vx - p0.x) * metrics.dirX + (vy - p0.y) * metrics.dirY
      if (along0 > 0) {
        activeVerts.add(v)
        barrierVerts.delete(v)
      }
    }
  }

  return { activeVerts, barrierVerts, strokeVerts, segMin, segMax, avgCoreEdge }
}

/**
 * Tính vùng hành lang & nhánh con (Subtree Mesh Corridor) dọc theo nét vẽ / xương trên lưới tam giác:
 * - Cành được vẽ (nét đỏ) và toàn bộ các cành nhánh con (nét xanh) mọc ra từ cành đó đều nhận trọng số chuyển động để đi theo cành.
 * - Thân cây phía dưới điểm bắt đầu và các cành lớn khác tách từ chạc gốc hoặc các đường kẻ rời hoàn toàn đứng yên (weight = 0).
 */
export function computeMeshCorridor(
  world: Float32Array,
  indices: ArrayLike<number>,
  polyline: ReadonlyArray<Point2D>,
  reach?: number
): MeshCorridorResult | null {
  const vCount = world.length >> 1
  if (vCount === 0 || indices.length < 3 || polyline.length < 2) return null
  const topo = getMeshTopology(world, indices)
  const metrics = buildPolylineMetrics(polyline)
  const seeds = findSubtreeSeeds(world, indices, polyline, topo, metrics)
  if (!seeds || seeds.activeVerts.size === 0) return null

  const { activeVerts, barrierVerts, strokeVerts, segMin, segMax, avgCoreEdge } = seeds
  const geoDist = new Float32Array(vCount).fill(Infinity)
  const owner = new Int8Array(vCount)
  const visited = new Uint8Array(vCount)
  const queue: number[] = []
  const p0 = polyline[0]

  for (const v of barrierVerts) {
    geoDist[v] = 0
    owner[v] = -1
    visited[v] = 1
  }
  for (const v of activeVerts) {
    geoDist[v] = 0
    owner[v] = 1
    queue.push(v)
  }

  const hasExplicitReach = Boolean(reach && reach > 0)
  const maxGeoDist = hasExplicitReach
    ? reach!
    : Math.max(avgCoreEdge * 12, metrics.totalLen * 2.5)
  const rootZoneRadius = Math.max(32, metrics.rootRampLen * 1.5, avgCoreEdge * 2.4)

  // Lan truyền Dijkstra từ thân cành đang vẽ (activeVerts) ra toàn bộ các cành nhánh con (cành xanh)
  while (queue.length > 0) {
    let bestIdx = 0
    for (let i = 1; i < queue.length; i++) {
      if (geoDist[queue[i]] < geoDist[queue[bestIdx]]) bestIdx = i
    }
    const u = queue[bestIdx]
    queue[bestIdx] = queue[queue.length - 1]
    queue.pop()
    if (visited[u]) continue
    visited[u] = 1
    const du = geoDist[u]
    if (du >= maxGeoDist) continue

    const neighbors = topo.adjVertices[u]
    const lengths = topo.adjLengths[u]

    for (let i = 0; i < neighbors.length; i++) {
      const v = neighbors[i]
      if (visited[v]) continue
      const vx = world[v * 2], vy = world[v * 2 + 1]
      const distToP0 = Math.hypot(vx - p0.x, vy - p0.y)
      const vAlong = (vx - p0.x) * metrics.dirX + (vy - p0.y) * metrics.dirY

      // Hàng rào chắn chỉ áp dụng trong vùng chạc gốc quanh P0 để không tràn ngược về thân cây
      // hoặc sang cành lớn kế bên tại chạc gốc; khi đã vượt qua chạc gốc thì toàn bộ cành nhánh con đều được nhận
      if (distToP0 <= rootZoneRadius || vAlong <= 2) {
        if (vAlong <= 2) continue
        const projV = projectOnPolyline(vx, vy, polyline, metrics)
        if (projV.arcLen <= metrics.rootCutLen) continue
        if (projV.arcLen <= metrics.rootRampLen && projV.dist > 10) {
          continue
        }
      }

      const nd = du + lengths[i]
      if (nd > maxGeoDist) continue

      if (nd < geoDist[v]) {
        const wasInf = !Number.isFinite(geoDist[v])
        geoDist[v] = nd
        owner[v] = 1
        segMin[v] = segMin[u]
        segMax[v] = segMax[u]
        if (wasInf) queue.push(v)
      }
    }
  }

  // Làm mượt dải đoạn gắn [segMin..segMax] giữa các đỉnh kề nhau gần thân cành chính
  // để tránh hiện tượng nhảy đoạn đột ngột tại chạc chữ V nơi cành nhánh tách ra
  const coreBand = Math.max(18, avgCoreEdge * 2.2)
  for (let pass = 0; pass < 2; pass++) {
    for (let u = 0; u < vCount; u++) {
      if (owner[u] !== 1 || geoDist[u] > coreBand) continue
      const neighbors = topo.adjVertices[u]
      for (let i = 0; i < neighbors.length; i++) {
        const v = neighbors[i]
        if (owner[v] !== 1) continue
        if (segMin[v] < segMin[u]) segMin[u] = segMin[v]
        if (segMax[v] > segMax[u]) segMax[u] = segMax[v]
      }
    }
  }

  const weights = new Float32Array(vCount)
  const lastSeg = polyline.length - 2
  for (let i = 0; i < vCount; i++) {
    if (owner[i] !== 1) {
      if (strokeVerts.has(i)) {
        const vx = world[i * 2], vy = world[i * 2 + 1]
        const along0 = (vx - p0.x) * metrics.dirX + (vy - p0.y) * metrics.dirY
        const proj = projectOnPolyline(vx, vy, polyline, metrics)
        if (along0 > 0 && proj.arcLen > 0 && proj.dist <= Math.max(18, avgCoreEdge * 0.85)) {
          const t = Math.min(1, proj.arcLen / metrics.rootRampLen)
          weights[i] = t * t * (3 - 2 * t)
        }
      }
      continue
    }
    const gd = geoDist[i]
    const x = world[i * 2], y = world[i * 2 + 1]
    // Nếu đỉnh nằm trong vùng chuyển tiếp sát gốc P0, tăng mượt trọng số từ 0 -> 1 để không bị rách tại gốc cành
    let rootFactor = 1
    const distToP0 = Math.hypot(x - p0.x, y - p0.y)
    if (distToP0 <= rootZoneRadius && gd <= avgCoreEdge * 2) {
      const proj = projectOnPolyline(x, y, polyline, metrics)
      if (proj.arcLen < metrics.rootRampLen) {
        const t = Math.min(1, Math.max(0, proj.arcLen / metrics.rootRampLen))
        rootFactor = t * t * (3 - 2 * t)
      }
    }
    if (!hasExplicitReach) {
      weights[i] = rootFactor
      continue
    }
    if (gd === 0) {
      weights[i] = rootFactor
      continue
    }
    const lo = Math.max(0, segMin[i] - 2)
    const hi = Math.min(lastSeg, segMax[i] + 2)
    let perp = Infinity
    for (let s = lo; s <= hi; s++) {
      const d = pointToSegmentDist(x, y, polyline[s].x, polyline[s].y, polyline[s + 1].x, polyline[s + 1].y)
      if (d < perp) perp = d
    }
    const effDist = Math.max(gd, perp)
    if (effDist >= maxGeoDist) continue
    const k = Math.min(1, Math.max(0, 1 - effDist / maxGeoDist))
    weights[i] = k * k * (3 - 2 * k) * rootFactor
  }

  return { weights, geoDist, segMin, segMax, avgCoreEdge }
}
