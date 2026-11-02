import type { LayerRig } from '@shared/layerRig'
import { rotatePoint } from './layerRig'

export interface WeldedGraph {
  vCount: number
  adjVertices: number[][]
  adjLengths: number[][]
  avgEdge: number
}

export interface BoneSegmentMeta {
  bone: LayerRig['bones'][number]
  hx: number
  hy: number
  tx: number
  ty: number
  dx: number
  dy: number
  len: number
  len2: number
  reachMult: number
  pelvisReachMult: number
  strengthMult: number
  meshEnvelope: boolean
  chainIdx: number
  coreTMin: number
  coreTMax: number
  extraSeedSeg?: { ax: number; ay: number; bx: number; by: number }
}

export interface BoneChainInfo {
  chains: Array<LayerRig['bones']>
  parentChainIdx: number[]
  boneToChainIdx: Map<string, number>
}

export interface BoneGeodesicField {
  geoDist: Float32Array
  originX: Float32Array
  originY: Float32Array
}

const graphCache = new WeakMap<object, { worldSig: number; graph: WeldedGraph }>()

export function pointToSegProjection(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { dist: number; projX: number; projY: number; rawT: number; clampedT: number } {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-10) {
    return { dist: Math.hypot(px - ax, py - ay), projX: ax, projY: ay, rawT: 0, clampedT: 0 }
  }
  const rawT = ((px - ax) * dx + (py - ay) * dy) / len2
  const clampedT = Math.min(1, Math.max(0, rawT))
  const projX = ax + dx * clampedT
  const projY = ay + dy * clampedT
  return { dist: Math.hypot(px - projX, py - projY), projX, projY, rawT, clampedT }
}

export function angleDifferenceDeg(a1: number, a2: number): number {
  let diff = Math.abs((a1 - a2) % 360)
  if (diff > 180) diff = 360 - diff
  return diff
}

function weldDuplicateAndTJunctionVertices(
  world: Float32Array,
  indices: ArrayLike<number>,
  vCount: number,
  addEdge: (u: number, v: number, customLen?: number) => void
): void {
  const cellSize = 16
  const buckets = new Map<string, number[]>()
  for (let i = 0; i < vCount; i++) {
    const bx = Math.floor(world[i * 2] / cellSize)
    const by = Math.floor(world[i * 2 + 1] / cellSize)
    const key = `${bx}:${by}`
    let b = buckets.get(key)
    if (!b) {
      b = []
      buckets.set(key, b)
    }
    b.push(i)
  }

  const weldEps = 0.35
  for (let i = 0; i < vCount; i++) {
    const x = world[i * 2]
    const y = world[i * 2 + 1]
    const bx = Math.floor(x / cellSize)
    const by = Math.floor(y / cellSize)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const b = buckets.get(`${bx + dx}:${by + dy}`)
        if (!b) continue
        for (let k = 0; k < b.length; k++) {
          const j = b[k]
          if (j <= i) continue
          const d = Math.hypot(x - world[j * 2], y - world[j * 2 + 1])
          if (d <= weldEps) addEdge(i, j, d)
        }
      }
    }
  }

  const tJuncEps = 0.65
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const tri = [indices[t], indices[t + 1], indices[t + 2]]
    for (let e = 0; e < 3; e++) {
      const u = tri[e]
      const v = tri[(e + 1) % 3]
      const ux = world[u * 2], uy = world[u * 2 + 1]
      const vx = world[v * 2], vy = world[v * 2 + 1]
      const minBx = Math.floor((Math.min(ux, vx) - tJuncEps) / cellSize)
      const maxBx = Math.floor((Math.max(ux, vx) + tJuncEps) / cellSize)
      const minBy = Math.floor((Math.min(uy, vy) - tJuncEps) / cellSize)
      const maxBy = Math.floor((Math.max(uy, vy) + tJuncEps) / cellSize)
      for (let bx = minBx; bx <= maxBx; bx++) {
        for (let by = minBy; by <= maxBy; by++) {
          const b = buckets.get(`${bx}:${by}`)
          if (!b) continue
          for (let k = 0; k < b.length; k++) {
            const w = b[k]
            if (w === u || w === v) continue
            const wx = world[w * 2], wy = world[w * 2 + 1]
            const proj = pointToSegProjection(wx, wy, ux, uy, vx, vy)
            if (proj.rawT >= 0.0 && proj.rawT <= 1.0 && proj.dist <= tJuncEps) {
              addEdge(u, w)
              addEdge(w, v)
            }
          }
        }
      }
    }
  }
}

/**
 * Xây dựng đồ thị lưới tam giác đẳng hướng (8 hướng đối xứng Trái-Phải):
 * 1. Nối tất cả các cạnh tam giác chuẩn.
 * 2. Bổ sung đường chéo đối xứng (TL-BR) cho mọi cặp tam giác chung cạnh trong cùng ô lưới để khử hoàn toàn thiên lệch hướng chéo TR-BL.
 * 3. Hàn các đỉnh trùng nhau hoặc T-junction sát trên cạnh ô lưới (<= 0.65px) mà không nối tắt qua khe tách 2 ống quần.
 */
export function buildWeldedMeshGraph(world: Float32Array, indices: ArrayLike<number>): WeldedGraph {
  const vCount = world.length >> 1
  const worldSig = vCount > 0 ? world[0] * 31 + world[vCount - 1] * 17 + indices.length + 7 : 0
  const cacheKey = typeof indices === 'object' && indices !== null ? (indices as object) : null
  if (cacheKey) {
    const cached = graphCache.get(cacheKey)
    if (cached && cached.worldSig === worldSig && cached.graph.vCount === vCount) {
      return cached.graph
    }
  }

  const adjVertices: number[][] = Array.from({ length: vCount }, () => [])
  const adjLengths: number[][] = Array.from({ length: vCount }, () => [])
  let edgeSum = 0
  let edgeCount = 0

  const addEdge = (u: number, v: number, customLen?: number) => {
    if (u < 0 || v < 0 || u >= vCount || v >= vCount || u === v) return
    const list = adjVertices[u]
    if (list.includes(v)) return
    const len = customLen ?? Math.hypot(world[u * 2] - world[v * 2], world[u * 2 + 1] - world[v * 2 + 1])
    list.push(v)
    adjLengths[u].push(len)
    adjVertices[v].push(u)
    adjLengths[v].push(len)
    edgeSum += len
    edgeCount++
  }

  const sharedEdgeOpposite = new Map<string, number>()
  const registerTriEdge = (u: number, v: number, opp: number) => {
    addEdge(u, v)
    const key = u < v ? `${u}_${v}` : `${v}_${u}`
    const prevOpp = sharedEdgeOpposite.get(key)
    if (prevOpp !== undefined && prevOpp !== opp) {
      const ux = world[u * 2], uy = world[u * 2 + 1]
      const vx = world[v * 2], vy = world[v * 2 + 1]
      const ox1 = world[prevOpp * 2], oy1 = world[prevOpp * 2 + 1]
      const ox2 = world[opp * 2], oy2 = world[opp * 2 + 1]
      const cross1 = (vx - ux) * (oy1 - uy) - (vy - uy) * (ox1 - ux)
      const cross2 = (vx - ux) * (oy2 - uy) - (vy - uy) * (ox2 - ux)
      const cross3 = (ox2 - ox1) * (uy - oy1) - (oy2 - oy1) * (ux - ox1)
      const cross4 = (ox2 - ox1) * (vy - oy1) - (oy2 - oy1) * (vx - ox1)
      if (cross1 * cross2 < -1e-5 && cross3 * cross4 < -1e-5) {
        addEdge(prevOpp, opp)
      }
    } else {
      sharedEdgeOpposite.set(key, opp)
    }
  }

  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = indices[i]
    const b = indices[i + 1]
    const c = indices[i + 2]
    registerTriEdge(a, b, c)
    registerTriEdge(b, c, a)
    registerTriEdge(c, a, b)
  }

  const avgEdge = edgeCount > 0 ? edgeSum / edgeCount : 16
  weldDuplicateAndTJunctionVertices(world, indices, vCount, addEdge)

  const graph: WeldedGraph = { vCount, adjVertices, adjLengths, avgEdge }
  if (cacheKey) graphCache.set(cacheKey, { worldSig, graph })
  return graph
}

function isContinuationOfParent(parent: LayerRig['bones'][number], child: LayerRig['bones'][number]): boolean {
  if (child.parentJoint === 'head') return false
  const pEnd = rotatePoint(parent.length, 0, parent.angle)
  const pTailX = parent.x + pEnd.x
  const pTailY = parent.y + pEnd.y
  if (Math.hypot(child.x - pTailX, child.y - pTailY) > 18) return false
  return angleDifferenceDeg(parent.angle, child.angle) <= 105
}

export function buildAnatomicalBoneChains(bones: LayerRig['bones']): BoneChainInfo {
  const byId = new Map(bones.map((b) => [b.id, b]))
  const children = new Map<string, LayerRig['bones']>()
  for (const b of bones) {
    if (b.parentId && byId.has(b.parentId)) {
      const list = children.get(b.parentId) ?? []
      list.push(b)
      children.set(b.parentId, list)
    }
  }

  const chains: Array<LayerRig['bones']> = []
  const boneToChainIdx = new Map<string, number>()

  for (const b of bones) {
    const parent = b.parentId ? byId.get(b.parentId) : undefined
    const isCont = parent ? isContinuationOfParent(parent, b) : false
    const isStart = !parent || (children.get(parent.id)?.length ?? 0) > 1 || !isCont
    if (!isStart) continue
    const chainIdx = chains.length
    const chain: LayerRig['bones'] = [b]
    boneToChainIdx.set(b.id, chainIdx)
    let cur = b
    while (true) {
      const kids = children.get(cur.id)
      if (!kids || kids.length !== 1) break
      const next = kids[0]
      if (!isContinuationOfParent(cur, next)) break
      cur = next
      chain.push(cur)
      boneToChainIdx.set(cur.id, chainIdx)
    }
    chains.push(chain)
  }

  if (chains.length === 0) {
    bones.forEach((b, idx) => {
      chains.push([b])
      boneToChainIdx.set(b.id, idx)
    })
  }

  const parentChainIdx = chains.map((chain) => {
    const first = chain[0]
    if (!first.parentId) return -1
    return boneToChainIdx.get(first.parentId) ?? -1
  })

  return { chains, parentChainIdx, boneToChainIdx }
}

function seedBoneVertices(
  world: Float32Array,
  vCount: number,
  avgEdge: number,
  meta: BoneSegmentMeta,
  geoDist: Float32Array,
  originX: Float32Array,
  originY: Float32Array
): number[] {
  const seedHx = meta.hx + meta.dx * meta.coreTMin
  const seedHy = meta.hy + meta.dy * meta.coreTMin
  const seedTx = meta.hx + meta.dx * meta.coreTMax
  const seedTy = meta.hy + meta.dy * meta.coreTMax
  const seedRadius = Math.max(8, Math.min(18, avgEdge * 0.65))
  const queue: number[] = []

  let minVertexDist = Infinity
  let hasHeadSeed = false
  let hasTailSeed = false
  let minHeadDist = Infinity
  let closestHeadVert = -1
  let closestHeadProjX = seedHx
  let closestHeadProjY = seedHy
  let minTailDist = Infinity
  let closestTailVert = -1
  let closestTailProjX = seedTx
  let closestTailProjY = seedTy

  for (let v = 0; v < vCount; v++) {
    const vx = world[v * 2]
    const vy = world[v * 2 + 1]
    const coreProj = pointToSegProjection(vx, vy, seedHx, seedHy, seedTx, seedTy)
    let proj = coreProj
    if (meta.extraSeedSeg) {
      const p2 = pointToSegProjection(
        vx,
        vy,
        meta.extraSeedSeg.ax,
        meta.extraSeedSeg.ay,
        meta.extraSeedSeg.bx,
        meta.extraSeedSeg.by
      )
      if (p2.dist < proj.dist) proj = p2
    }
    if (proj.dist < minVertexDist) minVertexDist = proj.dist
    if (coreProj.rawT <= 0.65 && coreProj.dist < minHeadDist) {
      minHeadDist = coreProj.dist
      closestHeadVert = v
      closestHeadProjX = coreProj.projX
      closestHeadProjY = coreProj.projY
    }
    if (coreProj.rawT >= 0.35 && coreProj.dist < minTailDist) {
      minTailDist = coreProj.dist
      closestTailVert = v
      closestTailProjX = coreProj.projX
      closestTailProjY = coreProj.projY
    }
    if (proj.dist <= seedRadius) {
      geoDist[v] = proj.dist
      originX[v] = proj.projX
      originY[v] = proj.projY
      queue.push(v)
      if (coreProj.rawT <= 0.55) hasHeadSeed = true
      if (coreProj.rawT >= 0.45) hasTailSeed = true
    }
  }

  const maxFallbackDist = Math.max(64, meta.len * 0.75)
  if (queue.length === 0 && vCount > 0 && minVertexDist <= maxFallbackDist) {
    const fallbackRadius = minVertexDist * 1.35 + 8
    for (let v = 0; v < vCount; v++) {
      const proj = pointToSegProjection(world[v * 2], world[v * 2 + 1], seedHx, seedHy, seedTx, seedTy)
      if (proj.dist <= fallbackRadius) {
        geoDist[v] = proj.dist
        originX[v] = proj.projX
        originY[v] = proj.projY
        queue.push(v)
      }
    }
  } else {
    if (!hasHeadSeed && closestHeadVert >= 0 && minHeadDist <= maxFallbackDist) {
      if (!Number.isFinite(geoDist[closestHeadVert])) queue.push(closestHeadVert)
      geoDist[closestHeadVert] = minHeadDist
      originX[closestHeadVert] = closestHeadProjX
      originY[closestHeadVert] = closestHeadProjY
    }
    if (!hasTailSeed && closestTailVert >= 0 && minTailDist <= maxFallbackDist) {
      if (!Number.isFinite(geoDist[closestTailVert])) queue.push(closestTailVert)
      geoDist[closestTailVert] = minTailDist
      originX[closestTailVert] = closestTailProjX
      originY[closestTailVert] = closestTailProjY
    }
  }
  return queue
}

export function computeBoneField(
  world: Float32Array,
  graph: WeldedGraph,
  meta: BoneSegmentMeta
): BoneGeodesicField {
  const { vCount, adjVertices, adjLengths, avgEdge } = graph
  const geoDist = new Float32Array(vCount).fill(Infinity)
  const originX = new Float32Array(vCount)
  const originY = new Float32Array(vCount)
  const visited = new Uint8Array(vCount)
  const queue = seedBoneVertices(world, vCount, avgEdge, meta, geoDist, originX, originY)

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
    const ox = originX[u]
    const oy = originY[u]
    const neighbors = adjVertices[u]
    const lengths = adjLengths[u]

    for (let i = 0; i < neighbors.length; i++) {
      const v = neighbors[i]
      if (visited[v]) continue
      const nd = du + lengths[i]
      if (nd < geoDist[v]) {
        const wasInf = !Number.isFinite(geoDist[v])
        geoDist[v] = nd
        originX[v] = ox
        originY[v] = oy
        if (wasInf) queue.push(v)
      }
    }
  }

  return { geoDist, originX, originY }
}
