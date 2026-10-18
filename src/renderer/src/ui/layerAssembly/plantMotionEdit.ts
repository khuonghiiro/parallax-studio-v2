import type { PlantMotionKey, PlantSpineMotion } from '@shared/plantSpine'
import { PLANT_MOTION_LIMITS, samplePlantMotion, samplePlantMotionStretch } from '../../engine/plantMotion'
import { reducePlantKeys } from './plantMotionRecord'

/**
 * Chỉnh sửa đồ thị nhịp thực vật như Graph Editor (After Effects / Spine): thêm, xoá, kéo mốc theo cả thời gian
 * lẫn góc, làm gọn mốc dày (bản ghi tay), làm mượt và cân đối trái – phải cho chu kỳ lắc đều.
 */
export const PLANT_KEY_GAP = 0.02

const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d
const clampAngle = (a: number) => Math.max(-PLANT_MOTION_LIMITS.maxAngle, Math.min(PLANT_MOTION_LIMITS.maxAngle, a))
const hasStretch = (m: PlantSpineMotion) => m.keys.some((k) => k.stretch !== undefined)

/** Chèn mốc tại thời điểm t, giữ nguyên dáng đường cong (góc lấy theo đường cong hiện tại). */
export function insertPlantKey(motion: PlantSpineMotion, t: number): { motion: PlantSpineMotion; index: number } {
  const time = round(Math.max(0, Math.min(motion.duration - PLANT_KEY_GAP, t)))
  const near = motion.keys.findIndex((k) => Math.abs(k.t - time) < PLANT_KEY_GAP)
  if (near >= 0 || motion.keys.length >= PLANT_MOTION_LIMITS.maxKeys) return { motion, index: near }
  const key: PlantMotionKey = { t: time, angle: round(samplePlantMotion(motion, time), 2) }
  if (hasStretch(motion)) key.stretch = round(samplePlantMotionStretch(motion, time))
  const keys = [...motion.keys, key].sort((a, b) => a.t - b.t)
  return { motion: { ...motion, keys }, index: keys.indexOf(key) }
}

/** Xoá một mốc (luôn giữ tối thiểu 2 mốc để đường cong hợp lệ). */
export function removePlantKey(motion: PlantSpineMotion, index: number): PlantSpineMotion {
  if (motion.keys.length <= 2 || index < 0 || index >= motion.keys.length) return motion
  return { ...motion, keys: motion.keys.filter((_, i) => i !== index) }
}

/** Dời mốc theo thời gian + góc; thời gian bị kẹp giữa 2 mốc lân cận để thứ tự không đảo. */
export function movePlantKey(motion: PlantSpineMotion, index: number, t: number, angle: number): PlantSpineMotion {
  const keys = motion.keys
  if (index < 0 || index >= keys.length) return motion
  const lo = index > 0 ? keys[index - 1].t + PLANT_KEY_GAP : 0
  const hi = index < keys.length - 1 ? keys[index + 1].t - PLANT_KEY_GAP : motion.duration - PLANT_KEY_GAP
  const time = round(Math.max(lo, Math.min(hi, t)))
  return { ...motion, keys: keys.map((k, i) => (i === index ? { ...k, t: time, angle: round(clampAngle(angle), 2) } : k)) }
}

/** Làm gọn bản ghi dày đặc còn tối đa `maxKeys` mốc (Ramer–Douglas–Peucker) để sửa tay từng mốc. */
export function simplifyPlantMotion(motion: PlantSpineMotion, maxKeys = 12): PlantSpineMotion {
  if (motion.keys.length <= maxKeys) return motion
  let tolerance = 0.5
  let keys = reducePlantKeys(motion.keys, tolerance)
  while (keys.length > maxKeys && tolerance < 200) keys = reducePlantKeys(motion.keys, (tolerance *= 1.5))
  return { ...motion, keys }
}

/** Làm mượt góc các mốc (lọc 1-2-1 tuần hoàn) — khử rung tay khi vẽ. */
export function smoothPlantMotion(motion: PlantSpineMotion): PlantSpineMotion {
  const n = motion.keys.length
  if (n < 3) return motion
  const at = (i: number) => motion.keys[(i + n) % n]
  return {
    ...motion,
    keys: motion.keys.map((k, i) => ({
      ...k,
      angle: round(clampAngle((at(i - 1).angle + 2 * k.angle + at(i + 1).angle) / 4), 2),
      ...(k.stretch !== undefined ? { stretch: round(((at(i - 1).stretch ?? 0) + 2 * k.stretch + (at(i + 1).stretch ?? 0)) / 4) } : {})
    }))
  }
}

/**
 * Cân đối trái – phải: nửa sau chu kỳ là ảnh gương của nửa đầu (góc đảo dấu) → cây lắc đều hai bên,
 * nhịp nhún lặp lại 2 lần mỗi chu kỳ như chuyển động lắc thật.
 */
export function balancePlantMotion(motion: PlantSpineMotion): PlantSpineMotion {
  const half = motion.duration / 2
  const first = motion.keys.filter((k) => k.t < half - PLANT_KEY_GAP / 2)
  const base = first.length >= 1 ? first : [{ t: 0, angle: samplePlantMotion(motion, 0) }]
  const mirrored = base.map((k) => ({ ...k, t: round(k.t + half), angle: round(-k.angle, 2) }))
  const keys = [...base, ...mirrored].filter((k) => k.t < motion.duration - PLANT_KEY_GAP / 2).sort((a, b) => a.t - b.t)
  return keys.length >= 2 ? { ...motion, keys } : motion
}
