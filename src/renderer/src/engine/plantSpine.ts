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
export function evaluatePlantSpine(spine: PlantSpine, time: number): SpineFrame {
  const rest = resamplePolyline(spine.points)
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

/** Dời một điểm (toạ độ composite) theo xương đã uốn; trả về độ dời (dx, dy). */
function displacePoint(frame: SpineFrame, spine: PlantSpine, x: number, y: number): PlantSpinePoint {
  const { rest, bent, rot } = frame
  if (rest.length < 2) return { x: 0, y: 0 }
  const { seg, t, dist } = projectOnRest(rest, x, y)
  if (t < 0 && seg === 0) return { x: 0, y: 0 } // dưới gốc: đứng yên (rễ, đất)
  const a = rest[seg]
  const b = rest[seg + 1]
  const tc = Math.min(1, Math.max(0, t))
  const restX = a.x + (b.x - a.x) * t
  const restY = a.y + (b.y - a.y) * t
  const angle = rot[seg] + (rot[seg + 1] - rot[seg]) * tc
  const ba = bent[seg]
  const bb = bent[seg + 1]
  let baseX = ba.x + (bb.x - ba.x) * tc
  let baseY = ba.y + (bb.y - ba.y) * tc
  if (t > 1) {
    // Vượt quá ngọn (tán lá phía trên): kéo dài theo hướng ngọn đã xoay
    const ext = rotate((b.x - a.x) * (t - 1), (b.y - a.y) * (t - 1), angle)
    baseX += ext.x
    baseY += ext.y
  }
  const off = rotate(x - restX, y - restY, angle)
  let dx = baseX + off.x - x
  let dy = baseY + off.y - y
  const reach = spine.reach ?? 0
  if (reach > 0) {
    const k = Math.min(1, Math.max(0, (reach - dist) / (reach * 0.5)))
    const w = k * k * (3 - 2 * k)
    dx *= w
    dy *= w
  }
  return { x: dx, y: dy }
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
  const frames = spines.map((s) => evaluatePlantSpine(s, time))
  const scale = binding.scale ?? 1
  const sx = scale * (binding.scaleX ?? 1)
  const sy = scale * (binding.scaleY ?? 1)
  if (Math.abs(sx * sy) < 1e-10) return output
  const rot = binding.rotation ?? 0
  const bx = binding.x ?? 0
  const by = binding.y ?? 0
  for (let i = 0; i < positions.length; i += 3) {
    const p = rotate(positions[i] * sx, -positions[i + 1] * sy, rot)
    const wx = p.x + bx
    const wy = p.y + by
    let dx = 0
    let dy = 0
    for (let k = 0; k < spines.length; k++) {
      const d = displacePoint(frames[k], spines[k], wx, wy)
      dx += d.x
      dy += d.y
    }
    if (dx === 0 && dy === 0) continue
    const local = rotate(wx + dx - bx, wy + dy - by, -rot)
    output[i] = local.x / sx
    output[i + 1] = -local.y / sy
  }
  return output
}
