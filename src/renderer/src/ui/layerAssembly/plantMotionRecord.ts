import type { PlantMotionKey, PlantSpine, PlantSpineMotion } from '@shared/plantSpine'
import { PLANT_MOTION_LIMITS } from '../../engine/plantMotion'
import { learnSwayFromGesture, type SwaySample } from './plantSpineEdit'

/**
 * Ghi chuyển động vẽ tay cho xương thực vật (giống "motion recording" của Moho / Cartoon Animator):
 * người dùng nắm ngọn kéo theo nhịp mong muốn → mẫu góc-ngọn theo thời gian thật → làm mượt,
 * cắt đoạn đứng yên đầu, (tuỳ chọn) bật nảy về khi thả tay, khép vòng lặp liền mạch và rút gọn mốc.
 */

/** loop = lặp đúng cử chỉ vừa vẽ · spring = sau khi thả tay, cây bật nảy tắt dần về tư thế nghỉ. */
export type PlantRecordEnd = 'loop' | 'spring'

export interface PlantRecordOptions {
  end: PlantRecordEnd
  /** Tần số nảy (Hz) khi end = spring. */
  springHz?: number
  /** Giữ lại các tuỳ chỉnh phát lại của bản ghi cũ khi ghi đè. */
  keep?: Pick<PlantSpineMotion, 'speed' | 'lag' | 'windMix'>
}

const FPS = 30
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d
const clampAngle = (a: number) => Math.max(-PLANT_MOTION_LIMITS.maxAngle, Math.min(PLANT_MOTION_LIMITS.maxAngle, a))

/** Sắp xếp, bỏ mẫu hỏng/trùng thời điểm và cắt đoạn đứng yên lúc mới nắm. */
export function cleanSwaySamples(samples: SwaySample[], idleThreshold = 0.4): SwaySample[] {
  const sorted = samples.filter((s) => Number.isFinite(s.t) && Number.isFinite(s.angle)).sort((a, b) => a.t - b.t)
  const unique: SwaySample[] = []
  for (const s of sorted) {
    if (unique.length && Math.abs(unique[unique.length - 1].t - s.t) < 1e-4) unique[unique.length - 1] = s
    else unique.push(s)
  }
  if (unique.length < 2) return unique
  const first = unique.findIndex((s) => Math.abs(s.angle - unique[0].angle) > idleThreshold)
  if (first <= 0) return unique
  const start = Math.max(0, first - 1)
  return unique.slice(start).map((s) => ({ ...s, t: s.t - unique[start].t }))
}

/** Chia lại mẫu thành lưới đều FPS khung/giây (nội suy tuyến tính). */
export function resampleSway(samples: SwaySample[], maxDuration: number = PLANT_MOTION_LIMITS.maxDuration): number[] {
  const t0 = samples[0].t
  const span = Math.min(maxDuration, samples[samples.length - 1].t - t0)
  const n = Math.max(2, Math.floor(span * FPS) + 1)
  const out: number[] = []
  let j = 1
  for (let k = 0; k < n; k++) {
    const t = t0 + k / FPS
    while (j < samples.length - 1 && samples[j].t < t) j++
    const a = samples[j - 1]
    const b = samples[j]
    const s = b.t - a.t > 1e-6 ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1
    out.push(a.angle + (b.angle - a.angle) * s)
  }
  return out
}

function smooth(values: number[], passes = 2): number[] {
  let v = values
  for (let p = 0; p < passes; p++) {
    v = v.map((x, i) => (i === 0 || i === v.length - 1 ? x : (v[i - 1] + 2 * x + v[i + 1]) / 4))
  }
  return v
}

/** Nảy tắt dần từ góc lúc thả tay về 0 (lò xo giảm chấn). */
export function springTail(from: number, hz = 1.2): number[] {
  if (Math.abs(from) < 0.3) return []
  const decay = 2.4
  const duration = Math.min(3, Math.max(0.6, Math.log(Math.abs(from) / 0.25) / decay))
  const w = Math.PI * 2 * Math.max(0.3, hz)
  const n = Math.round(duration * FPS)
  const out: number[] = []
  for (let k = 1; k <= n; k++) {
    const t = k / FPS
    out.push(from * Math.exp(-decay * t) * Math.cos(w * t))
  }
  return out
}

/** Khép vòng lặp: kéo dần đoạn cuối về giá trị đầu để không giật khi lặp lại. */
export function closeLoop(values: number[]): number[] {
  const n = values.length
  if (n < 3) return values
  const d = values[n - 1] - values[0]
  if (Math.abs(d) < 1e-3) return values
  const w = Math.max(2, Math.min(Math.round(0.5 * FPS), Math.floor(n * 0.25)))
  return values.map((v, i) => {
    const r = (i - (n - 1 - w)) / w
    if (r <= 0) return v
    const e = r * r * (3 - 2 * r)
    return v - d * e
  })
}

/** Ramer–Douglas–Peucker theo sai số dọc (độ) — giữ dáng đường cong với ít mốc nhất. */
export function reducePlantKeys(keys: PlantMotionKey[], tolerance: number): PlantMotionKey[] {
  if (keys.length <= 2) return keys
  const keep = new Set([0, keys.length - 1])
  const walk = (a: number, b: number) => {
    let worst = -1
    let dist = tolerance
    for (let i = a + 1; i < b; i++) {
      const s = (keys[i].t - keys[a].t) / (keys[b].t - keys[a].t || 1)
      const d = Math.abs(keys[i].angle - (keys[a].angle + (keys[b].angle - keys[a].angle) * s))
      if (d > dist) { dist = d; worst = i }
    }
    if (worst < 0) return
    keep.add(worst)
    walk(a, worst)
    walk(worst, b)
  }
  walk(0, keys.length - 1)
  return [...keep].sort((x, y) => x - y).map((i) => keys[i])
}

/**
 * Dựng chuyển động vẽ tay từ mẫu góc-ngọn đã ghi. Trả về null khi cử chỉ quá ngắn hoặc gần như không chuyển động.
 */
export function buildPlantMotion(samples: SwaySample[], options: PlantRecordOptions): PlantSpineMotion | null {
  const clean = cleanSwaySamples(samples)
  if (clean.length < 2) return null
  const angles = clean.map((s) => s.angle)
  if (Math.max(...angles) - Math.min(...angles) < 0.5) return null
  if (clean[clean.length - 1].t - clean[0].t < 0.15) return null
  let values = smooth(resampleSway(clean))
  if (options.end === 'spring') values = [...values, ...springTail(values[values.length - 1], options.springHz)]
  values = closeLoop(values).map(clampAngle)
  // Mẫu cuối trùng mẫu đầu của chu kỳ sau → bỏ để vòng lặp liền mạch
  const body = values.slice(0, -1)
  const duration = Math.min(PLANT_MOTION_LIMITS.maxDuration, Math.max(PLANT_MOTION_LIMITS.minDuration, body.length / FPS))
  const dense = body.map((angle, i) => ({ t: i / FPS, angle })).filter((k) => k.t < duration)
  let tolerance = 0.25
  let keys = reducePlantKeys(dense, tolerance)
  while (keys.length > PLANT_MOTION_LIMITS.maxKeys) keys = reducePlantKeys(dense, (tolerance *= 1.6))
  return {
    keys: keys.map((k) => ({ t: round(k.t, 3), angle: round(k.angle, 2) })),
    duration: round(duration, 3),
    ...(options.keep?.speed !== undefined ? { speed: options.keep.speed } : {}),
    lag: options.keep?.lag ?? 0.08,
    ...(options.keep?.windMix !== undefined ? { windMix: options.keep.windMix } : {})
  }
}

/** Sửa góc một mốc (kéo chấm trên biểu đồ chuyển động). */
export function setPlantMotionKeyAngle(motion: PlantSpineMotion, index: number, angle: number): PlantSpineMotion {
  if (index < 0 || index >= motion.keys.length) return motion
  return { ...motion, keys: motion.keys.map((k, i) => (i === index ? { ...k, angle: round(clampAngle(angle), 2) } : k)) }
}

/** Phóng to / thu nhỏ biên độ toàn bộ bản ghi. */
export function scalePlantMotion(motion: PlantSpineMotion, factor: number): PlantSpineMotion {
  return { ...motion, keys: motion.keys.map((k) => ({ ...k, angle: round(clampAngle(k.angle * factor), 2) })) }
}

/** Lật chiều chuyển động (trái ↔ phải). */
export function mirrorPlantMotion(motion: PlantSpineMotion): PlantSpineMotion {
  return scalePlantMotion(motion, -1)
}

/** Kết quả một cử chỉ nắm ngọn: ghi chuyển động vẽ tay (record) hoặc học thông số gió (learn). */
export function resolvePlantGrab(
  samples: SwaySample[],
  spine: PlantSpine,
  options: { mode: 'record' | 'learn'; end: PlantRecordEnd }
): { patch: Partial<PlantSpine>; message: string } | null {
  if (options.mode === 'record') {
    const motion = buildPlantMotion(samples, { end: options.end, keep: spine.motion })
    if (!motion) return null
    const tail = options.end === 'spring' ? ' · nảy về khi thả' : ' · lặp liền mạch'
    return { patch: { motion }, message: `✍️ Đã ghi chuyển động vẽ tay: ${motion.duration.toFixed(2)}s · ${motion.keys.length} mốc${tail}` }
  }
  const learned = learnSwayFromGesture(samples, spine)
  if (!learned) return null
  const parts = [`±${learned.amplitude ?? spine.amplitude}°`]
  if (learned.lean !== undefined) parts.push(`nghiêng ${learned.lean}°`)
  if (learned.speed !== undefined) parts.push(`${learned.speed} nhịp/s`)
  return { patch: { ...learned, motion: undefined }, message: `🌬️ Đã học nhịp gió: ${parts.join(' · ')}` }
}
