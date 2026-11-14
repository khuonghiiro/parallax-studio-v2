import type { LayerRig } from '@shared/layerRig'
import type { SkinInfluence } from '../layerSkinning'
import type { MeshCorridorResult, Point2D } from '../meshCorridor'
import { allocScratchViews, getWasmExports, resolveSlotView } from './wasmRuntime'

export interface PackedSkinWeights {
  indices: Int32Array
  weights: Float32Array
  boneIds: string[]
}

function writeIndicesToView(target: Uint32Array, indices: ArrayLike<number>): void {
  if (indices instanceof Uint32Array && target.length === indices.length) {
    target.set(indices)
    return
  }
  for (let i = 0; i < indices.length; i++) {
    target[i] = indices[i]
  }
}

export function wasmBuildPackedGeodesicSkinWeights(
  world: Float32Array,
  bones: LayerRig['bones'],
  indices: ArrayLike<number>
): PackedSkinWeights | null {
  const exports = getWasmExports()
  const fn = exports?.rust_build_geodesic_skin_weights
  if (!exports || !fn) return null

  const vCount = world.length >> 1
  const boneCount = bones.length
  const indexCount = indices.length
  if (vCount === 0 || boneCount === 0 || indexCount < 3) return null

  const slots = allocScratchViews(exports, {
    world: { kind: 'f32', length: vCount * 2 },
    bonesMeta: { kind: 'f32', length: boneCount * 8 },
    indices: { kind: 'u32', length: indexCount },
    outIdx: { kind: 'i32', length: vCount * 4 },
    outW: { kind: 'f32', length: vCount * 4 }
  })

  slots.world.view.set(world.subarray(0, vCount * 2))
  writeIndicesToView(slots.indices.view, indices)

  const boneIdToIdx = new Map<string, number>()
  const boneIds = new Array<string>(boneCount)
  for (let i = 0; i < boneCount; i++) {
    boneIdToIdx.set(bones[i].id, i)
    boneIds[i] = bones[i].id
  }

  const metaView = slots.bonesMeta.view
  for (let i = 0; i < boneCount; i++) {
    const b = bones[i]
    const base = i * 8
    metaView[base] = b.x
    metaView[base + 1] = b.y
    metaView[base + 2] = b.length
    metaView[base + 3] = b.angle
    metaView[base + 4] = b.strength ?? 1.0
    metaView[base + 5] = b.influenceReach ?? 1.0
    const flags =
      (b.parentJoint === 'head' ? 1 : 0) | (b.meshEnvelope ? 2 : 0) | (b.pin ? 4 : 0)
    metaView[base + 6] = flags
    metaView[base + 7] = b.parentId ? (boneIdToIdx.get(b.parentId) ?? -1) : -1
  }

  const ok = fn(
    slots.world.ptr,
    vCount,
    slots.bonesMeta.ptr,
    boneCount,
    slots.indices.ptr,
    indexCount,
    slots.outIdx.ptr,
    slots.outW.ptr
  )
  if (!ok) return null

  const safeIdx = resolveSlotView(exports, slots.outIdx, 'i32', vCount * 4)
  const safeW = resolveSlotView(exports, slots.outW, 'f32', vCount * 4)
  return {
    indices: safeIdx.slice(),
    weights: safeW.slice(),
    boneIds
  }
}

export function unpackSkinWeights(packed: PackedSkinWeights): SkinInfluence[][] {
  const vCount = packed.indices.length >> 2
  const out: SkinInfluence[][] = new Array(vCount)
  for (let v = 0; v < vCount; v++) {
    const base = v * 4
    const list: SkinInfluence[] = []
    for (let s = 0; s < 4; s++) {
      const bi = packed.indices[base + s]
      if (bi < 0 || bi >= packed.boneIds.length) continue
      list.push({ id: packed.boneIds[bi], weight: packed.weights[base + s] })
    }
    out[v] = list
  }
  return out
}

export function wasmComputeDominantBonePerTriangle(
  indices: ArrayLike<number>,
  packed: PackedSkinWeights
): string[] | null {
  const exports = getWasmExports()
  const fn = exports?.rust_dominant_bone_per_triangle
  if (!exports || !fn) return null

  const indexCount = indices.length
  const vCount = packed.indices.length >> 2
  const triCount = Math.floor(indexCount / 3)
  if (triCount === 0 || vCount === 0) return null

  const slots = allocScratchViews(exports, {
    indices: { kind: 'u32', length: indexCount },
    vbIdx: { kind: 'i32', length: packed.indices.length },
    vbW: { kind: 'f32', length: packed.weights.length },
    outTri: { kind: 'i32', length: triCount }
  })

  writeIndicesToView(slots.indices.view, indices)
  slots.vbIdx.view.set(packed.indices)
  slots.vbW.view.set(packed.weights)

  const ok = fn(
    slots.indices.ptr,
    indexCount,
    slots.vbIdx.ptr,
    slots.vbW.ptr,
    vCount,
    slots.outTri.ptr
  )
  if (!ok) return null

  const safeOut = resolveSlotView(exports, slots.outTri, 'i32', triCount)
  const result = new Array<string>(triCount)
  for (let t = 0; t < triCount; t++) {
    const bi = safeOut[t]
    result[t] = bi >= 0 && bi < packed.boneIds.length ? packed.boneIds[bi] : ''
  }
  return result
}

export function wasmComputeMeshCorridor(
  world: Float32Array,
  indices: ArrayLike<number>,
  polyline: ReadonlyArray<Point2D>,
  reach?: number
): MeshCorridorResult | null {
  const exports = getWasmExports()
  const fn = exports?.rust_compute_mesh_corridor
  if (!exports || !fn) return null

  const vCount = world.length >> 1
  const indexCount = indices.length
  const polyCount = polyline.length
  if (vCount === 0 || indexCount < 3 || polyCount < 2) return null

  const slots = allocScratchViews(exports, {
    world: { kind: 'f32', length: vCount * 2 },
    indices: { kind: 'u32', length: indexCount },
    poly: { kind: 'f32', length: polyCount * 2 },
    outWeights: { kind: 'f32', length: vCount },
    outGeo: { kind: 'f32', length: vCount },
    outSegMin: { kind: 'i16', length: vCount },
    outSegMax: { kind: 'i16', length: vCount },
    outAvgCore: { kind: 'f32', length: 1 }
  })

  slots.world.view.set(world.subarray(0, vCount * 2))
  writeIndicesToView(slots.indices.view, indices)
  const polyView = slots.poly.view
  for (let i = 0; i < polyCount; i++) {
    polyView[i * 2] = polyline[i].x
    polyView[i * 2 + 1] = polyline[i].y
  }

  const ok = fn(
    slots.world.ptr,
    vCount,
    slots.indices.ptr,
    indexCount,
    slots.poly.ptr,
    polyCount,
    reach ?? 0,
    slots.outWeights.ptr,
    slots.outGeo.ptr,
    slots.outSegMin.ptr,
    slots.outSegMax.ptr,
    slots.outAvgCore.ptr
  )
  if (!ok) return null

  const safeW = resolveSlotView(exports, slots.outWeights, 'f32', vCount)
  const safeGeo = resolveSlotView(exports, slots.outGeo, 'f32', vCount)
  const safeSMin = resolveSlotView(exports, slots.outSegMin, 'i16', vCount)
  const safeSMax = resolveSlotView(exports, slots.outSegMax, 'i16', vCount)
  const safeAvg = resolveSlotView(exports, slots.outAvgCore, 'f32', 1)

  return {
    weights: safeW.slice(),
    geoDist: safeGeo.slice(),
    segMin: safeSMin.slice(),
    segMax: safeSMax.slice(),
    avgCoreEdge: safeAvg[0]
  }
}
