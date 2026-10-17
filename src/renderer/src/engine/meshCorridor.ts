export interface Point2D {
  x: number
  y: number
}

export interface MeshCorridorResult {
  /** Trọng số hành lang mesh [0..1] cho từng đỉnh (0 = ngoài vùng mesh được vẽ). */
  weights: Float32Array
  /** Khoảng cách trắc địa (geodesic) dọc theo cạnh tam giác từ vùng nét vẽ. */
  geoDist: Float32Array
  /** Đoạn polyline nhỏ nhất gần đỉnh này (dùng để giới hạn chiếu cục bộ trên nhánh). */
  segMin: Int16Array
  /** Đoạn polyline lớn nhất gần đỉnh này. */
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

const topologyCache = new WeakMap< object, { worldKey: number; topo: MeshTopology } >()

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
    const a = indices[i]
    const b = indices[i + 1]
    const c = indices[i + 2]
    addEdge(a, b)
    addEdge(b, c)
    addEdge(c, a)
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

interface CoreTrianglesHit {
  coreVerts: Set<number>
  segMin: Int16Array
  segMax: Int16Array
  avgCoreEdge: number
}

function polylinePointDist(px: number, py: number, polyline: ReadonlyArray<Point2D>): number {
  let best = Infinity
  for (let s = 0; s < polyline.length - 1; s++) {
    const d = pointToSegmentDist(px, py, polyline[s].x, polyline[s].y, polyline[s + 1].x, polyline[s + 1].y)
    if (d < best) best = d
  }
  return best
}

function findCoreHitTriangles(
  world: Float32Array,
  indices: ArrayLike<number>,
  polyline: ReadonlyArray<Point2D>,
  avgMeshEdge: number
): CoreTrianglesHit | null {
  const vCount = world.length >> 1
  const segCount = polyline.length - 1
  const hitEps = Math.max(3, avgMeshEdge * 0.16)
  const segMin = new Int16Array(vCount).fill(32767)
  const segMax = new Int16Array(vCount).fill(-1)
  const coreVerts = new Set<number>()
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
    const mx = (ax + bx + cx) / 3, my = (ay + by + cy) / 3
    const triPerim =
      Math.hypot(ax - bx, ay - by) +
      Math.hypot(bx - cx, by - cy) +
      Math.hypot(cx - ax, cy - ay)
    const triAvgEdge = triPerim / 3
    let triHit = false
    let tMinSeg = 32767
    let tMaxSeg = -1
    for (let s = 0; s < segCount; s++) {
      const p = polyline[s], q = polyline[s + 1]
      // Dịch nhẹ điểm xuất phát ở gốc chạc cây (s=0) theo hướng vẽ để không bắt nhầm tam giác thân/nhánh kế bên chung cạnh gốc
      const px = s === 0 ? p.x + (q.x - p.x) * 0.08 : p.x
      const py = s === 0 ? p.y + (q.y - p.y) * 0.08 : p.y
      const d = segmentTriangleDistance(px, py, q.x, q.y, ax, ay, bx, by, cx, cy)
      if (d < bestDist) {
        bestDist = d
        bestTri = t
        bestSeg = s
      }
      const centroidDist = pointToSegmentDist(mx, my, px, py, q.x, q.y)
      if (d <= hitEps && centroidDist <= Math.max(12, triAvgEdge * 0.65)) {
        triHit = true
        if (s < tMinSeg) tMinSeg = s
        if (s > tMaxSeg) tMaxSeg = s
      }
    }
    if (triHit) {
      const maxVertDist = Math.max(14, triAvgEdge * 0.85)
      for (const v of [a, b, c]) {
        if (polylinePointDist(world[v * 2], world[v * 2 + 1], polyline) <= maxVertDist) {
          coreVerts.add(v)
          if (tMinSeg < segMin[v]) segMin[v] = tMinSeg
          if (tMaxSeg > segMax[v]) segMax[v] = tMaxSeg
        }
      }
      coreEdgeSum += triPerim
      coreEdgeCount += 3
    }
  }

  if (coreVerts.size === 0) {
    if (bestTri < 0 || bestDist > Math.max(28, avgMeshEdge * 1.25)) return null
    const a = indices[bestTri], b = indices[bestTri + 1], c = indices[bestTri + 2]
    for (const v of [a, b, c]) {
      coreVerts.add(v)
      segMin[v] = bestSeg
      segMax[v] = bestSeg
    }
  }

  return {
    coreVerts,
    segMin,
    segMax,
    avgCoreEdge: coreEdgeCount > 0 ? coreEdgeSum / coreEdgeCount : avgMeshEdge
  }
}

/**
 * Tính vùng hành lang mesh (Mesh Corridor) dọc theo đường vẽ / xương trên lưới tam giác.
 * Chỉ tác động đúng các tam giác có nét vẽ đi qua (hoặc lan truyền dọc cạnh tam giác khi reach > 0),
 * tuyệt đối không nhảy qua khoảng trống sang nhánh hoặc đường kẻ khác.
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
  const hit = findCoreHitTriangles(world, indices, polyline, topo.avgEdge)
  if (!hit) return null

  const { coreVerts, segMin, segMax, avgCoreEdge } = hit
  const geoDist = new Float32Array(vCount).fill(Infinity)
  const weights = new Float32Array(vCount)

  for (const v of coreVerts) {
    geoDist[v] = 0
    weights[v] = 1
  }

  const maxGeoDist = reach && reach > 0 ? reach : 0
  if (maxGeoDist <= 0) {
    return { weights, geoDist, segMin, segMax, avgCoreEdge }
  }

  const visited = new Uint8Array(vCount)
  const queue: number[] = [...coreVerts]

  // Dijkstra dọc theo cạnh tam giác khi người dùng mở rộng bán kính reach > 0
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
      const nd = du + lengths[i]
      if (nd <= maxGeoDist && nd < geoDist[v]) {
        const wasInf = !Number.isFinite(geoDist[v])
        geoDist[v] = nd
        if (segMin[u] < segMin[v]) segMin[v] = segMin[u]
        if (segMax[u] > segMax[v]) segMax[v] = segMax[u]
        if (wasInf) queue.push(v)
      }
    }
  }

  const lastSeg = polyline.length - 2
  for (let i = 0; i < vCount; i++) {
    const gd = geoDist[i]
    if (!Number.isFinite(gd) || gd === 0) continue
    const x = world[i * 2], y = world[i * 2 + 1]
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
    weights[i] = k * k * (3 - 2 * k)
  }

  return { weights, geoDist, segMin, segMax, avgCoreEdge }
}
