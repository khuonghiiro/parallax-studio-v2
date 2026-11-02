import type { LayerRig } from '@shared/layerRig'
import { rotatePoint } from './layerRig'
import type { SkinInfluence } from './layerSkinning'
import {
  type BoneChainInfo,
  type BoneGeodesicField,
  type BoneSegmentMeta,
  buildAnatomicalBoneChains,
  buildWeldedMeshGraph,
  computeBoneField,
  pointToSegProjection
} from './meshGeodesicGraph'

export { buildAnatomicalBoneChains, buildWeldedMeshGraph }
export type { BoneChainInfo }

interface VertexBoneScore {
  boneIdx: number
  id: string
  chainIdx: number
  trueGeoDist: number
  chainScoreDist: number
  dEff: number
  affinity: number
}

function buildBoneSegmentMetas(
  bones: LayerRig['bones'],
  chains: Array<LayerRig['bones']>,
  parentChainIdx: number[],
  boneToChainIdx: Map<string, number>,
  childChainsOfChain: number[][]
): BoneSegmentMeta[] {
  const rawEndpoints = bones.map((b) => {
    const end = rotatePoint(b.length, 0, b.angle)
    return {
      hx: b.x,
      hy: b.y,
      tx: b.x + end.x,
      ty: b.y + end.y,
      dx: end.x,
      dy: end.y,
      chainIdx: boneToChainIdx.get(b.id) ?? 0
    }
  })

  return bones.map((b, idx) => {
    const ep = rawEndpoints[idx]
    const len = Math.max(1, b.length)
    const chain = chains[ep.chainIdx]
    const isChainHead = chain[0]?.id === b.id
    const isChainTail = chain[chain.length - 1]?.id === b.id
    const reachMult = Math.max(0.5, Math.min(3.0, b.influenceReach ?? 1.0))

    let headNearOtherChain = isChainHead && parentChainIdx[ep.chainIdx] >= 0
    let tailNearOtherChain = false

    if (chains.length > 1) {
      for (let j = 0; j < rawEndpoints.length; j++) {
        if (rawEndpoints[j].chainIdx === ep.chainIdx) continue
        const other = rawEndpoints[j]
        if (isChainHead) {
          const dHead = pointToSegProjection(ep.hx, ep.hy, other.hx, other.hy, other.tx, other.ty).dist
          if (dHead <= 32) headNearOtherChain = true
        }
        if (isChainTail) {
          const dTail = pointToSegProjection(ep.tx, ep.ty, other.hx, other.hy, other.tx, other.ty).dist
          if (dTail <= 32 && childChainsOfChain[ep.chainIdx].length <= 1) {
            tailNearOtherChain = true
          }
        }
      }
    }

    let pelvisReachMult = reachMult
    let extraSeedSeg: { ax: number; ay: number; bx: number; by: number } | undefined
    const childChains = childChainsOfChain[ep.chainIdx]
    if (isChainTail && childChains.length >= 2) {
      let sumHx = 0, sumHy = 0, sumChildDx = 0, sumChildDy = 0
      let maxChildT = reachMult
      for (const cc of childChains) {
        const firstChild = chains[cc][0]
        const cEnd = rotatePoint(firstChild.length, 0, firstChild.angle)
        sumHx += firstChild.x
        sumHy += firstChild.y
        sumChildDx += cEnd.x * 0.2
        sumChildDy += cEnd.y * 0.2
        const pChild = pointToSegProjection(
          firstChild.x + cEnd.x * 0.2,
          firstChild.y + cEnd.y * 0.2,
          ep.hx,
          ep.hy,
          ep.tx,
          ep.ty
        )
        if (pChild.rawT > maxChildT) maxChildT = pChild.rawT
      }
      pelvisReachMult = Math.min(2.0, Math.max(reachMult, maxChildT))
      const midX = sumHx / childChains.length + sumChildDx / childChains.length
      const midY = sumHy / childChains.length + sumChildDy / childChains.length
      extraSeedSeg = { ax: ep.tx, ay: ep.ty, bx: midX, by: midY }
    }

    return {
      bone: b,
      hx: ep.hx,
      hy: ep.hy,
      tx: ep.tx,
      ty: ep.ty,
      dx: ep.dx,
      dy: ep.dy,
      len,
      len2: len * len,
      reachMult,
      pelvisReachMult,
      strengthMult: Math.max(0.15, b.strength ?? 1.0),
      meshEnvelope: Boolean(b.meshEnvelope),
      chainIdx: ep.chainIdx,
      coreTMin: headNearOtherChain && !b.pin ? 0.28 : 0.0,
      coreTMax: tailNearOtherChain ? 0.72 : 1.0,
      extraSeedSeg
    }
  })
}

function evaluateVertexBoneScores(
  vertexIdx: number,
  x: number,
  y: number,
  metas: BoneSegmentMeta[],
  fields: BoneGeodesicField[]
): VertexBoneScore[] {
  const boneScores: VertexBoneScore[] = []
  for (let k = 0; k < metas.length; k++) {
    const m = metas[k]
    const f = fields[k]
    const proj = pointToSegProjection(x, y, m.hx, m.hy, m.tx, m.ty)

    let dAxial = 0
    if (!m.bone.pin) {
      if (proj.rawT < 0) dAxial = -proj.rawT * m.len
      else if (proj.rawT > m.pelvisReachMult) dAxial = (proj.rawT - m.pelvisReachMult) * m.len
    }

    const rawGeo = f.geoDist[vertexIdx]
    let trueGeoDist: number
    if (Number.isFinite(rawGeo)) {
      let projX = proj.projX
      let projY = proj.projY
      let euclidDist = proj.dist
      if (m.extraSeedSeg) {
        const p2 = pointToSegProjection(
          x,
          y,
          m.extraSeedSeg.ax,
          m.extraSeedSeg.ay,
          m.extraSeedSeg.bx,
          m.extraSeedSeg.by
        )
        if (p2.dist < euclidDist) {
          projX = p2.projX
          projY = p2.projY
          euclidDist = p2.dist
        }
      }
      const detour = Math.max(0, rawGeo - euclidDist * 1.06)
      const originShift = Math.hypot(f.originX[vertexIdx] - projX, f.originY[vertexIdx] - projY)
      const detourRatio = Math.min(1, detour / Math.max(12, euclidDist * 0.35))
      trueGeoDist = rawGeo + detour * 1.25 + originShift * detourRatio * 1.35
    } else {
      trueGeoDist = proj.dist + 1800
    }

    const dEff = Math.hypot(trueGeoDist, 1.85 * dAxial)
    const chainScoreDist = Math.hypot(trueGeoDist, 2.1 * dAxial)
    const radius = m.meshEnvelope
      ? Math.max(m.len * 0.38, 28) * m.strengthMult
      : Math.max(12, m.len * 0.22 * m.strengthMult)
    const dEff2 = dEff * dEff
    const affinity = (m.strengthMult * m.strengthMult) / (dEff2 + radius * radius) ** 2

    boneScores.push({
      boneIdx: k,
      id: m.bone.id,
      chainIdx: m.chainIdx,
      trueGeoDist,
      chainScoreDist,
      dEff,
      affinity
    })
  }
  return boneScores
}

function blendSiblingCrotchContinuity(
  influences: SkinInfluence[],
  bestChain: number,
  bestChainDist: number,
  chainMinDist: Float64Array,
  chains: Array<LayerRig['bones']>,
  parentChainIdx: number[],
  childChainsOfChain: number[][]
): SkinInfluence[] {
  const pChain = parentChainIdx[bestChain]
  if (pChain < 0 || childChainsOfChain[pChain].length < 2) return influences

  let minSiblingDist = Infinity
  for (const sibChain of childChainsOfChain[pChain]) {
    if (sibChain === bestChain) continue
    if (chainMinDist[sibChain] < minSiblingDist) {
      minSiblingDist = chainMinDist[sibChain]
    }
  }
  if (!Number.isFinite(minSiblingDist)) return influences

  const diff = Math.max(0, minSiblingDist - bestChainDist)
  const blendSpan = 28
  if (diff >= blendSpan) return influences

  const siblingSep = diff / blendSpan
  const parentChainBones = chains[pChain]
  const parentTailBoneId = parentChainBones[parentChainBones.length - 1]?.id
  if (!parentTailBoneId) return influences

  const scaled = influences.map((inf) => ({ id: inf.id, weight: inf.weight * siblingSep }))
  scaled.push({ id: parentTailBoneId, weight: 1 - siblingSep })
  return scaled
}

/**
 * Tính trọng số uốn Mesh dựa trên Khoảng cách Trắc địa (Geodesic Distance) đi bên trong lưới tam giác:
 * - Bám sát 100% theo hình dạng thực tế của các nếp gấp quần áo, ống quần, đế giày, mũi giày.
 * - Tự động cô lập tuyệt đối các nhánh anh em chữ V (chân trái vs chân phải) qua khe hở trong suốt của Mesh.
 * - Bảo toàn liên tục C0 tại vùng chạc hông/đũng quần khi 2 chân nối vào xương thân cha.
 */
export function buildGeodesicSkinWeights(
  world: Float32Array,
  bones: LayerRig['bones'],
  indices: ArrayLike<number>
): SkinInfluence[][] | null {
  const vCount = world.length >> 1
  if (vCount === 0 || bones.length === 0 || indices.length < 3) return null

  const graph = buildWeldedMeshGraph(world, indices)
  const { chains, parentChainIdx, boneToChainIdx } = buildAnatomicalBoneChains(bones)
  const anyMeshEnvelope = bones.some((b) => Boolean(b.meshEnvelope))

  const childChainsOfChain: number[][] = Array.from({ length: chains.length }, () => [])
  for (let c = 0; c < chains.length; c++) {
    const p = parentChainIdx[c]
    if (p >= 0 && p < chains.length) {
      childChainsOfChain[p].push(c)
    }
  }

  const metas = buildBoneSegmentMetas(bones, chains, parentChainIdx, boneToChainIdx, childChainsOfChain)
  const fields = metas.map((m) => computeBoneField(world, graph, m))

  let anyFiniteVertex = false
  for (let i = 0; i < vCount && !anyFiniteVertex; i++) {
    for (let k = 0; k < fields.length; k++) {
      if (Number.isFinite(fields[k].geoDist[i])) {
        anyFiniteVertex = true
        break
      }
    }
  }

  const out: SkinInfluence[][] = new Array(vCount)
  const unreachedVertices: number[] = []

  for (let i = 0; i < vCount; i++) {
    const x = world[i * 2]
    const y = world[i * 2 + 1]
    const vertexReachedByAnyBone = fields.some((f) => Number.isFinite(f.geoDist[i]))

    if (!vertexReachedByAnyBone && anyFiniteVertex) {
      if (anyMeshEnvelope) unreachedVertices.push(i)
      out[i] = []
      continue
    }

    const boneScores = evaluateVertexBoneScores(i, x, y, metas, fields)
    const chainMinDist = new Float64Array(chains.length).fill(Infinity)
    let bestChain = 0
    let bestChainDist = Infinity
    for (let k = 0; k < boneScores.length; k++) {
      const bs = boneScores[k]
      if (bs.chainScoreDist < chainMinDist[bs.chainIdx]) {
        chainMinDist[bs.chainIdx] = bs.chainScoreDist
      }
      if (bs.chainScoreDist < bestChainDist) {
        bestChainDist = bs.chainScoreDist
        bestChain = bs.chainIdx
      }
    }

    const validScores = boneScores.filter((bs) => bs.chainIdx === bestChain)
    let minValidDist = Infinity
    for (let k = 0; k < validScores.length; k++) {
      if (validScores[k].dEff < minValidDist) minValidDist = validScores[k].dEff
    }

    const maxBoneSpan = Math.max(minValidDist * 1.9, minValidDist + 28)
    const active = validScores.filter((bs) => validScores.length === 1 || bs.dEff <= maxBoneSpan)
    const finalCandidates = active.length > 0 ? active : validScores
    finalCandidates.sort((a, b) => b.affinity - a.affinity)

    const top = finalCandidates.slice(0, 3)
    const sum = top.reduce((s, w) => s + w.affinity, 0) || 1
    const baseInfluences = top.map((w) => ({ id: w.id, weight: w.affinity / sum }))

    out[i] = blendSiblingCrotchContinuity(
      baseInfluences,
      bestChain,
      bestChainDist,
      chainMinDist,
      chains,
      parentChainIdx,
      childChainsOfChain
    )
  }

  for (const u of unreachedVertices) {
    const ux = world[u * 2]
    const uy = world[u * 2 + 1]
    let nearest = -1
    let nearestDist = Infinity
    for (let j = 0; j < vCount; j++) {
      if (!out[j] || out[j].length === 0) continue
      const d = Math.hypot(ux - world[j * 2], uy - world[j * 2 + 1])
      if (d < nearestDist) {
        nearestDist = d
        nearest = j
      }
    }
    if (nearest >= 0) {
      out[u] = out[nearest].map((inf) => ({ ...inf }))
    }
  }

  return out
}

/**
 * Xác định xương chủ quản (dominant bone) cho từng tam giác của lưới Mesh.
 * Phục vụ hiển thị trực quan vùng uốn "Bám sát Mesh" (theo đúng nếp gấp quần áo, giày, thân) trên Sân khấu 2D.
 */
export function computeDominantBonePerTriangle(
  world: Float32Array,
  bones: LayerRig['bones'],
  indices: ArrayLike<number>,
  precomputedWeights?: SkinInfluence[][]
): string[] {
  const weights = precomputedWeights ?? buildGeodesicSkinWeights(world, bones, indices)
  const triCount = Math.floor(indices.length / 3)
  const result: string[] = new Array(triCount)
  if (!weights || bones.length === 0) {
    return result.fill('')
  }

  for (let t = 0; t < triCount; t++) {
    const a = indices[t * 3]
    const b = indices[t * 3 + 1]
    const c = indices[t * 3 + 2]
    const totals = new Map<string, number>()
    for (const v of [a, b, c]) {
      const infs = weights[v]
      if (!infs) continue
      for (let j = 0; j < infs.length; j++) {
        const inf = infs[j]
        totals.set(inf.id, (totals.get(inf.id) ?? 0) + inf.weight)
      }
    }
    let bestId = ''
    let bestW = 0
    for (const [id, w] of totals.entries()) {
      if (w > bestW) {
        bestW = w
        bestId = id
      }
    }
    result[t] = bestId
  }
  return result
}
