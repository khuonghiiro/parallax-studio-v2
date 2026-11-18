import type { PlantSpine, PlantSpinePoint } from '@shared/plantSpine'
import type { SkinBinding } from './layerSkinning'
import { samplePlantMotion, samplePlantMotionStretch } from './plantMotion'
import {
  getOrBuildLayerProjection,
  type LayerPlantProjection,
  PLANT_PROJ_STRIDE,
  resamplePolyline,
  restSamples
} from './plantSpineProjection'
import { wasmDeformPlantSpines } from './wasm/wasmDeformBridge'
import { isWasmAccelReady } from './wasm/wasmRuntime'

export { resamplePolyline }

interface SpineFrame {
  rest: PlantSpinePoint[]
  bent: PlantSpinePoint[]
  rot: number[]
  stretch?: number[]
  length: number
}

function rotate(x: number, y: number, deg: number): PlantSpinePoint {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: x * c - y * s, y: x * s + y * c }
}

/** Hệ số phân bố độ uốn dọc thân (0 ở gốc → 1 ở ngọn); thân càng cứng thì chỉ phần ngọn cong. */
export function plantEnvelope(stiffness: number, u: number): number {
  const s = Math.min(1, Math.max(0, stiffness))
  return Math.pow(Math.min(1, Math.max(0, u)), 0.65 + s * 1.15)
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/** Khởi động mượt từ 0 tại t = 0..0.22s khi không có phaseOffset để giữ đúng tư thế nghỉ ở Frame 0. */
function windRestRamp(spine: PlantSpine, rawTime: number): number {
  if (Math.abs(spine.phaseOffset ?? 0) > 1e-4) return 1
  if (rawTime <= 0) return 0
  const r = clamp01(rawTime / 0.22)
  return r * r * (3 - 2 * r)
}

function resolveWaveLag(spine: PlantSpine): number {
  const raw = spine.waveLag ?? clamp01(spine.flexibility) * 0.72
  return Math.min(1.2, Math.max(0, raw))
}

/** Sóng nhún lên xuống tự nhiên theo gió (đồng pha trễ S-wave; tắt mặc định trên tóc/lụa/gỗ). */
function windStretch(spine: PlantSpine, u: number, t: number, bendAngle = 0, rawTime = t): number {
  const bob = spine.verticalBob ?? 0
  if (Math.abs(bob) <= 1e-4) return 0
  if (spine.amplitude === 0 && spine.motion === undefined) return bob
  const w = Math.PI * 2 * Math.max(0, spine.speed)
  const rad = (bendAngle * Math.PI) / 180
  const bendDip = -(1 - Math.cos(rad)) * 0.35
  const ramp = windRestRamp(spine, rawTime)
  const lagAmount = resolveWaveLag(spine)
  const phaseShift = lagAmount * Math.PI * 0.55 * Math.pow(clamp01(u), 0.85) * ramp
  const bounce = Math.sin(2 * w * t - phaseShift) * 0.55 + Math.sin(w * 0.5 * t - phaseShift * 0.4) * 0.25
  return bob * (bounce + bendDip)
}

/**
 * Sóng gió truyền dẫn chữ S (Traveling S-Wave) chuẩn hoá (≈ -1..1):
 * gốc dẫn nhịp -> thân giữa uốn tiếp -> ngọn vẫy trễ pha tạo đường cong chữ S mềm mại.
 */
function windWave(spine: PlantSpine, u: number, t: number, rawTime = t): number {
  const w = Math.PI * 2 * Math.max(0, spine.speed)
  const turbulence = clamp01(spine.turbulence)
  const flex = clamp01(spine.flexibility)
  const uClamped = clamp01(u)
  const ramp = windRestRamp(spine, rawTime)
  const lagAmount = resolveWaveLag(spine)
  const phaseShift = lagAmount * Math.PI * 1.15 * Math.pow(uClamped, 0.85) * ramp

  const main = Math.sin(w * t - phaseShift)
  const flutter = flex * 0.36 * uClamped * uClamped * Math.sin(2 * w * t - phaseShift * 1.65)
  const breezeEnv = 1 + turbulence * 0.34 * Math.sin(w * 0.37 * t + 0.6) * ramp
  const gust =
    turbulence *
    0.42 *
    (0.5 + 0.5 * Math.sin(w * 0.29 * t)) *
    Math.sin(w * 1.27 * t - phaseShift * 1.2) *
    ramp
  return main * (1 - turbulence * 0.2) * breezeEnv + flutter + gust
}

/**
 * Góc uốn (độ) tại vị trí u ∈ [0,1] dọc theo xương (0 = gốc, 1 = ngọn) ở thời điểm t.
 * Bằng 0 tại t = 0 (khi chưa có lệch pha / độ nghiêng) để bố cục lúc chỉnh sửa luôn ở tư thế nghỉ.
 */
export function plantBendAngle(spine: PlantSpine, u: number, time: number): number {
  const envelope = plantEnvelope(spine.stiffness, u)
  const t = time + (spine.phaseOffset ?? 0)
  const motion = spine.motion
  if (motion && motion.keys.length) {
    const local = t * (motion.speed ?? 1) - (motion.lag ?? 0) * u
    const mix = clamp01(motion.windMix ?? 0)
    const wind = mix > 0 ? mix * spine.amplitude * windWave(spine, u, t, time) : 0
    return envelope * (samplePlantMotion(motion, local) + wind)
  }
  return envelope * (spine.amplitude * windWave(spine, u, t, time) + (spine.lean ?? 0))
}

/** Hệ số co giãn dọc thân (-0.5..1) tại vị trí u ∈ [0,1] ở thời điểm t. */
export function plantStretchFactor(
  spine: PlantSpine,
  u: number,
  time: number,
  bendAngle = 0
): number {
  const envelope = plantEnvelope(spine.stiffness, u)
  const t = time + (spine.phaseOffset ?? 0)
  const motion = spine.motion
  if (motion && motion.keys.length) {
    const local = t * (motion.speed ?? 1) - (motion.lag ?? 0) * u
    const mix = clamp01(motion.windMix ?? 0)
    const sample = samplePlantMotionStretch(motion, local)
    const wind = mix > 0 ? mix * windStretch(spine, u, t, bendAngle, time) : 0
    return envelope * (sample + wind)
  }
  return envelope * windStretch(spine, u, t, bendAngle, time)
}

function integrateBend(
  rest: PlantSpinePoint[],
  rot: number[],
  stretch?: number[]
): PlantSpinePoint[] {
  const n = rest.length
  const bent: PlantSpinePoint[] = new Array(n)
  if (!n) return bent
  bent[0] = { ...rest[0] }
  for (let i = 1; i < n; i++) {
    const avgRot = (rot[i - 1] + rot[i]) / 2
    const avgStretch = stretch ? (stretch[i - 1] + stretch[i]) / 2 : 0
    const factor = Math.max(0.1, 1 + avgStretch)
    const d = rotate(rest[i].x - rest[i - 1].x, rest[i].y - rest[i - 1].y, avgRot)
    bent[i] = { x: bent[i - 1].x + d.x * factor, y: bent[i - 1].y + d.y * factor }
  }
  return bent
}

export function evaluatePlantSpine(spine: PlantSpine, time: number): SpineFrame {
  const rest = restSamples(spine)
  const n = rest.length
  const rot: number[] = new Array(n)
  const stretch: number[] = new Array(n)
  let length = 0
  for (let i = 1; i < n; i++) length += Math.hypot(rest[i].x - rest[i - 1].x, rest[i].y - rest[i - 1].y)
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) : 0
    rot[i] = plantBendAngle(spine, u, time)
    stretch[i] = plantStretchFactor(spine, u, time, rot[i])
  }
  return { rest, bent: integrateBend(rest, rot, stretch), rot, stretch, length }
}

/** Dáng uốn tĩnh khi góc uốn tại ngọn = tipAngle (độ) và co dãn dọc = tipStretch. */
export function plantStaticPose(
  spine: PlantSpine,
  tipAngle: number,
  tipStretch = 0
): PlantSpinePoint[] {
  const rest = restSamples(spine)
  const n = rest.length
  const rot = rest.map((_, i) => (n > 1 ? plantEnvelope(spine.stiffness, i / (n - 1)) * tipAngle : 0))
  const stretch = rest.map((_, i) => (n > 1 ? plantEnvelope(spine.stiffness, i / (n - 1)) * tipStretch : 0))
  return integrateBend(rest, rot, stretch)
}

const normDeg = (deg: number) => ((deg + 180) % 360 + 360) % 360 - 180
const angleOf = (from: PlantSpinePoint, to: PlantSpinePoint) =>
  (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI

export function plantChordGain(spine: PlantSpine): number {
  const rest = restSamples(spine)
  if (rest.length < 2) return 1
  const probe = 10
  const bent = plantStaticPose(spine, probe)
  const root = rest[0]
  const delta = normDeg(angleOf(root, bent[bent.length - 1]) - angleOf(root, rest[rest.length - 1]))
  return Math.abs(delta) > 1e-3 ? delta / probe : 1
}

export function plantTipAngleToward(spine: PlantSpine, target: PlantSpinePoint): number {
  const rest = restSamples(spine)
  if (rest.length < 2) return 0
  const root = rest[0]
  const delta = normDeg(angleOf(root, target) - angleOf(root, rest[rest.length - 1]))
  return delta / plantChordGain(spine)
}

export function plantTipTransformToward(
  spine: PlantSpine,
  target: PlantSpinePoint
): { angle: number; stretch: number } {
  const rest = restSamples(spine)
  if (rest.length < 2) return { angle: 0, stretch: 0 }
  const root = rest[0]
  const restTip = rest[rest.length - 1]
  const restChord = Math.hypot(restTip.x - root.x, restTip.y - root.y) || 1
  const targetDist = Math.hypot(target.x - root.x, target.y - root.y)
  const angle = plantTipAngleToward(spine, target)
  const stretch = Math.max(-0.45, Math.min(0.65, (targetDist - restChord) / restChord))
  return { angle, stretch }
}

/** Chỉ lấy các xương đang bật và có gắn layer này. */
export function spinesForLayer(spines: PlantSpine[] | undefined, layerId: string): PlantSpine[] {
  return (spines ?? []).filter(
    (s) => s.enabled !== false && s.points.length >= 2 && s.layerIds.includes(layerId)
  )
}

function deformPlantSpinesWithProjJs(
  positions: Float32Array,
  output: Float32Array,
  binding: SkinBinding,
  spines: PlantSpine[],
  proj: LayerPlantProjection,
  frames: SpineFrame[],
  useCachedWorld: boolean
): Float32Array {
  const count = positions.length / 3
  const scale = binding.scale ?? 1
  const sx = scale * (binding.scaleX ?? 1)
  const sy = scale * (binding.scaleY ?? 1)
  const rot = binding.rotation ?? 0
  const bx = binding.x ?? 0
  const by = binding.y ?? 0
  const rad = (rot * Math.PI) / 180
  const rotCos = Math.cos(rad)
  const rotSin = Math.sin(rad)
  const invCos = rotCos
  const invSin = -rotSin
  const invSx = 1 / sx
  const invSy = 1 / sy
  const DEG_TO_RAD = Math.PI / 180

  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    let wx: number
    let wy: number
    if (useCachedWorld) {
      wx = proj.world[i * 2]
      wy = proj.world[i * 2 + 1]
    } else {
      const px = positions[i3] * sx
      const py = -positions[i3 + 1] * sy
      wx = px * rotCos - py * rotSin + bx
      wy = px * rotSin + py * rotCos + by
    }
    let dx = 0
    let dy = 0
    const o = i * PLANT_PROJ_STRIDE
    for (let k = 0; k < spines.length; k++) {
      const data = proj.perSpine[k]
      const seg = data[o]
      if (seg < 0) continue
      const { rest, bent, rot: angles, stretch: stretches } = frames[k]
      const t = data[o + 1]
      const tc = t < 0 ? 0 : t > 1 ? 1 : t
      const angleRad = (angles[seg] + (angles[seg + 1] - angles[seg]) * tc) * DEG_TO_RAD
      const aCos = Math.cos(angleRad)
      const aSin = Math.sin(angleRad)
      let baseX = bent[seg].x + (bent[seg + 1].x - bent[seg].x) * tc
      let baseY = bent[seg].y + (bent[seg + 1].y - bent[seg].y) * tc
      if (t > 1) {
        const tipScale = Math.max(0.1, 1 + (stretches ? stretches[stretches.length - 1] : 0))
        const ex = (rest[seg + 1].x - rest[seg].x) * (t - 1) * tipScale
        const ey = (rest[seg + 1].y - rest[seg].y) * (t - 1) * tipScale
        baseX += ex * aCos - ey * aSin
        baseY += ex * aSin + ey * aCos
      }
      const segStretch = stretches
        ? (stretches[seg] + stretches[Math.min(stretches.length - 1, seg + 1)]) / 2
        : 0
      const lateralScale = Math.max(0.4, Math.min(1.8, 1 - segStretch * 0.35))
      const ox = data[o + 2] * lateralScale
      const oy = data[o + 3] * lateralScale
      const offX = ox * aCos - oy * aSin
      const offY = ox * aSin + oy * aCos
      const w = data[o + 4]
      dx += (baseX + offX - wx) * w
      dy += (baseY + offY - wy) * w
    }
    if (dx === 0 && dy === 0) continue
    const lx = wx + dx - bx
    const ly = wy + dy - by
    output[i3] = (lx * invCos - ly * invSin) * invSx
    output[i3 + 1] = -(lx * invSin + ly * invCos) * invSy
  }
  return output
}

function runDeformPlantSpines(
  positions: Float32Array,
  binding: SkinBinding,
  spines: PlantSpine[],
  time: number,
  indices: ArrayLike<number> | undefined,
  cacheOwner: Float32Array | undefined,
  out: Float32Array | undefined,
  forceJs: boolean
): Float32Array {
  if (!spines.length) {
    if (out && out !== positions) {
      out.set(positions)
      return out
    }
    return positions
  }
  const output = out && out.length === positions.length ? out : positions.slice()
  if (output !== positions) output.set(positions)
  const scale = binding.scale ?? 1
  const sx = scale * (binding.scaleX ?? 1)
  const sy = scale * (binding.scaleY ?? 1)
  if (Math.abs(sx * sy) < 1e-10) return output

  const owner = cacheOwner ?? positions
  const proj = getOrBuildLayerProjection(owner, binding, spines, indices, forceJs)
  const frames = spines.map((s) => evaluatePlantSpine(s, time))
  const useCachedWorld = owner === positions

  if (!forceJs && isWasmAccelReady()) {
    if (
      wasmDeformPlantSpines(
        positions,
        output,
        useCachedWorld ? proj.world : null,
        proj.packedPerSpine,
        frames,
        binding
      )
    ) {
      return output
    }
  }
  return deformPlantSpinesWithProjJs(positions, output, binding, spines, proj, frames, useCachedWorld)
}

/** Bản TypeScript thuần của `deformPlantSpines` phục vụ fallback và đối chiếu parity. */
export function deformPlantSpinesJs(
  positions: Float32Array,
  binding: SkinBinding,
  spines: PlantSpine[],
  time: number,
  indices?: ArrayLike<number>,
  cacheOwner?: Float32Array,
  out?: Float32Array
): Float32Array {
  return runDeformPlantSpines(positions, binding, spines, time, indices, cacheOwner, out, true)
}

/**
 * Uốn lưới đỉnh của một layer theo các xương motion.
 * positions: toạ độ cục bộ Y-up (giống mesh 3D / canvas skin); binding: vị trí layer trong composite.
 */
export function deformPlantSpines(
  positions: Float32Array,
  binding: SkinBinding,
  spines: PlantSpine[],
  time: number,
  indices?: ArrayLike<number>,
  cacheOwner?: Float32Array,
  out?: Float32Array
): Float32Array {
  return runDeformPlantSpines(positions, binding, spines, time, indices, cacheOwner, out, false)
}
