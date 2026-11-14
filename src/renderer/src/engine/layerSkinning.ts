import type { LayerRig } from '@shared/layerRig'
import { evaluateRig, rotatePoint, type BoneTransform } from './layerRig'
import { cachedSkinWeights, skinWeights } from './layerSkinningWeights'
import { wasmDeformSkin } from './wasm/wasmDeformBridge'
import { isWasmAccelReady } from './wasm/wasmRuntime'

export interface SkinBinding {
  boneId?: string
  /** Các xương phụ cùng gắn uốn mềm trên một layer (nhiều nhánh cây / nhiều đường kẻ độc lập). */
  extraBoneIds?: string[]
  /** Khi true (nhân vật nhiều layer Cutout 2.5D): chỉ uốn theo đúng các xương trong [boneId, ...extraBoneIds], không lấy xương cha của layer khác làm chốt ghim. */
  isolateToBoundBones?: boolean
  isCloth?: boolean
  clothAmplitude?: number
  x: number
  y: number
  rotation: number
  scale: number
  scaleX?: number
  scaleY?: number
  bindPose?: { x: number; y: number; rotation: number }
}
export interface SkinInfluence { id: string; weight: number }

export { skinWeights }

/** Lấy nhánh xương được gắn cho layer (hỗ trợ cả xương chính lẫn danh sách xương phụ độc lập trên cùng layer). */
export function skinBones(
  rig: LayerRig,
  root?: string,
  extraRoots?: string[],
  isolateToBoundBones = false
) {
  if (!root && (!extraRoots || !extraRoots.length)) return rig.bones
  const seeds = [root, ...(extraRoots ?? [])].filter((id): id is string => Boolean(id))
  const ids = new Set(seeds)
  if (isolateToBoundBones) {
    return rig.bones.filter((b) => ids.has(b.id))
  }
  for (let i = 0; i < rig.bones.length; i++) {
    for (const b of rig.bones) if (b.parentId && ids.has(b.parentId)) ids.add(b.id)
  }
  for (const seed of seeds) {
    const current = rig.bones.find((b) => b.id === seed)
    if (current?.parentId) ids.add(current.parentId)
  }
  return rig.bones.filter((b) => ids.has(b.id))
}

function areAllBonesAtRest(
  bones: LayerRig['bones'],
  binding: SkinBinding,
  transforms: Map<string, BoneTransform>
): boolean {
  const restRot = binding.bindPose?.rotation ?? binding.rotation ?? 0
  const restBx = binding.bindPose?.x ?? binding.x ?? 0
  const restBy = binding.bindPose?.y ?? binding.y ?? 0
  const curRot = binding.rotation ?? restRot
  const curBx = binding.x ?? restBx
  const curBy = binding.y ?? restBy
  if (
    Math.abs(curRot - restRot) >= 1e-4 ||
    Math.abs(curBx - restBx) >= 1e-4 ||
    Math.abs(curBy - restBy) >= 1e-4
  ) {
    return false
  }
  for (let i = 0; i < bones.length; i++) {
    const b = bones[i]
    const tf = transforms.get(b.id)
    if (!tf) continue
    if (
      Math.abs(tf.x - b.x) > 1e-4 ||
      Math.abs(tf.y - b.y) > 1e-4 ||
      Math.abs(tf.rotation) > 1e-4 ||
      Math.abs((tf.scaleX ?? 1) - 1) > 1e-4 ||
      Math.abs((tf.scaleY ?? 1) - 1) > 1e-4
    ) {
      return false
    }
  }
  return true
}

function buildJsSkinMeta(
  binding: SkinBinding,
  boneById: Map<string, LayerRig['bones'][number]>,
  transforms: Map<string, BoneTransform>
) {
  const scale = binding.scale ?? 1
  const sx = scale * (binding.scaleX ?? 1)
  const sy = scale * (binding.scaleY ?? 1)
  const restRot = binding.bindPose?.rotation ?? binding.rotation ?? 0
  const restBx = binding.bindPose?.x ?? binding.x ?? 0
  const restBy = binding.bindPose?.y ?? binding.y ?? 0
  const curRot = binding.rotation ?? restRot
  const curBx = binding.x ?? restBx
  const curBy = binding.y ?? restBy
  const primaryBone = binding.boneId ? boneById.get(binding.boneId) : undefined
  const primaryTf = binding.boneId ? transforms.get(binding.boneId) : undefined
  const clothFactor =
    binding.isCloth && primaryBone && primaryTf
      ? Math.max(0.05, Math.min(1, (binding.clothAmplitude ?? 45) / 100))
      : 1
  return {
    sx,
    sy,
    restBx,
    restBy,
    restCos: Math.cos((restRot * Math.PI) / 180),
    restSin: Math.sin((restRot * Math.PI) / 180),
    curBx,
    curBy,
    invCurCos: Math.cos((-curRot * Math.PI) / 180),
    invCurSin: Math.sin((-curRot * Math.PI) / 180),
    invSx: 1 / sx,
    invSy: 1 / sy,
    primaryBone,
    primaryTf,
    clothFactor
  }
}

function applySagittaCompensationJs(
  x: number,
  y: number,
  wx: number,
  wy: number,
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  influences: SkinInfluence[],
  boneById: Map<string, LayerRig['bones'][number]>,
  transforms: Map<string, BoneTransform>
): [number, number] {
  const tf0 = transforms.get(influences[0].id)
  const tf1 = transforms.get(influences[1].id)
  const b1 = boneById.get(influences[1].id)
  if (!tf0 || !tf1 || !b1) return [x, y]
  let dRot = (tf1.rotation - tf0.rotation) % 360
  if (dRot > 180) dRot -= 360
  if (dRot < -180) dRot += 360
  const absDRot = Math.abs(dRot)
  if (absDRot <= 0.5 || absDRot >= 179) return [x, y]
  const ddx = p1x - p0x
  const ddy = p1y - p0y
  const dist = Math.hypot(ddx, ddy)
  if (dist <= 0.5) return [x, y]
  const restRadius = Math.hypot(wx - b1.x, wy - b1.y)
  const curRadius = Math.hypot(x - tf1.x, y - tf1.y)
  if (curRadius >= restRadius || restRadius <= 1.0) return [x, y]
  const h = Math.min(restRadius - curRadius, 0.5 * dist * Math.tan((absDRot * Math.PI) / 720))
  const sign = dRot > 0 ? 1 : -1
  const w0 = influences[0].weight
  const w1 = influences[1].weight
  const blend = (4 * w0 * w1) / (w0 + w1)
  return [x + blend * h * ((sign * ddy) / dist), y + blend * h * ((-sign * ddx) / dist)]
}

function deformVerticesWithWeightsJs(
  positions: Float32Array,
  output: Float32Array,
  binding: SkinBinding,
  bones: LayerRig['bones'],
  transforms: Map<string, BoneTransform>,
  weights: SkinInfluence[][]
): Float32Array {
  const boneById = new Map(bones.map((b) => [b.id, b]))
  const m = buildJsSkinMeta(binding, boneById, transforms)

  for (let i = 0; i < positions.length; i += 3) {
    const influences = weights[i / 3]
    if (!influences || !influences.length) continue
    const px = positions[i] * m.sx
    const py = -positions[i + 1] * m.sy
    const wx = px * m.restCos - py * m.restSin + m.restBx
    const wy = px * m.restSin + py * m.restCos + m.restBy
    let primaryPtX = wx
    let primaryPtY = wy
    if (m.clothFactor < 0.999 && m.primaryBone && m.primaryTf) {
      const pDelta = rotatePoint(
        (wx - m.primaryBone.x) * (m.primaryTf.scaleX ?? 1),
        (wy - m.primaryBone.y) * (m.primaryTf.scaleY ?? 1),
        m.primaryTf.rotation
      )
      primaryPtX = m.primaryTf.x + pDelta.x
      primaryPtY = m.primaryTf.y + pDelta.y
    }
    let x = 0, y = 0, totalW = 0, p0x = 0, p0y = 0, p1x = 0, p1y = 0
    let hasP0 = false, hasP1 = false
    for (let j = 0; j < influences.length; j++) {
      const inf = influences[j]
      const tf = transforms.get(inf.id)
      const bone = boneById.get(inf.id)
      if (!tf || !bone) continue
      const delta = rotatePoint(
        (wx - bone.x) * (tf.scaleX ?? 1),
        (wy - bone.y) * (tf.scaleY ?? 1),
        tf.rotation
      )
      let ptX = tf.x + delta.x
      let ptY = tf.y + delta.y
      if (m.clothFactor < 0.999 && inf.id !== binding.boneId) {
        ptX = primaryPtX + (ptX - primaryPtX) * m.clothFactor
        ptY = primaryPtY + (ptY - primaryPtY) * m.clothFactor
      }
      x += ptX * inf.weight
      y += ptY * inf.weight
      totalW += inf.weight
      if (j === 0) { p0x = ptX; p0y = ptY; hasP0 = true }
      else if (j === 1) { p1x = ptX; p1y = ptY; hasP1 = true }
    }
    if (totalW <= 1e-6) continue
    if (totalW < 0.9999) {
      x += wx * (1 - totalW)
      y += wy * (1 - totalW)
    } else {
      if (totalW < 1) { x += wx * (1 - totalW); y += wy * (1 - totalW) }
      if (hasP0 && hasP1 && influences[1].weight > 1e-4) {
        ;[x, y] = applySagittaCompensationJs(
          x, y, wx, wy, p0x, p0y, p1x, p1y, influences, boneById, transforms
        )
      }
    }
    const dx = x - m.curBx
    const dy = y - m.curBy
    output[i] = (dx * m.invCurCos - dy * m.invCurSin) * m.invSx
    output[i + 1] = -(dx * m.invCurSin + dy * m.invCurCos) * m.invSy
  }
  return output
}

type PreparedSkinRun =
  | { kind: 'done'; output: Float32Array }
  | {
      kind: 'run'
      bones: LayerRig['bones']
      transforms: Map<string, BoneTransform>
      output: Float32Array
    }

function prepareSkinRun(
  positions: Float32Array,
  binding: SkinBinding,
  rig: LayerRig,
  time: number,
  out?: Float32Array
): PreparedSkinRun {
  const bones = skinBones(rig, binding.boneId, binding.extraBoneIds, binding.isolateToBoundBones)
  if (!bones.length) {
    if (out && out !== positions) {
      out.set(positions)
      return { kind: 'done', output: out }
    }
    return { kind: 'done', output: positions }
  }
  const output = out && out.length === positions.length ? out : positions.slice()
  if (output !== positions) output.set(positions)
  const transforms = evaluateRig(rig, time)
  const scale = binding.scale ?? 1
  const sx = scale * (binding.scaleX ?? 1)
  const sy = scale * (binding.scaleY ?? 1)
  if (Math.abs(sx * sy) < 1e-10 || areAllBonesAtRest(bones, binding, transforms)) {
    return { kind: 'done', output }
  }
  return { kind: 'run', bones, transforms, output }
}

/** Bản TypeScript thuần của `deformSkin` phục vụ fallback và kiểm thử đối chiếu parity. */
export function deformSkinJs(
  positions: Float32Array,
  binding: SkinBinding,
  rig: LayerRig,
  time: number,
  indices?: ArrayLike<number>,
  out?: Float32Array
): Float32Array {
  const state = prepareSkinRun(positions, binding, rig, time, out)
  if (state.kind === 'done') return state.output
  const { weights } = cachedSkinWeights(positions, binding, state.bones, indices, true)
  return deformVerticesWithWeightsJs(
    positions,
    state.output,
    binding,
    state.bones,
    state.transforms,
    weights
  )
}

/** Returns local Y-up mesh positions; bind coordinates and bone transforms are Y-down. */
export function deformSkin(
  positions: Float32Array,
  binding: SkinBinding,
  rig: LayerRig,
  time: number,
  indices?: ArrayLike<number>,
  out?: Float32Array
): Float32Array {
  const state = prepareSkinRun(positions, binding, rig, time, out)
  if (state.kind === 'done') return state.output

  const { weights, packed } = cachedSkinWeights(positions, binding, state.bones, indices, false)
  if (isWasmAccelReady()) {
    const primaryBone = binding.boneId ? state.bones.find((b) => b.id === binding.boneId) : undefined
    const primaryTf = binding.boneId ? state.transforms.get(binding.boneId) : undefined
    const clothFactor =
      binding.isCloth && primaryBone && primaryTf
        ? Math.max(0.05, Math.min(1, (binding.clothAmplitude ?? 45) / 100))
        : 1
    if (
      wasmDeformSkin(
        positions,
        state.output,
        packed,
        state.bones,
        state.transforms,
        binding,
        clothFactor
      )
    ) {
      return state.output
    }
  }
  return deformVerticesWithWeightsJs(
    positions,
    state.output,
    binding,
    state.bones,
    state.transforms,
    weights
  )
}
