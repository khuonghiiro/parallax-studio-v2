import type { Animatable, AnimValue } from '@shared/types'
import { addKeyframe, evaluate, keyAt } from './keyframes'

/** Start a new interval after existing animation; keep the preceding pose held. */
export function startTimelineRange(a: Animatable<AnimValue>, time: number, tolerance: number) {
  const existing = keyAt(a, time, tolerance)
  if (existing) {
    preserveTimelinePast(a, time, tolerance)
    existing.ease = 'easeInOut'
    return existing
  }
  const last = a.keyframes.at(-1)
  if (last && time <= last.t) throw new Error('Đặt đầu phát sau mốc cuối để thêm đoạn mới')
  const value = evaluate(a, time)
  if (!last && time > tolerance) addKeyframe(a, 0, a.value, 'hold')
  if (last) last.ease = 'hold'
  return addKeyframe(a, time, value, 'easeInOut', tolerance)
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
  return addKeyframe(a, time, evaluate(a, time), 'hold', tolerance)
}

export function timelineRangeAt(a: Animatable<AnimValue>, time: number) {
  const starts = a.keyframes.filter((k, i, keys) => k.ease !== 'hold' &&
    (i < keys.length - 1 || i === 0 || keys[i - 1].ease === 'hold'))
  const start = starts.filter(k => k.t <= time + 1e-4).at(-1) ?? starts[0]
  const end = start ? a.keyframes[a.keyframes.indexOf(start) + 1] : undefined
  return { start, end }
}

/** Legacy single keys must not recolor the whole past when revisited. */
export function preserveTimelinePast(a: Animatable<AnimValue>, time: number, tolerance: number) {
  const first = a.keyframes[0]
  if (first && first.t > tolerance && Math.abs(time - first.t) <= tolerance) {
    addKeyframe(a, 0, first.value, 'hold', tolerance)
  }
}
