import type { PlantMotionKey, PlantSpineMotion } from '@shared/plantSpine'

/**
 * Phát lại chuyển động vẽ tay của xương motion: nội suy Catmull-Rom tuần hoàn trên các mốc góc-ngọn.
 * Dùng chung cho xem trước trong xưởng, render khung hình và xuất video (qua plantBendAngle).
 */

export const PLANT_MOTION_LIMITS = {
  maxKeys: 600,
  minDuration: 0.2,
  maxDuration: 30,
  maxAngle: 120,
  minSpeed: 0.1,
  maxSpeed: 4,
  maxLag: 1
} as const

const wrap = (t: number, period: number) => ((t % period) + period) % period

/** Chỉ số mốc cuối cùng có t ≤ time (tìm nhị phân). */
function segmentIndex(keys: PlantMotionKey[], time: number): number {
  let lo = 0
  let hi = keys.length - 1
  if (time < keys[0].t) return -1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (keys[mid].t <= time) lo = mid
    else hi = mid - 1
  }
  return lo
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, s: number): number {
  const s2 = s * s
  const s3 = s2 * s
  return 0.5 * (2 * p1 + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 + (-p0 + 3 * p1 - 3 * p2 + p3) * s3)
}

/** Góc ngọn (độ) của chuyển động vẽ tay tại thời điểm t (giây), lặp tuần hoàn theo duration. */
export function samplePlantMotion(motion: PlantSpineMotion, time: number): number {
  const keys = motion.keys
  if (!keys.length) return 0
  if (keys.length === 1) return keys[0].angle
  const period = Math.max(PLANT_MOTION_LIMITS.minDuration, motion.duration)
  const t = wrap(time, period)
  const n = keys.length
  let i = segmentIndex(keys, t)
  // Trước mốc đầu: thuộc đoạn nối mốc cuối → mốc đầu của chu kỳ sau
  let t1: number
  let t2: number
  if (i < 0 || i === n - 1) {
    i = n - 1
    t1 = keys[n - 1].t
    t2 = keys[0].t + period
  } else {
    t1 = keys[i].t
    t2 = keys[i + 1].t
  }
  const tt = t < t1 ? t + period : t
  const span = t2 - t1
  const s = span > 1e-6 ? Math.min(1, Math.max(0, (tt - t1) / span)) : 0
  const at = (k: number) => keys[((k % n) + n) % n].angle
  return catmullRom(at(i - 1), at(i), at(i + 1), at(i + 2), s)
}

/** Độ co giãn dọc thân (-1..1) tại thời điểm t (giây), lặp tuần hoàn theo duration. */
export function samplePlantMotionStretch(motion: PlantSpineMotion, time: number): number {
  const keys = motion.keys
  if (!keys.length) return 0
  const hasStretch = keys.some((k) => k.stretch !== undefined)
  if (!hasStretch) {
    if (!motion.verticalBob) return 0
    const period = Math.max(PLANT_MOTION_LIMITS.minDuration, motion.duration)
    const t = wrap(time, period)
    return motion.verticalBob * Math.sin((Math.PI * 4 * t) / period)
  }
  if (keys.length === 1) return keys[0].stretch ?? 0
  const period = Math.max(PLANT_MOTION_LIMITS.minDuration, motion.duration)
  const t = wrap(time, period)
  const n = keys.length
  let i = segmentIndex(keys, t)
  let t1: number
  let t2: number
  if (i < 0 || i === n - 1) {
    i = n - 1
    t1 = keys[n - 1].t
    t2 = keys[0].t + period
  } else {
    t1 = keys[i].t
    t2 = keys[i + 1].t
  }
  const tt = t < t1 ? t + period : t
  const span = t2 - t1
  const s = span > 1e-6 ? Math.min(1, Math.max(0, (tt - t1) / span)) : 0
  const at = (k: number) => keys[((k % n) + n) % n].stretch ?? 0
  return catmullRom(at(i - 1), at(i), at(i + 1), at(i + 2), s)
}

/** Khoảng góc ngọn nhỏ nhất / lớn nhất của chuyển động vẽ tay (dùng vẽ bóng biên độ). */
export function plantMotionRange(motion: PlantSpineMotion, steps = 96): { min: number; max: number } {
  if (!motion.keys.length) return { min: 0, max: 0 }
  let min = Infinity
  let max = -Infinity
  for (let k = 0; k < steps; k++) {
    const a = samplePlantMotion(motion, (motion.duration * k) / steps)
    if (a < min) min = a
    if (a > max) max = a
  }
  return { min, max }
}

/** Kiểm tra hợp lệ dữ liệu chuyển động vẽ tay; ném lỗi tiếng Việt khi sai. */
export function validatePlantMotion(motion: PlantSpineMotion): void {
  const L = PLANT_MOTION_LIMITS
  if (!motion || !Array.isArray(motion.keys) || motion.keys.length < 2) throw new Error('Chuyển động vẽ tay cần ít nhất 2 mốc')
  if (motion.keys.length > L.maxKeys) throw new Error(`Chuyển động vẽ tay tối đa ${L.maxKeys} mốc`)
  if (!Number.isFinite(motion.duration) || motion.duration < L.minDuration || motion.duration > L.maxDuration) {
    throw new Error(`Chu kỳ chuyển động phải trong khoảng ${L.minDuration}–${L.maxDuration} giây`)
  }
  let prev = -Infinity
  for (const k of motion.keys) {
    if (!Number.isFinite(k.t) || !Number.isFinite(k.angle)) throw new Error('Mốc chuyển động không hợp lệ')
    if (k.t < 0 || k.t >= motion.duration + 1e-6) throw new Error('Thời điểm mốc phải nằm trong [0, chu kỳ)')
    if (k.t <= prev) throw new Error('Thời điểm các mốc phải tăng dần')
    if (Math.abs(k.angle) > L.maxAngle) throw new Error(`Góc ngọn tối đa ±${L.maxAngle}°`)
    if (k.stretch !== undefined && (!Number.isFinite(k.stretch) || Math.abs(k.stretch) > 2)) {
      throw new Error('Độ co giãn mốc phải trong khoảng ±2')
    }
    prev = k.t
  }
  const { speed, lag, windMix, verticalBob } = motion
  if (speed !== undefined && (!Number.isFinite(speed) || speed < L.minSpeed || speed > L.maxSpeed)) {
    throw new Error(`Tốc độ phát lại phải trong khoảng ${L.minSpeed}–${L.maxSpeed}`)
  }
  if (lag !== undefined && (!Number.isFinite(lag) || lag < 0 || lag > L.maxLag)) throw new Error(`Độ trễ ngọn phải trong khoảng 0–${L.maxLag} giây`)
  if (windMix !== undefined && (!Number.isFinite(windMix) || windMix < 0 || windMix > 1)) throw new Error('Trộn gió phải trong khoảng 0–1')
  if (verticalBob !== undefined && (!Number.isFinite(verticalBob) || verticalBob < 0 || verticalBob > 2)) {
    throw new Error('Độ co giãn dọc phải trong khoảng 0–2')
  }
}

