import type { BonePose, LayerBone, LayerRig } from '@shared/layerRig'
import { evaluateRig, rotatePoint, sampleBonePose } from '../../engine/layerRig'
import type { LayerComposite } from './types'
import { applyRigAction, emptyRig, ensureRigClips, type RigAction } from './workshopRig'
import { sameKeyTime, type AnimationAction, type KeyPatch } from './workshopAnimation'
import { buildIkChain, ikRotations, solveCcd, type IkChain } from './workshopIk'

/**
 * Vẽ động tác (Motion Sketch / Performance capture) — tab Animation:
 * nhấn gần một xương rồi vẽ đường đi của ngọn xương; nét vẽ được lấy mẫu theo thời gian thực,
 * theo nhịp tay hoặc chia đều, rồi ghi thành keyframe xoay/dời cho xương đó — hoặc cho cả chuỗi xương (IK).
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
/** live = đúng thời gian thật lúc vẽ (playhead chạy theo) · hand = nhịp tay co giãn vào duration · even = rải đều. */
export type MotionSketchTiming = 'live' | 'hand' | 'even'

export interface MotionSketchSettings {
  mode: MotionSketchMode
  timing: MotionSketchTiming
  /** Thời lượng động tác (giây) cho nhịp hand/even. Nhịp live dùng đúng thời gian vẽ. */
  duration: number
  /** Khứ hồi: đi hết nét vẽ rồi quay ngược về tư thế ban đầu. */
  loopBack: boolean
  /** Tự phát thử ngay sau khi thả chuột. */
  autoPlay: boolean
  /** Số xương trong chuỗi IK khi xoay (1 = chỉ xương được chọn). */
  chain: number
}

export const DEFAULT_SKETCH_SETTINGS: MotionSketchSettings = {
  mode: 'rotate',
  timing: 'live',
  duration: 1,
  loopBack: false,
  autoPlay: true,
  chain: 2
}

export const SKETCH_MAX_DURATION = 20

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
  /** Chuỗi IK (≥ 2 xương): ngọn chuỗi bám theo bút, các xương cha tự xoay. */
  ik?: { chain: IkChain; offset: Point2D }
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

export function createSketchAnchor(rig: LayerRig, boneId: string, time: number, start: Point2D, chainLength = 1): SketchAnchor {
  const bone = rig.bones.find((b) => b.id === boneId)
  if (!bone) throw new Error(`Không tìm thấy xương "${boneId}"`)
  const transforms = evaluateRig({ ...rig, loop: false }, time)
  const tf = transforms.get(boneId)
  if (!tf) throw new Error(`Không tính được vị trí xương "${boneId}"`)
  const parent = bone.parentId ? transforms.get(bone.parentId) : undefined
  const pivot = { x: tf.x, y: tf.y }
  // Bắt đầu quá sát khớp thì hướng chuột không ổn định → dùng hướng xương làm tham chiếu
  const refAngle = Math.hypot(start.x - pivot.x, start.y - pivot.y) < 12 ? bone.angle + tf.rotation : angleTo(pivot, start)
  const anchor: SketchAnchor = {
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
  if (chainLength > 1 && bone.parentId) {
    const chain = buildIkChain(rig, boneId, chainLength, time)
    const tip = chain.points[chain.points.length - 1]
    if (chain.boneIds.length > 1) anchor.ik = { chain, offset: { x: tip.x - start.x, y: tip.y - start.y } }
  }
  return anchor
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
interface SketchColumn { boneId: string; channel: Channel }

/** Trạng thái giải liên tục giữa các mẫu (góc đã mở vòng / nghiệm IK trước). */
export interface SketchSolveState { rotation?: number; deltas?: number[] }

/** Các giá trị kênh (theo cột) khi ngọn bút ở point — dùng cho cả xem trước trực tiếp lẫn ghi keyframe. */
export function sketchValuesAt(anchor: SketchAnchor, point: Point2D, mode: MotionSketchMode, state: SketchSolveState): { columns: SketchColumn[]; values: number[] } {
  if (mode === 'rotate' && anchor.ik) {
    const { chain, offset } = anchor.ik
    state.deltas = solveCcd(chain, { x: point.x + offset.x, y: point.y + offset.y }, state.deltas)
    const rots = ikRotations(chain, state.deltas)
    return { columns: rots.map((r) => ({ boneId: r.boneId, channel: 'rotation' as const })), values: rots.map((r) => r.rotation) }
  }
  const pose = sketchPoseAt(anchor, point, mode, state.rotation)
  if (mode === 'move') return { columns: [{ boneId: anchor.boneId, channel: 'x' }, { boneId: anchor.boneId, channel: 'y' }], values: [pose.x ?? 0, pose.y ?? 0] }
  state.rotation = pose.rotation
  return { columns: [{ boneId: anchor.boneId, channel: 'rotation' }], values: [pose.rotation ?? anchor.base.rotation] }
}

/** Đổi giá trị kênh thành thao tác set-key (xem trước trực tiếp tại thời điểm time). */
export function sketchPreviewOps(columns: SketchColumn[], values: number[], time: number): AnimationAction[] {
  const byBone = new Map<string, KeyPatch>()
  columns.forEach((c, i) => {
    const key = byBone.get(c.boneId) ?? { time }
    key[c.channel] = values[i]
    byBone.set(c.boneId, key)
  })
  return [...byBone].map(([boneId, key]) => ({ action: 'set-key' as const, boneId, key }))
}

/** Tiến độ [0..1] của từng mẫu: theo nhịp tay thật, hoặc chia đều theo độ dài nét vẽ. */
function progressOf(samples: SketchSample[], timing: MotionSketchTiming): number[] {
  const span = samples[samples.length - 1].t - samples[0].t
  if (timing !== 'even' && span > 0.05) return samples.map((s) => (s.t - samples[0].t) / span)
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
export function reduceKeys(rows: number[][], from: number, to: number, tolerance: number[], keep: Set<number>): void {
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

/** Thời lượng thực của động tác: nhịp live dùng đúng thời gian vẽ. */
export function sketchDuration(samples: SketchSample[], settings: Pick<MotionSketchSettings, 'timing' | 'duration'>): number {
  if (settings.timing !== 'live' || samples.length < 2) return settings.duration
  const span = samples[samples.length - 1].t - samples[0].t
  return Math.min(SKETCH_MAX_DURATION, Math.max(0.2, round(span, 3)))
}

/** Mẫu hoá nét vẽ thành keyframe (đã làm mượt + rút gọn) cho từng xương bị ảnh hưởng. */
export function buildSketchTracks(
  anchor: SketchAnchor,
  samples: SketchSample[],
  settings: MotionSketchSettings,
  startTime: number
): Record<string, KeyPatch[]> {
  if (samples.length < 2) return {}
  const state: SketchSolveState = {}
  let columns: SketchColumn[] = []
  const perSample = samples.map((s) => {
    const r = sketchValuesAt(anchor, s, settings.mode, state)
    columns = r.columns
    return r.values
  })
  const duration = sketchDuration(samples, settings)
  const progress = progressOf(samples, settings.timing)
  const n = Math.max(6, Math.min(240, Math.round(duration * 24)))
  const rows: number[][] = []
  for (let k = 0; k <= n; k++) {
    const s = k / n
    rows.push([s, ...columns.map((_, c) => sampleAt(progress, perSample.map((v) => v[c]), s))])
  }
  // Làm mượt nhẹ (bỏ rung tay) nhưng giữ nguyên mốc đầu & cuối
  const smooth = rows.map((row, i) =>
    i === 0 || i === rows.length - 1 ? row : row.map((v, c) => (c === 0 ? v : (rows[i - 1][c] + 2 * v + rows[i + 1][c]) / 4))
  )
  const keep = new Set([0, smooth.length - 1])
  reduceKeys(smooth, 0, smooth.length - 1, columns.map((c) => (c.channel === 'rotation' ? 0.75 : 1)), keep)
  const order = [...keep].sort((a, b) => a - b)
  const tracks: Record<string, KeyPatch[]> = {}
  for (const i of order) {
    const time = round(startTime + smooth[i][0] * duration, 4)
    columns.forEach((c, ci) => {
      const list = (tracks[c.boneId] ??= [])
      let key = list.find((k) => k.time === time)
      if (!key) { key = { time, easing: 'smooth' }; list.push(key) }
      key[c.channel] = round(smooth[i][ci + 1], 2)
    })
  }
  if (!settings.loopBack) return tracks
  const end = startTime + duration
  for (const [boneId, keys] of Object.entries(tracks)) {
    const back = keys.slice(0, -1).reverse().map((k) => ({ ...k, time: round(end + (end - k.time), 4) }))
    tracks[boneId] = [...keys, ...back]
  }
  return tracks
}

/** Keyframe của riêng xương neo (tương thích API cũ). */
export function buildSketchKeyframes(anchor: SketchAnchor, samples: SketchSample[], settings: MotionSketchSettings, startTime: number): KeyPatch[] {
  return buildSketchTracks(anchor, samples, settings, startTime)[anchor.boneId] ?? []
}

export function sketchEndTime(startTime: number, settings: Pick<MotionSketchSettings, 'duration' | 'loopBack'>): number {
  return startTime + settings.duration * (settings.loopBack ? 2 : 1)
}

/** Đổi keyframe thành các thao tác rig: nới thời lượng clip nếu cần, xoá key cũ trong đoạn, ghi key mới. */
export function sketchToRigActions(rig: LayerRig, tracks: Record<string, KeyPatch[]>): RigAction[] {
  const all = Object.values(tracks).flat()
  if (!all.length) return []
  const endTime = Math.max(...all.map((k) => k.time))
  const actions: RigAction[] = []
  if (endTime > rig.duration) actions.push({ action: 'settings', duration: Math.min(120, Math.ceil(endTime * 100) / 100) })
  const ops: AnimationAction[] = []
  for (const [boneId, keys] of Object.entries(tracks)) {
    if (!keys.length) continue
    const from = keys[0].time
    const to = keys[keys.length - 1].time
    for (const k of rig.tracks[boneId] ?? []) {
      if (k.time > from && k.time <= to + 1e-4 && !keys.some((n) => sameKeyTime(n.time, k.time))) ops.push({ action: 'delete-key', boneId, time: k.time })
    }
    for (const key of keys) ops.push({ action: 'set-key', boneId, key })
  }
  for (let i = 0; i < ops.length; i += 200) actions.push({ action: 'batch', operations: ops.slice(i, i + 200) })
  return actions
}

export interface MotionSketchResult {
  composite: LayerComposite
  /** Keyframe của xương neo. */
  keys: KeyPatch[]
  /** Keyframe theo từng xương (nhiều xương khi dùng chuỗi IK). */
  tracks: Record<string, KeyPatch[]>
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
  const tracks = buildSketchTracks(anchor, samples, settings, startTime)
  const next = sketchToRigActions(rig, tracks).reduce((c, action) => applyRigAction(c, action), composite)
  const times = Object.values(tracks).flat().map((k) => k.time)
  return { composite: next, keys: tracks[anchor.boneId] ?? [], tracks, startTime, endTime: times.length ? Math.max(...times) : startTime }
}
