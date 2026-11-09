import type { BoneBezier, BoneEasing, BoneKeyframe } from '@shared/layerRig'

/**
 * Chuẩn hoá keyframe nhập từ JSON / AI để phát lại MƯỢT:
 *  - `parseRawKeyframe`: đọc 1 keyframe (chấp nhận alias t/rot/angle/sx/sy/scale/zIndex, `bezier`).
 *  - `finalizeTracksForPlayback`: kẹp thời gian trong [0, duration], gộp key trùng thời điểm,
 *    khép kín vòng lặp (key 0 = key duration) và cảnh báo cú giật vận tốc.
 */

const VALID_EASINGS = new Set<BoneEasing>(['smooth', 'linear', 'hold', 'ease-in', 'ease-out', 'ease-in-out', 'bezier'])

/** Ngưỡng cảnh báo giật: tốc độ xoay (°/s) và tốc độ dịch (px/s) giữa 2 key kề nhau */
export const MAX_SMOOTH_ANGULAR_SPEED = 900
export const MAX_SMOOTH_LINEAR_SPEED = 1500

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

function parseBezier(raw: unknown): BoneBezier | undefined {
  if (!Array.isArray(raw) || raw.length !== 4) return undefined
  const vals = raw.map((v) => num(v))
  if (vals.some((v) => v === undefined)) return undefined
  const [x1, y1, x2, y2] = vals as number[]
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
  return [clamp01(x1), Number(y1.toFixed(4)), clamp01(x2), Number(y2.toFixed(4))]
}

/** Đọc 1 keyframe thô từ JSON. Trả về null nếu không phải object. */
export function parseRawKeyframe(item: unknown): BoneKeyframe | null {
  if (typeof item !== 'object' || item === null) return null
  const kf = item as Record<string, unknown>
  const time = Math.max(0, num(kf.time ?? kf.t) ?? 0)
  const generalScale = num(kf.scale) ?? 1
  const rawZ = kf.zOrder ?? kf.zIndex ?? kf.z ?? kf.layerZ ?? kf.order
  const zOrder = rawZ !== undefined && Number.isFinite(Number(rawZ)) ? Number(rawZ) : undefined
  const rawEase = kf.easing ?? kf.ease
  let easing: BoneEasing = typeof rawEase === 'string' && VALID_EASINGS.has(rawEase as BoneEasing) ? (rawEase as BoneEasing) : 'smooth'
  const bezier = parseBezier(kf.bezier)
  if (easing === 'bezier' && !bezier) easing = 'ease-in-out'
  return {
    time: Number(time.toFixed(4)),
    rotation: Number((num(kf.rotation ?? kf.rot ?? kf.angle) ?? 0).toFixed(3)),
    x: Number((num(kf.x) ?? 0).toFixed(2)),
    y: Number((num(kf.y) ?? 0).toFixed(2)),
    scaleX: Number((num(kf.scaleX ?? kf.sx) ?? generalScale).toFixed(3)),
    scaleY: Number((num(kf.scaleY ?? kf.sy) ?? generalScale).toFixed(3)),
    easing,
    ...(easing === 'bezier' && bezier ? { bezier } : {}),
    ...(zOrder !== undefined ? { zOrder } : {})
  }
}

export interface FinalizeTracksOptions {
  duration: number
  loop: boolean
  fps: number
}

export interface FinalizeTracksResult {
  tracks: Record<string, BoneKeyframe[]>
  fixesApplied: string[]
  warnings: string[]
}

const POSE_FIELDS = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'zOrder'] as const

function poseEquals(a: BoneKeyframe, b: BoneKeyframe): boolean {
  return POSE_FIELDS.every((f) => {
    const def = f === 'scaleX' || f === 'scaleY' ? 1 : 0
    return Math.abs((a[f] ?? def) - (b[f] ?? def)) < 1e-6
  })
}

/** Kẹp thời gian vào [0, duration] (không bắt khung để giữ nguyên nhịp AI đã thiết kế; engine nội suy liên tục). */
function clampTime(t: number, duration: number): number {
  return Number(Math.max(0, Math.min(duration, t)).toFixed(4))
}

/** Kẹp + gộp key trùng thời điểm (giữ key sau cùng; key vượt thời lượng không đè key hợp lệ). */
function normalizeTrackTimes(keys: BoneKeyframe[], opts: FinalizeTracksOptions): { keys: BoneKeyframe[]; clipped: number; merged: number } {
  let clipped = 0
  const byTime = new Map<number, BoneKeyframe>()
  for (const k of [...keys].sort((a, b) => a.time - b.time)) {
    const beyond = k.time > opts.duration + 1e-6
    if (beyond) clipped++
    const time = clampTime(k.time, opts.duration)
    if (beyond && byTime.has(time)) continue
    byTime.set(time, { ...k, time })
  }
  const out = [...byTime.values()].sort((a, b) => a.time - b.time)
  return { keys: out, clipped, merged: keys.length - out.length }
}

function speedWarnings(boneId: string, keys: BoneKeyframe[]): string[] {
  const out: string[] = []
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]
    const b = keys[i]
    const dt = b.time - a.time
    if (dt <= 0 || a.easing === 'hold') continue
    const ang = Math.abs(b.rotation - a.rotation) / dt
    const lin = Math.hypot(b.x - a.x, b.y - a.y) / dt
    if (ang > MAX_SMOOTH_ANGULAR_SPEED || lin > MAX_SMOOTH_LINEAR_SPEED) {
      out.push(
        `Xương "${boneId}" đổi quá nhanh giữa ${a.time}s → ${b.time}s (${Math.round(ang)}°/s, ${Math.round(lin)}px/s) — có thể bị giật, nên giãn thời gian hoặc thêm key trung gian.`
      )
      break
    }
  }
  return out
}

/**
 * Chuẩn hoá toàn bộ tracks trước khi tạo clip để phát lại mượt và vòng lặp liền mạch.
 */
export function finalizeTracksForPlayback(
  tracks: Record<string, BoneKeyframe[]>,
  opts: FinalizeTracksOptions
): FinalizeTracksResult {
  const fixesApplied: string[] = []
  const warnings: string[] = []
  const next: Record<string, BoneKeyframe[]> = {}
  let clippedTotal = 0
  let mergedTotal = 0
  let loopFixed = 0
  for (const [boneId, raw] of Object.entries(tracks)) {
    const { keys, clipped, merged } = normalizeTrackTimes(raw, opts)
    clippedTotal += clipped
    mergedTotal += merged
    if (opts.loop && keys.length >= 2) {
      const first = keys[0]
      const last = keys[keys.length - 1]
      if (first.time <= 1e-6 && Math.abs(last.time - opts.duration) <= 1e-6 && !poseEquals(first, last)) {
        keys[keys.length - 1] = { ...first, time: last.time, easing: last.easing }
        loopFixed++
      }
    }
    warnings.push(...speedWarnings(boneId, keys))
    if (keys.length > 0) next[boneId] = keys
  }
  if (clippedTotal > 0) fixesApplied.push(`Kẹp ${clippedTotal} keyframe vượt quá thời lượng ${opts.duration}s về cuối clip.`)
  if (mergedTotal > 0) fixesApplied.push(`Gộp ${mergedTotal} keyframe trùng thời điểm.`)
  if (loopFixed > 0) fixesApplied.push(`Khép kín vòng lặp cho ${loopFixed} xương (key cuối = key đầu) để lặp liền mạch không giật.`)
  return { tracks: next, fixesApplied, warnings }
}
