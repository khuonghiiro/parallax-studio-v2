import type { BonePose, LayerBone, LayerRig } from '@shared/layerRig'
import { evaluateRig, rotatePoint, sampleBonePose } from '../../engine/layerRig'
import type { LayerComposite } from './types'
import { applyRigAction, emptyRig, ensureRigClips, type RigAction } from './workshopRig'
import { sameKeyTime, type AnimationAction, type KeyPatch } from './workshopAnimation'

/**
 * Vẽ động tác (Motion Sketch) — tab Animation:
 * nhấn gần một xương rồi vẽ đường đi của ngọn xương; nét vẽ được lấy mẫu theo đúng nhịp tay
 * (hoặc chia đều) và ghi thành keyframe xoay/dời cho xương đó.
 */

export interface Point2D {
  x: number
  y: number
}

export interface SketchSample extends Point2D {
  /** Thời điểm (giây) khi chuột đi qua điểm này. */
  t: number
}

export type MotionSketchMode = 'rotate' | 'move'
export type MotionSketchTiming = 'hand' | 'even'

export interface MotionSketchSettings {
  mode: MotionSketchMode
  timing: MotionSketchTiming
  /** Thời lượng động tác (giây) tính từ thời điểm bắt đầu vẽ. */
  duration: number
  /** Khứ hồi: đi hết nét vẽ rồi quay ngược về tư thế ban đầu. */
  loopBack: boolean
  /** Tự phát thử ngay sau khi thả chuột. */
  autoPlay: boolean
}

export const DEFAULT_SKETCH_SETTINGS: MotionSketchSettings = {
  mode: 'rotate',
  timing: 'hand',
  duration: 1,
  loopBack: false,
  autoPlay: true
}

/** Mốc neo khi bắt đầu nét vẽ: khớp xoay, hướng tham chiếu và tư thế gốc tại thời điểm bắt đầu. */
export interface SketchAnchor {
  boneId: string
  boneName: string
  pivot: Point2D
  refAngle: number
  start: Point2D
  base: BonePose
  parentRotation: number
  parentScaleX: number
  parentScaleY: number
}

export function normalizeAngle(deg: number): number {
  return ((deg + 180) % 360 + 360) % 360 - 180
}

const angleTo = (from: Point2D, to: Point2D) => (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
const round = (v: number, digits: number) => Number(v.toFixed(digits))

function distanceToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t)
}

/** Vị trí khớp gốc & ngọn của từng xương tại thời điểm time (toạ độ cụm layer). */
export function boneSegments(rig: LayerRig, time: number): Array<{ bone: LayerBone; head: Point2D; tail: Point2D }> {
  const transforms = evaluateRig({ ...rig, loop: false }, time)
  return rig.bones.flatMap((bone) => {
    const tf = transforms.get(bone.id)
    if (!tf) return []
    const off = rotatePoint(bone.length, 0, bone.angle + tf.rotation)
    return [{ bone, head: { x: tf.x, y: tf.y }, tail: { x: tf.x + off.x, y: tf.y + off.y } }]
  })
}

/** Chọn xương gần điểm nhấn nhất (trong bán kính maxDistance). */
export function pickSketchBone(
  rig: LayerRig | undefined,
  point: Point2D,
  time: number,
  maxDistance = 60
): { bone: LayerBone; distance: number } | null {
  if (!rig?.bones.length) return null
  let best: { bone: LayerBone; distance: number } | null = null
  for (const seg of boneSegments(rig, time)) {
    const distance = distanceToSegment(point, seg.head, seg.tail)
    if (distance <= maxDistance && (!best || distance < best.distance)) best = { bone: seg.bone, distance }
  }
  return best
}

export function createSketchAnchor(rig: LayerRig, boneId: string, time: number, start: Point2D): SketchAnchor {
  const bone = rig.bones.find((b) => b.id === boneId)
  if (!bone) throw new Error(`Không tìm thấy xương "${boneId}"`)
  const transforms = evaluateRig({ ...rig, loop: false }, time)
  const tf = transforms.get(boneId)
  if (!tf) throw new Error(`Không tính được vị trí xương "${boneId}"`)
  const parent = bone.parentId ? transforms.get(bone.parentId) : undefined
  const pivot = { x: tf.x, y: tf.y }
  // Bắt đầu quá sát khớp thì hướng chuột không ổn định → dùng hướng xương làm tham chiếu
  const refAngle = Math.hypot(start.x - pivot.x, start.y - pivot.y) < 12 ? bone.angle + tf.rotation : angleTo(pivot, start)
  return {
    boneId,
    boneName: bone.name,
    pivot,
    refAngle,
    start: { ...start },
    base: sampleBonePose({ ...rig, loop: false }, boneId, time),
    parentRotation: parent?.rotation ?? 0,
    parentScaleX: parent?.scaleX ?? 1,
    parentScaleY: parent?.scaleY ?? 1
  }
}

/** Tư thế xương khi ngọn bút ở điểm point (xoay quanh khớp, hoặc dời theo chuột trong hệ toạ độ cha). */
export function sketchPoseAt(anchor: SketchAnchor, point: Point2D, mode: MotionSketchMode, prevRotation?: number): Partial<BonePose> {
  if (mode === 'move') {
    const local = rotatePoint(point.x - anchor.start.x, point.y - anchor.start.y, -anchor.parentRotation)
    const sx = Math.abs(anchor.parentScaleX) > 1e-8 ? anchor.parentScaleX : 1
    const sy = Math.abs(anchor.parentScaleY) > 1e-8 ? anchor.parentScaleY : 1
    return { x: anchor.base.x + local.x / sx, y: anchor.base.y + local.y / sy }
  }
  const rotation = anchor.base.rotation + normalizeAngle(angleTo(anchor.pivot, point) - anchor.refAngle)
  if (prevRotation === undefined) return { rotation }
  return { rotation: prevRotation + normalizeAngle(rotation - prevRotation) }
}

type Channel = 'rotation' | 'x' | 'y'
const channelsOf = (mode: MotionSketchMode): Channel[] => (mode === 'move' ? ['x', 'y'] : ['rotation'])

/** Tiến độ [0..1] của từng mẫu: theo nhịp tay thật, hoặc chia đều theo độ dài nét vẽ. */
function progressOf(samples: SketchSample[], timing: MotionSketchTiming): number[] {
  const span = samples[samples.length - 1].t - samples[0].t
  if (timing === 'hand' && span > 0.05) return samples.map((s) => (s.t - samples[0].t) / span)
  const cum = [0]
  for (let i = 1; i < samples.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y))
  }
  const total = cum[cum.length - 1] || 1
  return cum.map((c) => c / total)
}

function sampleAt(progress: number[], values: number[], s: number): number {
  let j = 1
  while (j < progress.length - 1 && progress[j] < s) j++
  const span = progress[j] - progress[j - 1]
  const k = span > 1e-9 ? Math.min(1, Math.max(0, (s - progress[j - 1]) / span)) : 1
  return values[j - 1] + (values[j] - values[j - 1]) * k
}

/** Giữ các mốc cần thiết: bỏ mốc mà nội suy tuyến tính giữa 2 mốc kề đã đủ sát (sai số < tolerance). */
function reduceKeys(rows: number[][], from: number, to: number, tolerance: number[], keep: Set<number>): void {
  let worst = -1
  let worstErr = 0
  for (let i = from + 1; i < to; i++) {
    const k = (rows[i][0] - rows[from][0]) / (rows[to][0] - rows[from][0] || 1)
    const err = Math.max(...tolerance.map((tol, c) => Math.abs(rows[i][c + 1] - (rows[from][c + 1] + (rows[to][c + 1] - rows[from][c + 1]) * k)) / tol))
    if (err > worstErr) { worstErr = err; worst = i }
  }
  if (worst < 0 || worstErr <= 1) return
  keep.add(worst)
  reduceKeys(rows, from, worst, tolerance, keep)
  reduceKeys(rows, worst, to, tolerance, keep)
}

/** Chuỗi giá trị kênh (xoay đã "mở vòng" để quay quá 180° vẫn liền mạch, hoặc dời x/y). */
function channelValues(anchor: SketchAnchor, samples: SketchSample[], mode: MotionSketchMode): number[][] {
  const channels = channelsOf(mode)
  let prev: number | undefined
  const poses = samples.map((s) => {
    const pose = sketchPoseAt(anchor, s, mode, prev)
    prev = pose.rotation ?? prev
    return pose
  })
  return channels.map((c) => poses.map((p) => p[c] ?? anchor.base[c] ?? 0))
}

/** Mẫu hoá nét vẽ thành danh sách keyframe (đã làm mượt + rút gọn) cho xương đang neo. */
export function buildSketchKeyframes(
  anchor: SketchAnchor,
  samples: SketchSample[],
  settings: MotionSketchSettings,
  startTime: number
): KeyPatch[] {
  if (samples.length < 2) return []
  const channels = channelsOf(settings.mode)
  const progress = progressOf(samples, settings.timing)
  const values = channelValues(anchor, samples, settings.mode)
  const n = Math.max(6, Math.min(60, Math.round(settings.duration * 24)))
  const rows: number[][] = []
  for (let k = 0; k <= n; k++) {
    const s = k / n
    rows.push([s, ...values.map((v) => sampleAt(progress, v, s))])
  }
  // Làm mượt nhẹ (bỏ rung tay) nhưng giữ nguyên mốc đầu & cuối
  const smooth = rows.map((row, i) =>
    i === 0 || i === rows.length - 1 ? row : row.map((v, c) => (c === 0 ? v : (rows[i - 1][c] + 2 * v + rows[i + 1][c]) / 4))
  )
  const keep = new Set([0, smooth.length - 1])
  reduceKeys(smooth, 0, smooth.length - 1, channels.map((c) => (c === 'rotation' ? 0.75 : 1)), keep)
  const keys: KeyPatch[] = [...keep].sort((a, b) => a - b).map((i) => {
    const key: KeyPatch = { time: round(startTime + smooth[i][0] * settings.duration, 4), easing: 'smooth' }
    channels.forEach((c, ci) => { key[c] = round(smooth[i][ci + 1], 2) })
    return key
  })
  if (!settings.loopBack) return keys
  const end = startTime + settings.duration
  const back = keys.slice(0, -1).reverse().map((k) => ({ ...k, time: round(end + (end - k.time), 4) }))
  return [...keys, ...back]
}

export function sketchEndTime(startTime: number, settings: Pick<MotionSketchSettings, 'duration' | 'loopBack'>): number {
  return startTime + settings.duration * (settings.loopBack ? 2 : 1)
}

/** Đổi keyframe thành các thao tác rig: nới thời lượng clip nếu cần, xoá key cũ trong đoạn, ghi key mới. */
export function sketchToRigActions(rig: LayerRig, boneId: string, keys: KeyPatch[]): RigAction[] {
  if (!keys.length) return []
  const startTime = keys[0].time
  const endTime = keys[keys.length - 1].time
  const actions: RigAction[] = []
  if (endTime > rig.duration) actions.push({ action: 'settings', duration: Math.min(120, Math.ceil(endTime * 100) / 100) })
  const ops: AnimationAction[] = (rig.tracks[boneId] ?? [])
    .filter((k) => k.time > startTime && k.time <= endTime + 1e-4 && !keys.some((n) => sameKeyTime(n.time, k.time)))
    .map((k) => ({ action: 'delete-key' as const, boneId, time: k.time }))
  for (const key of keys) ops.push({ action: 'set-key', boneId, key })
  for (let i = 0; i < ops.length; i += 200) actions.push({ action: 'batch', operations: ops.slice(i, i + 200) })
  return actions
}

export interface MotionSketchResult {
  composite: LayerComposite
  keys: KeyPatch[]
  startTime: number
  endTime: number
}

/** Áp dụng trọn một nét vẽ vào cụm layer (một lần commit lịch sử, hỗ trợ Ctrl+Z). */
export function applyMotionSketch(
  composite: LayerComposite,
  anchor: SketchAnchor,
  samples: SketchSample[],
  settings: MotionSketchSettings,
  startTime: number
): MotionSketchResult {
  const rig = ensureRigClips(composite.rig ?? emptyRig()).rig
  const keys = buildSketchKeyframes(anchor, samples, settings, startTime)
  const next = sketchToRigActions(rig, anchor.boneId, keys).reduce((c, action) => applyRigAction(c, action), composite)
  return { composite: next, keys, startTime, endTime: keys.length ? keys[keys.length - 1].time : startTime }
}
