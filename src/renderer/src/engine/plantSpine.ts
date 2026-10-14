import type { PlantSpine, PlantSpinePoint } from '@shared/plantSpine'
import type { SkinBinding } from './layerSkinning'

/** Số mẫu chia đều theo chiều dài xương — đủ mượt cho uốn cong mà vẫn rẻ mỗi khung hình. */
const SAMPLES = 32

interface SpineFrame {
  /** Điểm nghỉ đã chia đều theo chiều dài. */
  rest: PlantSpinePoint[]
  /** Điểm sau khi uốn tại thời điểm t. */
  bent: PlantSpinePoint[]
  /** Góc xoay tích luỹ (độ) tại từng mẫu. */
  rot: number[]
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

/**
 * Góc uốn (độ) tại vị trí u ∈ [0,1] dọc theo xương (0 = gốc, 1 = ngọn) ở thời điểm t.
 * Bằng 0 tại t = 0 (khi chưa có lệch pha / độ nghiêng) để bố cục lúc chỉnh sửa luôn ở tư thế nghỉ.
 */
export function plantBendAngle(spine: PlantSpine, u: number, time: number): number {
  const stiffness = Math.min(1, Math.max(0, spine.stiffness))
  const envelope = Math.pow(Math.min(1, Math.max(0, u)), 1 + stiffness * 3)
  const t = time + (spine.phaseOffset ?? 0)
  const w = Math.PI * 2 * Math.max(0, spine.speed)
  const turbulence = Math.min(1, Math.max(0, spine.turbulence))
  const main = Math.sin(w * t)
  const flutter = Math.min(1, Math.max(0, spine.flexibility)) * 0.5 * u * Math.sin(2 * w * t)
  const gust = turbulence * 0.9 * Math.sin(w * 0.43 * t) * Math.sin(w * 1.7 * t + u * 1.3)
  const wave = main * (1 - turbulence * 0.35) + flutter + gust
  return envelope * (spine.amplitude * wave + (spine.lean ?? 0))
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

export function evaluatePlantSpine(spine: PlantSpine, time: number): SpineFrame {
  const rest = restSamples(spine)
  const n = rest.length
  const rot: number[] = new Array(n)
  const bent: PlantSpinePoint[] = new Array(n)
  let length = 0
  for (let i = 1; i < n; i++) length += Math.hypot(rest[i].x - rest[i - 1].x, rest[i].y - rest[i - 1].y)
  for (let i = 0; i < n; i++) rot[i] = n > 1 ? plantBendAngle(spine, i / (n - 1), time) : 0
  bent[0] = { ...rest[0] }
  for (let i = 1; i < n; i++) {
    const avg = (rot[i - 1] + rot[i]) / 2
    const d = rotate(rest[i].x - rest[i - 1].x, rest[i].y - rest[i - 1].y, avg)
    bent[i] = { x: bent[i - 1].x + d.x, y: bent[i - 1].y + d.y }
  }
  return { rest, bent, rot, length }
}

interface Projection {
  /** Chỉ số đoạn gần nhất. */
  seg: number
  /** Tham số trên đoạn (có thể < 0 ở gốc hoặc > 1 ở ngọn để ngoại suy). */
  t: number
  /** Khoảng cách tới xương nghỉ. */
  dist: number
}

function projectOnRest(rest: PlantSpinePoint[], x: number, y: number): Projection {
  let best: Projection = { seg: 0, t: 0, dist: Infinity }
  const last = rest.length - 2
  for (let i = 0; i <= last; i++) {
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

/** Mỗi đỉnh 5 số: [đoạn (-1 = dưới gốc, đứng yên), t, lệchX, lệchY, trọng số bán kính]. */
const STRIDE = 5
interface LayerProjection { key: string; world: Float32Array; perSpine: Float32Array[] }
const projectionCache = new WeakMap<Float32Array, LayerProjection>()

function projectionKey(binding: SkinBinding, spines: PlantSpine[]): string {
  const b = `${binding.x},${binding.y},${binding.rotation},${binding.scale},${binding.scaleX ?? 1},${binding.scaleY ?? 1}`
  return b + '|' + spines.map((s) => `${s.reach ?? 0}:${s.points.map((p) => `${p.x},${p.y}`).join(';')}`).join('|')
}

function buildProjection(positions: Float32Array, binding: SkinBinding, spines: PlantSpine[], key: string): LayerProjection {
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
  const perSpine = spines.map((spine) => {
    const rest = restSamples(spine)
    const data = new Float32Array(count * STRIDE)
    const reach = spine.reach ?? 0
    for (let i = 0; i < count; i++) {
      const x = world[i * 2]
      const y = world[i * 2 + 1]
      const o = i * STRIDE
      const { seg, t, dist } = projectOnRest(rest, x, y)
      if (rest.length < 2 || (t < 0 && seg === 0)) {
        data[o] = -1
        continue
      }
      const a = rest[seg]
      const b = rest[seg + 1]
      let w = 1
      if (reach > 0) {
        const k = Math.min(1, Math.max(0, (reach - dist) / (reach * 0.5)))
        w = k * k * (3 - 2 * k)
      }
      data[o] = seg
      data[o + 1] = t
      data[o + 2] = x - (a.x + (b.x - a.x) * t)
      data[o + 3] = y - (a.y + (b.y - a.y) * t)
      data[o + 4] = w
    }
    return data
  })
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
  time: number
): Float32Array {
  if (!spines.length) return positions
  const output = positions.slice()
  const scale = binding.scale ?? 1
  const sx = scale * (binding.scaleX ?? 1)
  const sy = scale * (binding.scaleY ?? 1)
  if (Math.abs(sx * sy) < 1e-10) return output
  const key = projectionKey(binding, spines)
  let proj = projectionCache.get(positions)
  if (!proj || proj.key !== key) {
    proj = buildProjection(positions, binding, spines, key)
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
      const { rest, bent, rot: angles } = frames[k]
      const seg = data[o]
      const t = data[o + 1]
      const tc = t < 0 ? 0 : t > 1 ? 1 : t
      const a = rest[seg]
      const b = rest[seg + 1]
      const angle = angles[seg] + (angles[seg + 1] - angles[seg]) * tc
      let baseX = bent[seg].x + (bent[seg + 1].x - bent[seg].x) * tc
      let baseY = bent[seg].y + (bent[seg + 1].y - bent[seg].y) * tc
      if (t > 1) {
        // Vượt quá ngọn (tán lá phía trên): kéo dài theo hướng ngọn đã xoay
        const ext = rotate((b.x - a.x) * (t - 1), (b.y - a.y) * (t - 1), angle)
        baseX += ext.x
        baseY += ext.y
      }
      const off = rotate(data[o + 2], data[o + 3], angle)
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
