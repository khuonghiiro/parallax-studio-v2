import type { Animatable, AnimValue } from '@shared/types'
import { addKeyframe, evaluate, keyAt, setValueAt } from './keyframes'

/** Start a new interval after existing animation; keep the preceding pose held. */
export function startTimelineRange(a: Animatable<AnimValue>, time: number, tolerance: number) {
  const existing = keyAt(a, time, tolerance)
  if (existing) {
    preserveTimelinePast(a, time, tolerance)
    existing.ease = 'easeInOut'
    existing.timelineBoundary = 'start'
    return existing
  }
  const last = a.keyframes.at(-1)
  if (last && time <= last.t) throw new Error('Đặt đầu phát sau mốc cuối để thêm đoạn mới')
  const value = evaluate(a, time)
  if (!last && time > tolerance) addKeyframe(a, 0, a.value, 'hold')
  if (last) last.ease = 'hold'
  const key = addKeyframe(a, time, value, 'easeInOut', tolerance)
  key.timelineBoundary = 'start'
  return key
}

export function endTimelineRange(a: Animatable<AnimValue>, time: number, tolerance: number) {
  const existing = keyAt(a, time, tolerance)
  if (existing) {
    const { start } = timelineRangeAt(a, time)
    if (!start || existing.t <= start.t + tolerance) throw new Error('Mốc cuối phải nằm sau mốc đầu')
    return existing
  }
  const last = a.keyframes.at(-1)
  if (!last || time <= last.t + tolerance) throw new Error('Mốc cuối phải nằm sau mốc đầu')
  const key = addKeyframe(a, time, evaluate(a, time), 'hold', tolerance)
  key.timelineBoundary = 'end'
  return key
}

export function timelineRangeAt(a: Animatable<AnimValue>, time: number) {
  const starts = a.keyframes.filter((k, i, keys) => k.timelineBoundary === 'start' ||
    (!k.timelineBoundary && k.ease !== 'hold' &&
    (i < keys.length - 1 || i === 0 || keys[i - 1].ease === 'hold')))
  const start = starts.filter(k => k.t <= time + 1e-4).at(-1) ?? starts[0]
  const end = start ? a.keyframes[a.keyframes.indexOf(start) + 1] : undefined
  return { start, end }
}

/** The outgoing segment at a key; the final key edits its incoming segment. */
export function timelineSegmentAt(a: Animatable<AnimValue>, time: number) {
  const keys = a.keyframes
  if (!keys.length) return { start: undefined, end: undefined }
  const index = keys.filter(k => k.t <= time + 1e-4).length - 1
  if (index === keys.length - 1 && keys[index].timelineBoundary === 'start') {
    return { start: keys[index], end: undefined }
  }
  const startIndex = Math.max(0, Math.min(index, keys.length - 2))
  return { start: keys[startIndex], end: keys[startIndex + 1] }
}

/** Inserting a value must inherit interpolation instead of silently introducing Hold. */
export function setTimelineValueAt(a: Animatable<AnimValue>, time: number, value: AnimValue, tolerance: number) {
  preserveTimelinePast(a, time, tolerance)
  if (!a.keyframes.length || keyAt(a, time, tolerance)) {
    setValueAt(a, time, value, tolerance)
    return
  }
  const previous = a.keyframes.filter(k => k.t < time).at(-1)
  addKeyframe(a, time, value, previous?.ease ?? 'easeInOut', tolerance)
}

/** Legacy single keys must not recolor the whole past when revisited. */
export function preserveTimelinePast(a: Animatable<AnimValue>, time: number, tolerance: number) {
  const first = a.keyframes[0]
  if (first && first.t > tolerance && Math.abs(time - first.t) <= tolerance) {
    addKeyframe(a, 0, first.value, 'hold', tolerance)
  }
}
