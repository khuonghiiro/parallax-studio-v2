import type { PlantSpine, PlantSpinePoint } from '@shared/plantSpine'
import type { SkinBinding } from './layerSkinning'
import { samplePlantMotion, samplePlantMotionStretch } from './plantMotion'
import { computeMeshCorridor } from './meshCorridor'

/** Số mẫu chia đều theo chiều dài xương — đủ mượt cho uốn cong mà vẫn rẻ mỗi khung hình. */
const SAMPLES = 32

interface SpineFrame {
  /** Điểm nghỉ đã chia đều theo chiều dài. */
  rest: PlantSpinePoint[]
  /** Điểm sau khi uốn tại thời điểm t. */
  bent: PlantSpinePoint[]
  /** Góc xoay tích luỹ (độ) tại từng mẫu. */
  rot: number[]
  /** Hệ số co giãn dọc thân (-0.5..1) tại từng mẫu. */
  stretch?: number[]
  length: number
}

function rotate(x: number, y: number, deg: number): PlantSpinePoint {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: x * c - y * s, y: x * s + y * c }
}

/** Chia lại đường vẽ tay thành SAMPLES+1 điểm cách đều nhau. */
export function resamplePolyline(points: PlantSpinePoint[], count = SAMPLES): PlantSpinePoint[] {
  if (points.length < 2) return points.map((p) => ({ ...p }))
  const cum = [0]
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }
  const total = cum[cum.length - 1]
  if (total < 1e-6) return [{ ...points[0] }, { ...points[points.length - 1] }]
  const out: PlantSpinePoint[] = []
  let j = 1
  for (let k = 0; k <= count; k++) {
    const s = (total * k) / count
    while (j < points.length - 1 && cum[j] < s) j++
    const seg = cum[j] - cum[j - 1] || 1
    const t = Math.min(1, Math.max(0, (s - cum[j - 1]) / seg))
    out.push({
      x: points[j - 1].x + (points[j].x - points[j - 1].x) * t,
      y: points[j - 1].y + (points[j].y - points[j - 1].y) * t
    })
  }
  return out
}

/** Hệ số phân bố độ uốn dọc thân (0 ở gốc → 1 ở ngọn); thân càng cứng thì chỉ phần ngọn cong. */
export function plantEnvelope(stiffness: number, u: number): number {
  const s = Math.min(1, Math.max(0, stiffness))
  return Math.pow(Math.min(1, Math.max(0, u)), 0.65 + s * 1.15)
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
    const mix = Math.min(1, Math.max(0, motion.windMix ?? 0))
    const wind = mix > 0 ? mix * spine.amplitude * windWave(spine, u, t) : 0
    return envelope * (samplePlantMotion(motion, local) + wind)
  }
  return envelope * (spine.amplitude * windWave(spine, u, t) + (spine.lean ?? 0))
}

/**
 * Hệ số co giãn dọc thân (-0.5..1) tại vị trí u ∈ [0,1] ở thời điểm t.
 * 0 = chiều dài tự nhiên, > 0 = dãn dài lên, < 0 = co nhún xuống.
 */
export function plantStretchFactor(spine: PlantSpine, u: number, time: number, bendAngle = 0): number {
  const envelope = plantEnvelope(spine.stiffness, u)
  const t = time + (spine.phaseOffset ?? 0)
  const motion = spine.motion
  if (motion && motion.keys.length) {
    const local = t * (motion.speed ?? 1) - (motion.lag ?? 0) * u
    const mix = Math.min(1, Math.max(0, motion.windMix ?? 0))
    const sample = samplePlantMotionStretch(motion, local)
    const wind = mix > 0 ? mix * windStretch(spine, u, t, bendAngle) : 0
    return envelope * (sample + wind)
  }
  return envelope * windStretch(spine, u, t, bendAngle)
}

/** Sóng nhún lên xuống tự nhiên theo gió: 2nd harmonic của nhịp lắc + nhịp thở dọc. */
function windStretch(spine: PlantSpine, u: number, t: number, bendAngle = 0): number {
  const bob = spine.verticalBob ?? 0
  if (Math.abs(bob) <= 1e-4) return 0
  if (spine.amplitude === 0 && spine.motion === undefined) {
    // Đang nắm tay kéo trực tiếp hoặc tư thế tĩnh: dùng trực tiếp giá trị kéo
    return bob
  }
  const w = Math.PI * 2 * Math.max(0, spine.speed)
  const rad = (bendAngle * Math.PI) / 180
  const bendDip = -(1 - Math.cos(rad)) * 0.4
  const bounce = Math.sin(2 * w * t) * 0.7 + Math.sin(w * 0.5 * t) * 0.3
  return bob * (bounce + bendDip)
}

/** Sóng gió tự nhiên chuẩn hoá (≈ -1..1): nhịp chính + phất ngọn + gió giật. */
function windWave(spine: PlantSpine, u: number, t: number): number {
  const w = Math.PI * 2 * Math.max(0, spine.speed)
  const turbulence = Math.min(1, Math.max(0, spine.turbulence))
  const main = Math.sin(w * t)
  const flutter = Math.min(1, Math.max(0, spine.flexibility)) * 0.5 * u * Math.sin(2 * w * t)
  const gust = turbulence * 0.9 * Math.sin(w * 0.43 * t) * Math.sin(w * 1.7 * t + u * 1.3)
  return main * (1 - turbulence * 0.35) + flutter + gust
}

/** Tính hình dạng xương đã uốn tại thời điểm t (tích phân tiếp tuyến nghỉ đã xoay theo góc uốn). */
/** Đường xương đã chia đều được cache theo mảng điểm (không chia lại mỗi khung hình). */
const restCache = new WeakMap<PlantSpinePoint[], PlantSpinePoint[]>()
function restSamples(spine: PlantSpine): PlantSpinePoint[] {
  let rest = restCache.get(spine.points)
  if (!rest) {
    rest = resamplePolyline(spine.points)
    restCache.set(spine.points, rest)
  }
  return rest
}

/** Tích phân tiếp tuyến nghỉ đã xoay theo góc uốn từng mẫu và co dãn dọc → đường xương đã uốn. */
function integrateBend(rest: PlantSpinePoint[], rot: number[], stretch?: number[]): PlantSpinePoint[] {
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

/** Dáng uốn tĩnh khi góc uốn tại ngọn = tipAngle (độ) và co dãn dọc = tipStretch: dùng cho tay nắm kéo ngọn và bóng biên độ. */
export function plantStaticPose(spine: PlantSpine, tipAngle: number, tipStretch = 0): PlantSpinePoint[] {
  const rest = restSamples(spine)
  const n = rest.length
  const rot = rest.map((_, i) => (n > 1 ? plantEnvelope(spine.stiffness, i / (n - 1)) * tipAngle : 0))
  const stretch = rest.map((_, i) => (n > 1 ? plantEnvelope(spine.stiffness, i / (n - 1)) * tipStretch : 0))
  return integrateBend(rest, rot, stretch)
}

const normDeg = (deg: number) => ((deg + 180) % 360 + 360) % 360 - 180
const angleOf = (from: PlantSpinePoint, to: PlantSpinePoint) => (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI

/** Tỉ lệ góc quay của dây cung gốc→ngọn so với góc uốn tại ngọn (gần tuyến tính với góc nhỏ). */
export function plantChordGain(spine: PlantSpine): number {
  const rest = restSamples(spine)
  if (rest.length < 2) return 1
  const probe = 10
  const bent = plantStaticPose(spine, probe)
  const root = rest[0]
  const delta = normDeg(angleOf(root, bent[bent.length - 1]) - angleOf(root, rest[rest.length - 1]))
  return Math.abs(delta) > 1e-3 ? delta / probe : 1
}

/** Góc uốn tại ngọn (độ) để dây cung gốc→ngọn hướng về điểm target (khi người dùng nắm ngọn kéo). */
export function plantTipAngleToward(spine: PlantSpine, target: PlantSpinePoint): number {
  const rest = restSamples(spine)
  if (rest.length < 2) return 0
  const root = rest[0]
  const delta = normDeg(angleOf(root, target) - angleOf(root, rest[rest.length - 1]))
  return delta / plantChordGain(spine)
}

/** Tính cả góc uốn ngọn (độ) và tỷ lệ co dãn dọc thân (lên xuống) khi kéo ngọn tới target. */
export function plantTipTransformToward(spine: PlantSpine, target: PlantSpinePoint): { angle: number; stretch: number } {
  const rest = restSamples(spine)
  if (rest.length < 2) return { angle: 0, stretch: 0 }
  const root = rest[0]
  const restTip = rest[rest.length - 1]
  const restChord = Math.hypot(restTip.x - root.x, restTip.y - root.y) || 1
  const targetDist = Math.hypot(target.x - root.x, target.y - root.y)
  const angle = plantTipAngleToward(spine, target)
  const rawStretch = (targetDist - restChord) / restChord
  const stretch = Math.max(-0.45, Math.min(0.65, rawStretch))
  return { angle, stretch }
}


interface Projection {
  /** Chỉ số đoạn gần nhất. */
  seg: number
  /** Tham số trên đoạn (có thể < 0 ở gốc hoặc > 1 ở ngọn để ngoại suy). */
  t: number
  /** Khoảng cách tới xương nghỉ. */
  dist: number
}

function projectOnRest(rest: PlantSpinePoint[], x: number, y: number, loSeg = 0, hiSeg = rest.length - 2): Projection {
  let best: Projection = { seg: 0, t: 0, dist: Infinity }
  const last = rest.length - 2
  const from = Math.max(0, Math.min(last, loSeg))
  const to = Math.max(from, Math.min(last, hiSeg))
  for (let i = from; i <= to; i++) {
    const a = rest[i]
    const b = rest[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    let t = ((x - a.x) * dx + (y - a.y) * dy) / len2
    const lo = i === 0 ? -Infinity : 0
    const hi = i === last ? Infinity : 1
    t = Math.min(hi, Math.max(lo, t))
    const cx = a.x + dx * Math.min(1, Math.max(0, t))
    const cy = a.y + dy * Math.min(1, Math.max(0, t))
    const dist = Math.hypot(x - cx, y - cy)
    if (dist < best.dist) best = { seg: i, t, dist }
  }
  return best
}

/** Mỗi đỉnh 5 số: [đoạn (-1 = dưới gốc/ngoài vùng, đứng yên), t, lệchX, lệchY, trọng số bán kính]. */
const STRIDE = 5
interface LayerProjection { key: string; world: Float32Array; perSpine: Float32Array[] }
const projectionCache = new WeakMap<Float32Array, LayerProjection>()

function projectionKey(binding: SkinBinding, spines: PlantSpine[], indices?: ArrayLike<number>): string {
  const b = `v5:${binding.x},${binding.y},${binding.rotation},${binding.scale},${binding.scaleX ?? 1},${binding.scaleY ?? 1}:${indices?.length ?? 0}`
  return b + '|' + spines.map((s) => `${s.reach ?? 0}:${s.points.map((p) => `${p.x},${p.y}`).join(';')}`).join('|')
}

function buildSpineProjectionData(
  world: Float32Array,
  spine: PlantSpine,
  indices?: ArrayLike<number>
): Float32Array {
  const count = world.length >> 1
  const rest = restSamples(spine)
  const data = new Float32Array(count * STRIDE)
  const reach = spine.reach ?? 0
  const useCorridor = Boolean(indices && indices.length >= 3 && count > 3)
  const corridor = useCorridor ? computeMeshCorridor(world, indices!, rest, reach) : null

  for (let i = 0; i < count; i++) {
    const o = i * STRIDE
    if (rest.length < 2) {
      data[o] = -1
      continue
    }
    if (useCorridor) {
      // Nếu có hành lang mesh (hoặc người dùng đặt reach > 0), đỉnh ngoài hành lang sẽ đứng yên 100%
      if (corridor) {
        if (corridor.weights[i] <= 1e-4) {
          data[o] = -1
          continue
        }
      } else if (reach > 0) {
        data[o] = -1
        continue
      }
    }
    const x = world[i * 2]
    const y = world[i * 2 + 1]
    const pad = corridor && corridor.geoDist[i] <= corridor.avgCoreEdge * 2 ? 2 : 0
    const { seg, t: rawT, dist } = corridor
      ? projectOnRest(rest, x, y, corridor.segMin[i] - pad, corridor.segMax[i] + pad)
      : projectOnRest(rest, x, y)
    if (!corridor && rawT < 0 && seg === 0) {
      data[o] = -1
      continue
    }
    const t = corridor ? Math.max(0, Math.min(1, rawT)) : rawT
    let w = corridor ? corridor.weights[i] : 1
    if (!corridor && reach > 0) {
      const k = Math.min(1, Math.max(0, (reach - dist) / (reach * 0.5)))
      w = k * k * (3 - 2 * k)
    }
    if (w <= 1e-4) {
      data[o] = -1
      continue
    }
    const a = rest[seg]
    const b = rest[seg + 1]
    data[o] = seg
    data[o + 1] = t
    data[o + 2] = x - (a.x + (b.x - a.x) * t)
    data[o + 3] = y - (a.y + (b.y - a.y) * t)
    data[o + 4] = w
  }
  return data
}

function buildProjection(
  positions: Float32Array,
  binding: SkinBinding,
  spines: PlantSpine[],
  key: string,
  indices?: ArrayLike<number>
): LayerProjection {
  const count = positions.length / 3
  const scale = binding.scale ?? 1
  const sx = scale * (binding.scaleX ?? 1)
  const sy = scale * (binding.scaleY ?? 1)
  const rot = binding.rotation ?? 0
  const world = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    const p = rotate(positions[i * 3] * sx, -positions[i * 3 + 1] * sy, rot)
    world[i * 2] = p.x + (binding.x ?? 0)
    world[i * 2 + 1] = p.y + (binding.y ?? 0)
  }
  const perSpine = spines.map((spine) => buildSpineProjectionData(world, spine, indices))
  if (perSpine.length > 1) {
    for (let i = 0; i < count; i++) {
      const o = i * STRIDE
      let sumW = 0
      let activeCount = 0
      for (let k = 0; k < perSpine.length; k++) {
        if (perSpine[k][o] >= 0 && perSpine[k][o + 4] > 0) {
          sumW += perSpine[k][o + 4]
          activeCount++
        }
      }
      if (activeCount > 1 && sumW > 1) {
        const env = Math.min(1, sumW)
        let rawSum = 0
        const raws = new Float32Array(perSpine.length)
        for (let k = 0; k < perSpine.length; k++) {
          const d = perSpine[k]
          if (d[o] >= 0 && d[o + 4] > 0) {
            const dist2 = d[o + 2] * d[o + 2] + d[o + 3] * d[o + 3]
            const aff = 1 / (144 + dist2) ** 2
            raws[k] = d[o + 4] * aff
            rawSum += raws[k]
          }
        }
        if (rawSum > 0) {
          for (let k = 0; k < perSpine.length; k++) {
            if (perSpine[k][o] >= 0) perSpine[k][o + 4] = (raws[k] / rawSum) * env
          }
        }
      }
    }
  }
  return { key, world, perSpine }
}

/** Chỉ lấy các xương đang bật và có gắn layer này. */
export function spinesForLayer(spines: PlantSpine[] | undefined, layerId: string): PlantSpine[] {
  return (spines ?? []).filter((s) => s.enabled !== false && s.points.length >= 2 && s.layerIds.includes(layerId))
}

/**
 * Uốn lưới đỉnh của một layer theo các xương thực vật.
 * positions: toạ độ cục bộ Y-up (giống mesh 3D / canvas skin); binding: vị trí layer trong composite.
 */
export function deformPlantSpines(
  positions: Float32Array,
  binding: SkinBinding,
  spines: PlantSpine[],
  time: number,
  indices?: ArrayLike<number>
): Float32Array {
  if (!spines.length) return positions
  const output = positions.slice()
  const scale = binding.scale ?? 1
  const sx = scale * (binding.scaleX ?? 1)
  const sy = scale * (binding.scaleY ?? 1)
  if (Math.abs(sx * sy) < 1e-10) return output
  const key = projectionKey(binding, spines, indices)
  let proj = projectionCache.get(positions)
  if (!proj || proj.key !== key) {
    proj = buildProjection(positions, binding, spines, key, indices)
    projectionCache.set(positions, proj)
  }
  const frames = spines.map((s) => evaluatePlantSpine(s, time))
  const count = positions.length / 3
  const rot = binding.rotation ?? 0
  const bx = binding.x ?? 0
  const by = binding.y ?? 0
  for (let i = 0; i < count; i++) {
    const wx = proj.world[i * 2]
    const wy = proj.world[i * 2 + 1]
    let dx = 0
    let dy = 0
    for (let k = 0; k < spines.length; k++) {
      const data = proj.perSpine[k]
      const o = i * STRIDE
      if (data[o] < 0) continue
      const { rest, bent, rot: angles, stretch: stretches } = frames[k]
      const seg = data[o]
      const t = data[o + 1]
      const tc = t < 0 ? 0 : t > 1 ? 1 : t
      const a = rest[seg]
      const b = rest[seg + 1]
      const angle = angles[seg] + (angles[seg + 1] - angles[seg]) * tc
      let baseX = bent[seg].x + (bent[seg + 1].x - bent[seg].x) * tc
      let baseY = bent[seg].y + (bent[seg + 1].y - bent[seg].y) * tc
      if (t > 1) {
        // Vượt quá ngọn (tán lá phía trên): kéo dài theo hướng ngọn đã xoay và dãn theo stretch ngọn
        const tipStretch = stretches ? stretches[stretches.length - 1] : 0
        const tipScale = Math.max(0.1, 1 + tipStretch)
        const ext = rotate((b.x - a.x) * (t - 1) * tipScale, (b.y - a.y) * (t - 1) * tipScale, angle)
        baseX += ext.x
        baseY += ext.y
      }
      // Giữ thể tích squash & stretch: dãn dài thì hơi thắt bề ngang, nén lùn thì hơi phình ngang
      const segStretch = stretches ? (stretches[seg] + stretches[Math.min(stretches.length - 1, seg + 1)]) / 2 : 0
      const lateralScale = Math.max(0.4, Math.min(1.8, 1 - segStretch * 0.35))
      const off = rotate(data[o + 2] * lateralScale, data[o + 3] * lateralScale, angle)
      const w = data[o + 4]
      dx += (baseX + off.x - wx) * w
      dy += (baseY + off.y - wy) * w
    }
    if (dx === 0 && dy === 0) continue
    const local = rotate(wx + dx - bx, wy + dy - by, -rot)
    output[i * 3] = local.x / sx
    output[i * 3 + 1] = -local.y / sy
  }
  return output
}
