import type { BoneBezier, BoneEasing, BoneKeyframe, BonePose, LayerRig } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/layerRig'
import { KEY_EPSILON, sameKeyTime } from './workshopAnimation'

/**
 * Công cụ hoạt hoạ pose-to-pose (lấy cảm hứng từ Tween Machine của Maya, Spine dopesheet, Moho timeline):
 *  - breakdown: chèn dáng trung gian giữa 2 key theo tỉ lệ "nghiêng về" (favor) — kỹ thuật chính của hoạt hoạ chuyên nghiệp.
 *  - close-loop: đặt key cuối clip trùng dáng đầu clip → vòng lặp liền mạch, không giật.
 *  - overlap: lệch pha các xương con theo cấp (follow-through / overlapping action cho tay, tóc, đuôi).
 *  - retime / reverse / shift-time: co giãn nhịp, đảo ngược, chèn hoặc bớt khoảng thời gian tại đầu phát.
 * Mọi hàm ghi trực tiếp vào `rig` (đã clone trong applyRigAction) để UI và MCP dùng chung một luồng hoàn tác.
 */
export type AnimToolOp =
  | { op: 'breakdown'; time: number; favor: number; boneIds?: string[] }
  | { op: 'close-loop' }
  | { op: 'overlap'; rootBoneId: string; delay: number }
  | { op: 'retime'; factor: number }
  | { op: 'reverse' }
  | { op: 'shift-time'; from: number; delta: number }

const POSE_FIELDS = ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const
const round3 = (v: number) => Math.round(v * 1000) / 1000
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function poseOf(source: BonePose): BonePose {
  return { x: source.x, y: source.y, rotation: source.rotation, scaleX: source.scaleX ?? 1, scaleY: source.scaleY ?? 1 }
}

function lerpPose(a: BonePose, b: BonePose, s: number): BonePose {
  const out = poseOf(a)
  for (const f of POSE_FIELDS) {
    const va = a[f] ?? (f.startsWith('scale') ? 1 : 0)
    const vb = b[f] ?? (f.startsWith('scale') ? 1 : 0)
    out[f] = Math.round((va + (vb - va) * s) * 1000) / 1000
  }
  return out
}

function putKey(rig: LayerRig, boneId: string, key: BoneKeyframe): void {
  const keys = (rig.tracks[boneId] ?? []).filter((k) => !sameKeyTime(k.time, key.time))
  rig.tracks[boneId] = [...keys, key].sort((a, b) => a.time - b.time)
}

/** Thời điểm mọi keyframe (của một xương hoặc toàn clip), đã sắp xếp và khử trùng. */
export function keyTimes(rig: Pick<LayerRig, 'tracks'>, boneId?: string | null): number[] {
  const tracks = boneId ? [rig.tracks[boneId] ?? []] : Object.values(rig.tracks)
  const out: number[] = []
  for (const t of tracks.flat().map((k) => k.time).sort((a, b) => a - b)) {
    if (!out.length || !sameKeyTime(out[out.length - 1], t)) out.push(t)
  }
  return out
}

/** Key kế tiếp (dir = 1) hoặc trước đó (dir = -1) so với thời điểm hiện tại; null khi không còn key. */
export function neighborKeyTime(rig: Pick<LayerRig, 'tracks'>, time: number, dir: 1 | -1, boneId?: string | null): number | null {
  const times = keyTimes(rig, boneId)
  if (dir > 0) return times.find((t) => t > time + KEY_EPSILON) ?? null
  return [...times].reverse().find((t) => t < time - KEY_EPSILON) ?? null
}

/** Có thể chèn dáng trung gian khi đầu phát nằm giữa 2 key (ít nhất một xương). */
export function canBreakdown(rig: Pick<LayerRig, 'tracks'>, time: number): boolean {
  return Object.values(rig.tracks).some(
    (keys) => keys.some((k) => k.time < time - KEY_EPSILON) && keys.some((k) => k.time > time + KEY_EPSILON)
  )
}

function breakdown(rig: LayerRig, time: number, favor: number, boneIds?: string[]): number {
  const s = clamp(favor, -0.5, 1.5)
  let count = 0
  for (const [boneId, keys] of Object.entries(rig.tracks)) {
    if (boneIds?.length && !boneIds.includes(boneId)) continue
    const prev = keys.filter((k) => k.time < time - KEY_EPSILON).at(-1)
    const next = keys.find((k) => k.time > time + KEY_EPSILON)
    if (!prev || !next) continue
    putKey(rig, boneId, {
      time: round3(time),
      ...lerpPose(prev, next, s),
      easing: prev.easing ?? 'smooth',
      ...(prev.easing === 'bezier' && prev.bezier ? { bezier: prev.bezier } : {})
    })
    count++
  }
  return count
}

function closeLoop(rig: LayerRig): void {
  const dur = rig.duration
  for (const [boneId, keys] of Object.entries(rig.tracks)) {
    if (!keys.length) continue
    const start = keys.find((k) => sameKeyTime(k.time, 0)) ?? { ...keys[0], time: 0 }
    putKey(rig, boneId, { ...start, time: 0 })
    putKey(rig, boneId, { ...start, ...poseOf(start), time: dur })
  }
  rig.loop = true
}

function descendantsWithDepth(rig: LayerRig, rootId: string): Map<string, number> {
  const depth = new Map<string, number>([[rootId, 0]])
  let changed = true
  while (changed) {
    changed = false
    for (const b of rig.bones) {
      if (!b.parentId || depth.has(b.id) || !depth.has(b.parentId)) continue
      depth.set(b.id, depth.get(b.parentId)! + 1)
      changed = true
    }
  }
  depth.delete(rootId)
  return depth
}

function shiftTrack(rig: LayerRig, boneId: string, shift: number): void {
  const original = rig.tracks[boneId] ?? []
  if (original.length < 2 || Math.abs(shift) < KEY_EPSILON) return
  const dur = rig.duration
  const src: LayerRig = { ...rig, tracks: { [boneId]: original } }
  const place = (t: number) => (rig.loop ? ((t % dur) + dur) % dur : clamp(t, 0, dur))
  const sample = (t: number) => poseOf(sampleBonePose(src, boneId, place(t - shift)))
  const easingAt = new Map<number, BoneKeyframe>()
  for (const k of original) easingAt.set(round3(place(k.time + shift)), k)
  const times = [...new Set([0, dur, ...easingAt.keys()].map(round3))].sort((a, b) => a - b)
  rig.tracks[boneId] = times.map((t) => {
    const ref = easingAt.get(t)
    return { time: t, ...sample(t), easing: ref?.easing ?? 'smooth', ...(ref?.bezier ? { bezier: ref.bezier } : {}) }
  })
}

function overlap(rig: LayerRig, rootBoneId: string, delay: number): number {
  if (!rig.bones.some((b) => b.id === rootBoneId)) throw new Error(`Unknown bone ID: ${rootBoneId}`)
  const d = clamp(delay, -1, 1)
  const depth = descendantsWithDepth(rig, rootBoneId)
  for (const [id, level] of depth) shiftTrack(rig, id, d * level)
  return depth.size
}

function dedupeSorted(keys: BoneKeyframe[]): BoneKeyframe[] {
  const out: BoneKeyframe[] = []
  for (const k of keys.sort((a, b) => a.time - b.time)) {
    if (out.length && sameKeyTime(out[out.length - 1].time, k.time)) out[out.length - 1] = k
    else out.push(k)
  }
  return out
}

function retime(rig: LayerRig, factor: number): void {
  const nextDur = clamp(round3(rig.duration * clamp(factor, 0.05, 20)), 0.1, 120)
  const f = nextDur / rig.duration
  for (const [id, keys] of Object.entries(rig.tracks)) {
    rig.tracks[id] = dedupeSorted(keys.map((k) => ({ ...k, time: Math.min(nextDur, round3(k.time * f)) })))
  }
  rig.duration = nextDur
}

const SWAP_EASING: Partial<Record<BoneEasing, BoneEasing>> = { 'ease-in': 'ease-out', 'ease-out': 'ease-in' }
const reverseBezier = (b?: BoneBezier): BoneBezier | undefined => (b ? [1 - b[2], 1 - b[3], 1 - b[0], 1 - b[1]] : undefined)

function reverse(rig: LayerRig): void {
  const dur = rig.duration
  for (const [id, keys] of Object.entries(rig.tracks)) {
    const n = keys.length
    rig.tracks[id] = keys
      .map((_, j) => {
        const src = keys[n - 1 - j]
        const seg = keys[n - 2 - j]
        const easing = seg ? SWAP_EASING[seg.easing] ?? seg.easing : 'smooth'
        const bezier = seg && seg.easing === 'bezier' ? reverseBezier(seg.bezier) : undefined
        return { ...poseOf(src), time: round3(dur - src.time), easing, ...(bezier ? { bezier } : {}) }
      })
      .sort((a, b) => a.time - b.time)
  }
}

function shiftTime(rig: LayerRig, from: number, delta: number): void {
  const d = clamp(delta, -(rig.duration - from), 120 - rig.duration)
  if (Math.abs(d) < KEY_EPSILON) return
  for (const [id, keys] of Object.entries(rig.tracks)) {
    // Bớt thời gian: các key nằm trong đoạn bị cắt (from, from + |d|) bị loại bỏ.
    const kept = d < 0 ? keys.filter((k) => k.time <= from + KEY_EPSILON || k.time >= from - d - KEY_EPSILON) : keys
    rig.tracks[id] = dedupeSorted(kept.map((k) => (k.time > from + KEY_EPSILON ? { ...k, time: round3(k.time + d) } : k)))
  }
  const maxKey = Math.max(0, ...Object.values(rig.tracks).flat().map((k) => k.time))
  rig.duration = clamp(round3(rig.duration + d), Math.max(0.1, maxKey), 120)
}

/** Áp dụng một công cụ pose-to-pose; trả về số xương bị ảnh hưởng (để UI/MCP báo kết quả). */
export function applyAnimTool(rig: LayerRig, tool: AnimToolOp): number {
  switch (tool.op) {
    case 'breakdown':
      return breakdown(rig, tool.time, tool.favor, tool.boneIds)
    case 'close-loop':
      closeLoop(rig)
      return Object.keys(rig.tracks).length
    case 'overlap':
      return overlap(rig, tool.rootBoneId, tool.delay)
    case 'retime':
      retime(rig, tool.factor)
      return Object.keys(rig.tracks).length
    case 'reverse':
      reverse(rig)
      return Object.keys(rig.tracks).length
    case 'shift-time':
      shiftTime(rig, tool.from, tool.delta)
      return Object.keys(rig.tracks).length
  }
}
