import type { LayerRig } from '@shared/layerRig'
import { rotatePoint } from './layerRig'
import type { SkinBinding, SkinInfluence } from './layerSkinning'
import { computeMeshCorridor, computeMeshCorridorJs } from './meshCorridor'
import {
  buildGeodesicSkinWeightsJs,
  buildPackedGeodesicSkinWeights,
  packSkinInfluences,
  type PackedSkinWeights
} from './meshGeodesicSkinning'
import { unpackSkinWeights } from './wasm/wasmGeodesicBridge'

export interface CachedSkinWeightsEntry {
  key: string
  weights: SkinInfluence[][]
  packed: PackedSkinWeights
}

const weightCache = new WeakMap<Float32Array, CachedSkinWeightsEntry>()
const sharedTopologyWeightCache = new Map<
  string,
  { weights: SkinInfluence[][]; packed: PackedSkinWeights }
>()
const MAX_SHARED_TOPOLOGY_CACHE = 96

function buildBonesSignature(bones: LayerRig['bones']): string {
  let sig = 'v4;'
  for (let i = 0; i < bones.length; i++) {
    const b = bones[i]
    sig += `${b.id}|${b.parentId ?? ''}|${b.x.toFixed(2)},${b.y.toFixed(2)},${b.length.toFixed(2)},${b.angle.toFixed(2)},${(b.strength ?? 1).toFixed(2)},${(b.influenceReach ?? 1).toFixed(2)},${b.meshEnvelope ? 1 : 0},${b.pin ? 1 : 0};`
  }
  return sig
}

function buildGeometrySignature(positions: Float32Array, indices?: ArrayLike<number>): string {
  const n = positions.length
  if (n < 6) return `v${n}`
  const mid = Math.floor(n / 6) * 3
  const end = n - 3
  return `v${n}:i${indices?.length ?? 0}:${positions[0].toFixed(2)},${positions[1].toFixed(2)}:${positions[mid].toFixed(2)},${positions[mid + 1].toFixed(2)}:${positions[end].toFixed(2)},${positions[end + 1].toFixed(2)}`
}

function isCoincidentWithTail(
  parent: LayerRig['bones'][number],
  child: LayerRig['bones'][number]
): boolean {
  if (child.parentJoint === 'head') return false
  const pEnd = rotatePoint(parent.length, 0, parent.angle)
  return Math.hypot(child.x - (parent.x + pEnd.x), child.y - (parent.y + pEnd.y)) <= 8
}

function buildBoneChains(bones: LayerRig['bones']): Array<LayerRig['bones']> {
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
  for (const b of bones) {
    const parent = b.parentId ? byId.get(b.parentId) : undefined
    const isCoincident = parent ? isCoincidentWithTail(parent, b) : false
    const isStart = !parent || (children.get(parent.id)?.length ?? 0) > 1 || !isCoincident
    if (!isStart) continue
    const chain: LayerRig['bones'] = [b]
    let cur = b
    while (true) {
      const kids = children.get(cur.id)
      if (!kids || kids.length !== 1) break
      const next = kids[0]
      if (!isCoincidentWithTail(cur, next)) break
      cur = next
      chain.push(cur)
    }
    chains.push(chain)
  }
  return chains.length ? chains : bones.map((b) => [b])
}

interface CorridorCandidateItem {
  id: string
  dEff: number
  raw: number
  cw: number
}

interface CorridorChainGroup {
  chainIdx: number
  minDist: number
  items: CorridorCandidateItem[]
}

function collectChainCandidates(
  x: number,
  y: number,
  vertexIdx: number,
  chainMeta: Array<{
    chain: LayerRig['bones']
    ends: Array<{ x: number; y: number }>
    corridor: ReturnType<typeof computeMeshCorridor>
  }>
): CorridorChainGroup[] {
  const groups: CorridorChainGroup[] = []
  for (let c = 0; c < chainMeta.length; c++) {
    const { chain, ends, corridor } = chainMeta[c]
    if (!corridor) continue
    const cw = corridor.weights[vertexIdx]
    if (cw <= 1e-4) continue

    let cMinDist = Infinity
    const items: CorridorCandidateItem[] = []
    const lastIdx = chain.length - 1
    const lo = Math.max(0, Math.min(lastIdx, corridor.segMin[vertexIdx] - 1))

    for (let s = lo; s <= lastIdx; s++) {
      const b = chain[s]
      const end = ends[s]
      const reachMult = Math.max(0.5, Math.min(3.0, b.influenceReach ?? 1.0))
      const len = b.length * reachMult
      const baseLen2 = b.length * b.length || 1
      const rawT = ((x - b.x) * end.x + (y - b.y) * end.y) / baseLen2
      const clampT = Math.min(1, Math.max(0, rawT))
      const dPerp = Math.hypot(x - b.x - clampT * end.x, y - b.y - clampT * end.y)
      let dAxial = 0
      if (!b.pin) {
        if (rawT < 0) dAxial = -rawT * len
        else if (rawT > reachMult) dAxial = (rawT - reachMult) * len
      }
      const sMult = Math.max(0.1, b.strength ?? 1)
      const isMeshEnvelope = Boolean(b.meshEnvelope)
      const effCw = isMeshEnvelope ? 1.0 : cw
      const radius = isMeshEnvelope
        ? Math.max(len * 0.4, 32) * sMult
        : Math.max(1, len * 0.15 * sMult)
      const dEff = Math.hypot(dPerp, Math.sqrt(5.0) * dAxial)
      const dEff2 = dPerp * dPerp + 5.0 * dAxial * dAxial
      const affinity = (sMult * sMult) / (dEff2 + radius * radius) ** 2
      items.push({ id: b.id, dEff, raw: effCw * affinity, cw: effCw })
      if (dEff < cMinDist) cMinDist = dEff
    }
    if (items.length > 0) groups.push({ chainIdx: c, minDist: cMinDist, items })
  }
  return groups
}

function finalizeVertexCorridorWeights(
  groups: CorridorChainGroup[],
  bones: LayerRig['bones']
): SkinInfluence[] {
  if (!groups.length) return []
  let selected = groups
  if (groups.length > 1) {
    const best = groups.reduce((prev, cur) => (cur.minDist < prev.minDist ? cur : prev))
    const close = groups.filter((cc) => cc.minDist <= Math.min(best.minDist * 1.35, best.minDist + 16))
    selected = close.length > 0 ? close : [best]
  }
  const candidates: CorridorCandidateItem[] = []
  let minDist = Infinity
  for (const sc of selected) {
    for (const item of sc.items) {
      candidates.push(item)
      if (item.dEff < minDist) minDist = item.dEff
    }
  }
  const maxAllowed = Math.max(minDist * 2.0, minDist + 16)
  const active = candidates.filter((c) => candidates.length === 1 || c.dEff <= maxAllowed)
  const list = active.length > 0 ? active : candidates
  list.sort((a, b) => b.raw - a.raw)
  const top = list.slice(0, 4)
  const rawSum = top.reduce((s, w) => s + w.raw, 0) || 1
  const hasMeshEnvelope = selected.some((sc) =>
    sc.items.some((it) => bones.find((b) => b.id === it.id)?.meshEnvelope)
  )
  const rawEnvelope = top.reduce((s, w) => s + w.cw, 0)
  const envelope = hasMeshEnvelope ? 1.0 : Math.min(1, rawEnvelope)
  return top.map((w) => ({ id: w.id, weight: (w.raw / rawSum) * envelope }))
}

function buildCorridorWeights(
  world: Float32Array,
  bones: LayerRig['bones'],
  indices: ArrayLike<number>,
  forceJs: boolean
): SkinInfluence[][] | null {
  const vCount = world.length >> 1
  const chains = buildBoneChains(bones)
  const chainMeta = chains.map((chain) => {
    const ends = chain.map((b) => rotatePoint(b.length, 0, b.angle))
    const points = [
      { x: chain[0].x, y: chain[0].y },
      ...chain.map((b, idx) => ({ x: b.x + ends[idx].x, y: b.y + ends[idx].y }))
    ]
    const corridor = forceJs
      ? computeMeshCorridorJs(world, indices, points)
      : computeMeshCorridor(world, indices, points)
    return { chain, ends, corridor }
  })
  if (chainMeta.every((m) => m.corridor === null)) return null

  const out: SkinInfluence[][] = new Array(vCount)
  for (let i = 0; i < vCount; i++) {
    const groups = collectChainCandidates(world[i * 2], world[i * 2 + 1], i, chainMeta)
    out[i] = finalizeVertexCorridorWeights(groups, bones)
  }
  return out
}

export function skinWeights(x: number, y: number, bones: LayerRig['bones']): SkinInfluence[] {
  if (!bones.length) return []
  const candidates: Array<{ id: string; dEff: number; weight: number }> = []
  let minDist = Infinity
  for (const b of bones) {
    const end = rotatePoint(b.length, 0, b.angle)
    const reachMult = Math.max(0.5, Math.min(3.0, b.influenceReach ?? 1.0))
    const len = b.length * reachMult
    const baseLen2 = b.length * b.length || 1
    const rawT = ((x - b.x) * end.x + (y - b.y) * end.y) / baseLen2
    const clampT = Math.min(1, Math.max(0, rawT))
    const dPerp = Math.hypot(x - b.x - clampT * end.x, y - b.y - clampT * end.y)
    let dAxial = 0
    if (!b.pin) {
      if (rawT < 0) dAxial = -rawT * len
      else if (rawT > reachMult) dAxial = (rawT - reachMult) * len
    }
    const sMult = Math.max(0.1, b.strength ?? 1)
    const radius = Math.max(1, len * 0.15 * sMult)
    const dEff = Math.hypot(dPerp, Math.sqrt(5.0) * dAxial)
    const dEff2 = dPerp * dPerp + 5.0 * dAxial * dAxial
    const weight = (sMult * sMult) / (dEff2 + radius * radius) ** 2
    candidates.push({ id: b.id, dEff, weight })
    if (dEff < minDist) minDist = dEff
  }

  const maxAllowed = Math.max(minDist * 2.0, minDist + 16)
  const active = candidates.filter((c) => candidates.length === 1 || c.dEff <= maxAllowed)
  const list = active.length > 0 ? active : candidates
  list.sort((a, b) => b.weight - a.weight)
  const top = list.slice(0, 4)
  const sum = top.reduce((s, w) => s + w.weight, 0) || 1
  return top.map((w) => ({ id: w.id, weight: w.weight / sum }))
}

function computeSkinWeightsUncached(
  positions: Float32Array,
  binding: SkinBinding,
  bones: LayerRig['bones'],
  indices: ArrayLike<number> | undefined,
  forceJs: boolean
): { weights: SkinInfluence[][]; packed: PackedSkinWeights } {
  const scale = binding.scale ?? 1
  const rot = binding.bindPose?.rotation ?? binding.rotation ?? 0
  const bx = binding.bindPose?.x ?? binding.x ?? 0
  const by = binding.bindPose?.y ?? binding.y ?? 0
  const vCount = positions.length / 3
  const sx = scale * (binding.scaleX ?? 1)
  const sy = scale * (binding.scaleY ?? 1)
  const world = new Float32Array(vCount * 2)
  for (let i = 0; i < vCount; i++) {
    const p = rotatePoint(positions[i * 3] * sx, -positions[i * 3 + 1] * sy, rot)
    world[i * 2] = p.x + bx
    world[i * 2 + 1] = p.y + by
  }

  const useCorridor = Boolean(indices && indices.length >= 3 && vCount > 3)
  let weights: SkinInfluence[][] | null = null
  let packed: PackedSkinWeights | null = null

  if (useCorridor) {
    const needGeo =
      bones.length >= 2 ||
      Boolean(binding.isolateToBoundBones) ||
      bones.some((b) => Boolean(b.meshEnvelope))
    if (needGeo) {
      if (forceJs) {
        weights = buildGeodesicSkinWeightsJs(world, bones, indices!)
      } else {
        packed = buildPackedGeodesicSkinWeights(world, bones, indices!)
        if (packed) weights = unpackSkinWeights(packed)
      }
    } else {
      weights = buildCorridorWeights(world, bones, indices!, forceJs)
    }
  }

  if (!weights) {
    weights = new Array(vCount)
    for (let i = 0; i < vCount; i++) {
      weights[i] = skinWeights(world[i * 2], world[i * 2 + 1], bones)
    }
  }
  if (!packed) packed = packSkinInfluences(weights, bones)
  return { weights, packed }
}

export function cachedSkinWeights(
  positions: Float32Array,
  binding: SkinBinding,
  bones: LayerRig['bones'],
  indices?: ArrayLike<number>,
  forceJs = false
): { weights: SkinInfluence[][]; packed: PackedSkinWeights } {
  if (forceJs) {
    return computeSkinWeightsUncached(positions, binding, bones, indices, true)
  }
  const scale = binding.scale ?? 1
  const rot = binding.bindPose?.rotation ?? binding.rotation ?? 0
  const bx = binding.bindPose?.x ?? binding.x ?? 0
  const by = binding.bindPose?.y ?? binding.y ?? 0
  const vCount = positions.length / 3
  const useCorridor = Boolean(indices && indices.length >= 3 && vCount > 3)
  const key = `${bx.toFixed(2)}:${by.toFixed(2)}:${rot.toFixed(2)}:${scale.toFixed(4)}:${(binding.scaleX ?? 1).toFixed(4)}:${(binding.scaleY ?? 1).toFixed(4)}:${useCorridor ? indices!.length : 0}:${buildBonesSignature(bones)}`

  const cached = weightCache.get(positions)
  if (cached?.key === key) return cached

  const topoKey = `${buildGeometrySignature(positions, useCorridor ? indices : undefined)}|${key}`
  const shared = sharedTopologyWeightCache.get(topoKey)
  if (shared) {
    weightCache.set(positions, { key, ...shared })
    return shared
  }

  const computed = computeSkinWeightsUncached(positions, binding, bones, indices, false)
  weightCache.set(positions, { key, ...computed })
  sharedTopologyWeightCache.set(topoKey, computed)
  if (sharedTopologyWeightCache.size > MAX_SHARED_TOPOLOGY_CACHE) {
    const oldest = sharedTopologyWeightCache.keys().next().value
    if (oldest !== undefined) sharedTopologyWeightCache.delete(oldest)
  }
  return computed
}
