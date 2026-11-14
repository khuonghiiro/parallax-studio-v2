import type {
  BaseSurface,
  BendModifier,
  ImageMeshModifier,
  MeshMotionConfig
} from '@shared/imageMeshDefinition'
import type { LayerRig } from '@shared/layerRig'
import type { PlantSpinePoint } from '@shared/plantSpine'
import type { BoneTransform } from '../layerRig'
import type { SkinBinding } from '../layerSkinning'
import type { PackedSkinWeights } from './wasmGeodesicBridge'
import { allocScratchViews, getWasmExports, resolveSlotView, type PxsWasmExports } from './wasmRuntime'

export interface SpineEvalFrame {
  rest: PlantSpinePoint[]
  bent: PlantSpinePoint[]
  rot: number[]
  stretch?: number[]
}

const DEG_TO_RAD = Math.PI / 180
const BEND_REGION_MAP: Record<NonNullable<BendModifier['region']>, number> = {
  all: 0,
  bottom: 1,
  top: 2,
  left: 3,
  right: 4,
  curl: 5
}
const DEPTH_PROFILE_MAP: Record<string, number> = {
  none: 0,
  ridge: 1,
  sphere: 2,
  cylinder: 3,
  slope: 4,
  luminance: 5
}
const BRUSH_MODE_MAP: Record<string, number> = {
  inflate: 0,
  deflate: 1,
  grab: 2,
  smooth: 3
}
const MOTION_TYPE_MAP: Record<string, number> = {
  none: 0,
  wind: 1,
  wave: 2,
  breathe: 3,
  wiggle: 4
}
const MOTION_DIR_MAP: Record<string, number> = {
  horizontal: 0,
  depthZ: 1,
  both: 2,
  vertical: 3
}

function packSkinBonesAndMeta(
  boneIds: string[],
  boneById: Map<string, LayerRig['bones'][number]>,
  transforms: Map<string, BoneTransform>,
  binding: SkinBinding,
  bonesOut: Float32Array,
  metaOut: Float32Array
): void {
  for (let i = 0; i < boneIds.length; i++) {
    const id = boneIds[i]
    const b = boneById.get(id)!
    const tf = transforms.get(id)!
    const rad = tf.rotation * DEG_TO_RAD
    const o = i * 9
    bonesOut[o] = b.x
    bonesOut[o + 1] = b.y
    bonesOut[o + 2] = tf.x
    bonesOut[o + 3] = tf.y
    bonesOut[o + 4] = Math.cos(rad)
    bonesOut[o + 5] = Math.sin(rad)
    bonesOut[o + 6] = tf.scaleX ?? 1
    bonesOut[o + 7] = tf.scaleY ?? 1
    bonesOut[o + 8] = tf.rotation
  }

  const scale = binding.scale ?? 1
  const sx = scale * (binding.scaleX ?? 1)
  const sy = scale * (binding.scaleY ?? 1)
  const restRot = binding.bindPose?.rotation ?? binding.rotation ?? 0
  const curRot = binding.rotation ?? restRot
  const restRad = restRot * DEG_TO_RAD
  const invCurRad = -curRot * DEG_TO_RAD
  metaOut.set([
    sx,
    sy,
    binding.bindPose?.x ?? binding.x ?? 0,
    binding.bindPose?.y ?? binding.y ?? 0,
    Math.cos(restRad),
    Math.sin(restRad),
    binding.x ?? binding.bindPose?.x ?? 0,
    binding.y ?? binding.bindPose?.y ?? 0,
    Math.cos(invCurRad),
    Math.sin(invCurRad),
    1 / sx,
    1 / sy
  ])
}

export function wasmDeformSkin(
  positions: Float32Array,
  output: Float32Array,
  packed: PackedSkinWeights,
  bones: LayerRig['bones'],
  transforms: Map<string, BoneTransform>,
  binding: SkinBinding,
  clothFactor: number
): boolean {
  const exports = getWasmExports()
  const fn = exports?.rust_deform_skin
  const vCount = (positions.length / 3) | 0
  const boneCount = packed.boneIds.length
  if (!exports || !fn || vCount === 0 || boneCount === 0) return false

  const boneById = new Map(bones.map((b) => [b.id, b]))
  for (let i = 0; i < boneCount; i++) {
    const id = packed.boneIds[i]
    if (!boneById.has(id) || !transforms.has(id)) return false
  }

  const slots = allocScratchViews(exports, {
    pos: { kind: 'f32', length: vCount * 3 },
    out: { kind: 'f32', length: vCount * 3 },
    pIdx: { kind: 'i32', length: vCount * 4 },
    pW: { kind: 'f32', length: vCount * 4 },
    bonesTf: { kind: 'f32', length: boneCount * 9 },
    meta: { kind: 'f32', length: 12 }
  })

  slots.pos.view.set(positions.subarray(0, vCount * 3))
  slots.pIdx.view.set(packed.indices.subarray(0, vCount * 4))
  slots.pW.view.set(packed.weights.subarray(0, vCount * 4))
  packSkinBonesAndMeta(packed.boneIds, boneById, transforms, binding, slots.bonesTf.view, slots.meta.view)

  const primaryIdx = binding.boneId ? packed.boneIds.indexOf(binding.boneId) : -1
  const ok = fn(
    slots.pos.ptr,
    slots.out.ptr,
    vCount,
    slots.pIdx.ptr,
    slots.pW.ptr,
    slots.bonesTf.ptr,
    boneCount,
    slots.meta.ptr,
    primaryIdx,
    clothFactor
  )
  if (!ok) return false

  output.set(resolveSlotView(exports, slots.out, 'f32', vCount * 3))
  return true
}

export function wasmDeformPlantSpines(
  positions: Float32Array,
  output: Float32Array,
  world: Float32Array | null,
  packedPerSpine: Float32Array,
  frames: SpineEvalFrame[],
  binding: SkinBinding
): boolean {
  const exports = getWasmExports()
  const fn = exports?.rust_deform_plant_spines
  const vCount = (positions.length / 3) | 0
  const spineCount = frames.length
  if (!exports || !fn || vCount === 0 || spineCount === 0) return false

  let totalSamples = 0
  for (let k = 0; k < spineCount; k++) totalSamples += frames[k].rest.length

  const slots = allocScratchViews(exports, {
    pos: { kind: 'f32', length: vCount * 3 },
    out: { kind: 'f32', length: vCount * 3 },
    world: { kind: 'f32', length: world ? vCount * 2 : 1 },
    proj: { kind: 'f32', length: packedPerSpine.length },
    frames: { kind: 'f32', length: Math.max(1, totalSamples * 6) },
    offsets: { kind: 'u32', length: spineCount + 1 },
    meta: { kind: 'f32', length: 8 }
  })

  slots.pos.view.set(positions.subarray(0, vCount * 3))
  if (world) slots.world.view.set(world.subarray(0, vCount * 2))
  slots.proj.view.set(packedPerSpine)

  let cursor = 0
  for (let k = 0; k < spineCount; k++) {
    slots.offsets.view[k] = cursor
    const fr = frames[k]
    for (let s = 0; s < fr.rest.length; s++) {
      const o = (cursor + s) * 6
      slots.frames.view[o] = fr.rest[s].x
      slots.frames.view[o + 1] = fr.rest[s].y
      slots.frames.view[o + 2] = fr.bent[s].x
      slots.frames.view[o + 3] = fr.bent[s].y
      slots.frames.view[o + 4] = fr.rot[s]
      slots.frames.view[o + 5] = fr.stretch ? fr.stretch[s] : 0
    }
    cursor += fr.rest.length
  }
  slots.offsets.view[spineCount] = cursor

  const scale = binding.scale ?? 1
  const sx = scale * (binding.scaleX ?? 1)
  const sy = scale * (binding.scaleY ?? 1)
  const rad = (binding.rotation ?? 0) * DEG_TO_RAD
  slots.meta.view.set([
    sx,
    sy,
    binding.x ?? 0,
    binding.y ?? 0,
    Math.cos(rad),
    Math.sin(rad),
    1 / sx,
    1 / sy
  ])

  const ok = fn(
    slots.pos.ptr,
    slots.out.ptr,
    vCount,
    world ? slots.world.ptr : 0,
    world ? 1 : 0,
    slots.proj.ptr,
    slots.frames.ptr,
    slots.offsets.ptr,
    spineCount,
    slots.meta.ptr
  )
  if (!ok) return false

  output.set(resolveSlotView(exports, slots.out, 'f32', vCount * 3))
  return true
}

export function wasmScaleUnitSpace(
  posIn: Float32Array,
  posOut: Float32Array,
  count: number,
  invW: number,
  invH: number
): boolean {
  const exports = getWasmExports()
  const fn = exports?.rust_scale_unit_space
  if (!exports || !fn || count <= 0) return false

  const len = count * 3
  const slots = allocScratchViews(exports, { buf: { kind: 'f32', length: len } })
  slots.buf.view.set(posIn.subarray(0, len))
  if (!fn(slots.buf.ptr, slots.buf.ptr, count, invW, invH)) return false
  posOut.set(resolveSlotView(exports, slots.buf, 'f32', len).subarray(0, len))
  return true
}

interface PackedModifierBuffers {
  curveData: number[]
  curveStarts: number[]
  latticeData: number[]
  latticeStarts: number[]
  brushData: number[]
  brushStarts: number[]
}

function packModifierBuffers(
  modifiers: ImageMeshModifier[],
  surface: BaseSurface
): PackedModifierBuffers {
  const res: PackedModifierBuffers = {
    curveData: [],
    curveStarts: [],
    latticeData: [],
    latticeStarts: [],
    brushData: [],
    brushStarts: []
  }
  const { width, height } = surface
  for (let m = 0; m < modifiers.length; m++) {
    const mod = modifiers[m]
    if (!mod.enabled) continue
    if (mod.type === 'curve' && mod.controlPoints?.length >= 2) {
      res.curveStarts[m] = res.curveData.length
      for (const cp of mod.controlPoints) {
        res.curveData.push(cp.position[0] * width, (cp.position[1] - 0.5) * height, cp.position[2] * width)
      }
    } else if (
      mod.type === 'lattice' &&
      mod.dimensions[0] === 4 &&
      mod.dimensions[1] === 4 &&
      mod.offsets?.length >= 16
    ) {
      res.latticeStarts[m] = res.latticeData.length
      for (let i = 0; i < 16; i++) {
        const off = mod.offsets[i]
        res.latticeData.push(off?.[0] ?? 0, off?.[1] ?? 0, off?.[2] ?? 0)
      }
    } else if (mod.type === 'sculpt' && mod.strokes?.length) {
      res.brushStarts[m] = res.brushData.length
      for (const st of mod.strokes) {
        const d = st.direction ?? [0, 0, 0]
        res.brushData.push(
          st.uv[0],
          st.uv[1],
          st.pressure,
          st.radius,
          BRUSH_MODE_MAP[st.mode] ?? 0,
          d[0],
          d[1],
          d[2]
        )
      }
    }
  }
  return res
}

function applySingleModifierWasm(
  exports: PxsWasmExports,
  mod: ImageMeshModifier,
  m: number,
  posPtr: number,
  uvsPtr: number,
  curvePtr: number,
  latticePtr: number,
  brushPtr: number,
  count: number,
  surface: BaseSurface,
  packed: PackedModifierBuffers
): boolean {
  if (mod.type === 'bend') {
    return Boolean(
      exports.rust_apply_bend?.(
        posPtr,
        uvsPtr,
        count,
        surface.width,
        surface.height,
        mod.axis === 'y' ? 1 : 0,
        mod.intensity,
        mod.arcAngle ?? 0,
        mod.taperRatio ?? 1,
        mod.lateral ?? 0,
        BEND_REGION_MAP[mod.region ?? 'all'] ?? 0
      )
    )
  }
  if (mod.type === 'twist') {
    return Boolean(exports.rust_apply_twist?.(posPtr, uvsPtr, count, mod.angle, mod.center ?? 0.5, mod.falloff ?? 1.0))
  }
  if (mod.type === 'depthProfile') {
    return Boolean(
      exports.rust_apply_depth_profile?.(
        posPtr,
        uvsPtr,
        count,
        DEPTH_PROFILE_MAP[mod.profile] ?? 0,
        mod.intensity,
        mod.invert ? 1 : 0
      )
    )
  }
  if (mod.type === 'curve' && packed.curveStarts[m] !== undefined) {
    return Boolean(
      exports.rust_apply_curve?.(posPtr, uvsPtr, count, curvePtr + packed.curveStarts[m] * 4, mod.controlPoints.length)
    )
  }
  if (mod.type === 'lattice' && packed.latticeStarts[m] !== undefined) {
    return Boolean(exports.rust_apply_lattice?.(posPtr, uvsPtr, count, latticePtr + packed.latticeStarts[m] * 4))
  }
  if (mod.type === 'sculpt' && packed.brushStarts[m] !== undefined) {
    return Boolean(
      exports.rust_apply_brush?.(
        posPtr,
        uvsPtr,
        count,
        brushPtr + packed.brushStarts[m] * 4,
        mod.strokes.length,
        surface.width,
        surface.height
      )
    )
  }
  return true
}

function executeModifiersInScratch(
  exports: PxsWasmExports,
  posPtr: number,
  uvsPtr: number,
  curvePtr: number,
  latticePtr: number,
  brushPtr: number,
  count: number,
  modifiers: ImageMeshModifier[],
  surface: BaseSurface,
  packed: PackedModifierBuffers
): boolean {
  for (let m = 0; m < modifiers.length; m++) {
    const mod = modifiers[m]
    if (!mod.enabled) continue
    const ok = applySingleModifierWasm(
      exports, mod, m, posPtr, uvsPtr, curvePtr, latticePtr, brushPtr, count, surface, packed
    )
    if (!ok) return false
  }
  return true
}

export function wasmEvaluateMeshModifiers(
  pos: Float32Array,
  uvs: Float32Array,
  count: number,
  modifiers: ImageMeshModifier[],
  surface: BaseSurface,
  motion: MeshMotionConfig | undefined,
  time: number,
  unitSpace: boolean
): boolean {
  const exports = getWasmExports()
  if (!exports?.rust_apply_bend || !exports.rust_scale_unit_space || count <= 0) return false

  const packed = packModifierBuffers(modifiers, surface)
  const slots = allocScratchViews(exports, {
    pos: { kind: 'f32', length: count * 3 },
    uvs: { kind: 'f32', length: count * 2 },
    curve: { kind: 'f32', length: Math.max(1, packed.curveData.length) },
    lattice: { kind: 'f32', length: Math.max(1, packed.latticeData.length) },
    brush: { kind: 'f32', length: Math.max(1, packed.brushData.length) }
  })

  slots.pos.view.set(pos.subarray(0, count * 3))
  slots.uvs.view.set(uvs.subarray(0, count * 2))
  if (packed.curveData.length) slots.curve.view.set(packed.curveData)
  if (packed.latticeData.length) slots.lattice.view.set(packed.latticeData)
  if (packed.brushData.length) slots.brush.view.set(packed.brushData)

  if (
    !executeModifiersInScratch(
      exports,
      slots.pos.ptr,
      slots.uvs.ptr,
      slots.curve.ptr,
      slots.lattice.ptr,
      slots.brush.ptr,
      count,
      modifiers,
      surface,
      packed
    )
  ) {
    return false
  }

  if (motion && motion.type !== 'none' && motion.amplitude !== 0) {
    const okMotion = exports.rust_apply_timeline_motion?.(
      slots.pos.ptr,
      slots.uvs.ptr,
      count,
      MOTION_TYPE_MAP[motion.type] ?? 0,
      MOTION_DIR_MAP[motion.direction] ?? 3,
      motion.speed,
      motion.amplitude,
      time
    )
    if (!okMotion) return false
  }

  if (unitSpace) {
    const invW = 1.0 / Math.max(1, surface.width)
    const invH = 1.0 / Math.max(1, surface.height)
    if (!exports.rust_scale_unit_space(slots.pos.ptr, slots.pos.ptr, count, invW, invH)) {
      return false
    }
  }

  pos.set(resolveSlotView(exports, slots.pos, 'f32', count * 3).subarray(0, count * 3))
  return true
}
