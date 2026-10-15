import type { PlantSpine, PlantSpinePoint } from '@shared/plantSpine'

/**
 * Thao tác trực tiếp trên Xương thực vật (tab "Thực vật"): sửa điểm, dời cả xương,
 * và "dạy" cây đung đưa bằng cách nắm ngọn kéo qua lại (học biên độ / độ nghiêng / tốc độ).
 * Toàn bộ là hàm thuần để dùng chung cho overlay 2D và unit test.
 */

export const PLANT_AMPLITUDE_MAX = 40
export const PLANT_LEAN_MAX = 30

const round = (v: number, step: number) => Math.round(v / step) * step
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const roundPoint = (p: PlantSpinePoint): PlantSpinePoint => ({ x: Math.round(p.x), y: Math.round(p.y) })

export function movePlantSpinePoint(points: PlantSpinePoint[], index: number, to: PlantSpinePoint): PlantSpinePoint[] {
  if (index < 0 || index >= points.length) return points
  return points.map((p, i) => (i === index ? roundPoint(to) : p))
}

export function translatePlantSpine(points: PlantSpinePoint[], dx: number, dy: number): PlantSpinePoint[] {
  return points.map((p) => roundPoint({ x: p.x + dx, y: p.y + dy }))
}

/** Xoá một điểm điều khiển (luôn giữ tối thiểu gốc + ngọn). */
export function removePlantSpinePoint(points: PlantSpinePoint[], index: number): PlantSpinePoint[] {
  if (points.length <= 2 || index < 0 || index >= points.length) return points
  return points.filter((_, i) => i !== index)
}

/** Chèn điểm mới vào đoạn gần nhất để uốn lại dáng xương. */
export function insertPlantSpinePoint(points: PlantSpinePoint[], at: PlantSpinePoint): PlantSpinePoint[] {
  if (points.length < 2) return points
  let best = { seg: 0, dist: Infinity }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const dx = b.x - a.x, dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const t = clamp(((at.x - a.x) * dx + (at.y - a.y) * dy) / len2, 0, 1)
    const dist = Math.hypot(at.x - a.x - dx * t, at.y - a.y - dy * t)
    if (dist < best.dist) best = { seg: i, dist }
  }
  return [...points.slice(0, best.seg), roundPoint(at), ...points.slice(best.seg)]
}

export function distanceToPolyline(p: PlantSpinePoint, pts: PlantSpinePoint[]): number {
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const dx = b.x - a.x, dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1)
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t))
  }
  return best
}

/** Vị trí tay nắm "kéo ngọn": nằm nhô ra ngoài ngọn một đoạn theo hướng ngọn để không đè lên chấm sửa điểm. */
export function plantGrabHandle(points: PlantSpinePoint[], offset = 26): PlantSpinePoint {
  const tip = points[points.length - 1]
  const prev = points[points.length - 2] ?? tip
  const len = Math.hypot(tip.x - prev.x, tip.y - prev.y) || 1
  return { x: tip.x + ((tip.x - prev.x) / len) * offset, y: tip.y + ((tip.y - prev.y) / len) * offset }
}

/** Ghi đè tạm thời khi đang nắm ngọn: cây uốn tĩnh đúng theo góc tay kéo (không sóng gió). */
export function grabbedSpine(spine: PlantSpine, tipAngle: number): PlantSpine {
  return { ...spine, amplitude: 0, lean: tipAngle, turbulence: 0, flexibility: 0, motion: undefined }
}

export interface SwaySample {
  /** Góc uốn tại ngọn (độ) do tay kéo. */
  angle: number
  /** Thời điểm (giây). */
  t: number
}

/** Thời điểm các đỉnh đổi chiều (có ngưỡng trễ để bỏ rung tay). */
function findReversals(samples: SwaySample[], hysteresis: number): number[] {
  const times: number[] = []
  let dir = 0
  let extreme = samples[0].angle
  let extremeT = samples[0].t
  for (const s of samples) {
    if (dir === 0) {
      if (s.angle - extreme > hysteresis) dir = 1
      else if (extreme - s.angle > hysteresis) dir = -1
      if (dir !== 0) { extreme = s.angle; extremeT = s.t }
      continue
    }
    if ((dir > 0 && s.angle >= extreme) || (dir < 0 && s.angle <= extreme)) {
      extreme = s.angle; extremeT = s.t
    } else if (Math.abs(s.angle - extreme) > hysteresis) {
      times.push(extremeT)
      dir = -dir; extreme = s.angle; extremeT = s.t
    }
  }
  return times
}

/**
 * Học thông số đung đưa từ cử chỉ nắm ngọn:
 * - Kéo ra một phía rồi thả → biên độ = độ lệch xa nhất so với độ nghiêng hiện tại.
 * - Lắc qua lại ≥ 2 nhịp → biên độ = nửa khoảng lắc, độ nghiêng = tâm khoảng lắc, tốc độ = nhịp tay lắc.
 */
export function learnSwayFromGesture(
  samples: SwaySample[],
  current: Pick<PlantSpine, 'amplitude' | 'lean' | 'speed'>
): Partial<Pick<PlantSpine, 'amplitude' | 'lean' | 'speed'>> | null {
  if (samples.length < 2) return null
  const angles = samples.map((s) => s.angle)
  const min = Math.min(...angles)
  const max = Math.max(...angles)
  if (max - min < 0.5) return null
  const reversals = findReversals(samples, 1.5)
  if (reversals.length < 2) {
    const lean = current.lean ?? 0
    const reach = Math.max(Math.abs(max - lean), Math.abs(min - lean))
    return { amplitude: round(clamp(reach, 0, PLANT_AMPLITUDE_MAX), 0.5) }
  }
  const patch: Partial<Pick<PlantSpine, 'amplitude' | 'lean' | 'speed'>> = {
    amplitude: round(clamp((max - min) / 2, 0, PLANT_AMPLITUDE_MAX), 0.5),
    lean: round(clamp((max + min) / 2, -PLANT_LEAN_MAX, PLANT_LEAN_MAX), 0.5)
  }
  const halfPeriod = (reversals[reversals.length - 1] - reversals[0]) / (reversals.length - 1)
  if (halfPeriod > 0.02) patch.speed = round(clamp(1 / (2 * halfPeriod), 0.05, 3), 0.05)
  return patch
}

/**
 * Chọn layer "dưới nét vẽ": mỗi mẫu dọc nét vẽ cho danh sách layer trúng; giữ layer chứa ≥ minRatio số mẫu.
 * Trả về theo thứ tự layer trong cụm.
 */
export function pickLayersUnderStroke(hitsPerSample: string[][], layerOrder: string[], minRatio = 0.3): string[] {
  const total = hitsPerSample.length
  if (!total) return []
  const counts = new Map<string, number>()
  for (const hits of hitsPerSample) for (const id of new Set(hits)) counts.set(id, (counts.get(id) ?? 0) + 1)
  return layerOrder.filter((id) => (counts.get(id) ?? 0) / total >= minRatio)
}
