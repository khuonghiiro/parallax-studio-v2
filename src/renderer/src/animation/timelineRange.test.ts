import { describe, it, expect } from 'vitest'
import { anim, evaluate, setValueAt } from './keyframes'
import { startTimelineRange, endTimelineRange, timelineRangeAt, preserveTimelinePast, setTimelineValueAt, timelineSegmentAt } from './timelineRange'
import { addKeyframe } from './keyframes'

describe('timeline interval editing', () => {
  it('keeps hold boundaries identifiable and jumps exactly at the end', () => {
    const a = anim(0)
    const start = startTimelineRange(a, 2, .01)
    start.value = 20
    start.ease = 'hold'
    const end = endTimelineRange(a, 6, .01)
    end.value = 100
    expect(timelineRangeAt(a, 4)).toEqual({ start, end })
    expect(evaluate(a, 5.99)).toBe(20)
    expect(evaluate(a, 6)).toBe(100)
    expect(evaluate(a, 9)).toBe(100)
    expect(timelineSegmentAt(a, 6)).toEqual({ start, end })
  })
  it.each(['linear', 'easeInOut', 'hold'] as const)('inherits %s when editing between keys', ease => {
    const a = anim(0)
    addKeyframe(a, 0, 0, ease)
    addKeyframe(a, 4, 100, 'hold')
    setTimelineValueAt(a, 2, 40, .01)
    expect(a.keyframes[1].ease).toBe(ease)
    expect(evaluate(a, 3)).toBeCloseTo(ease === 'hold' ? 40 : 70)
  })
  it('pulses three times within the segment and settles at the authored destination', () => {
    const a = anim(0)
    addKeyframe(a, 2, 0, 'pulse')
    addKeyframe(a, 7, 100, 'hold')
    expect([2, 3, 4, 5, 6, 7, 8].map(t => Math.round(evaluate(a, t))))
      .toEqual([0, 100, 0, 100, 0, 100, 100])
    expect(evaluate(a, 2.5)).toBeCloseTo(50)
  })
  it('protects past values when revisiting an old single key', () => {
    const a = anim(1)
    addKeyframe(a, 3, .6)
    preserveTimelinePast(a, 3, .01)
    setValueAt(a, 3, .2, .01)
    expect(evaluate(a, 2)).toBe(.6)
    expect(evaluate(a, 3)).toBe(.2)
  })
  it('keeps the past pose when the first start key is edited', () => {
    const a = anim(0)
    startTimelineRange(a, 3, .01)
    setValueAt(a, 3, 20, .01)
    expect(evaluate(a, 0)).toBe(0)
    expect(evaluate(a, 2.9)).toBe(0)
    endTimelineRange(a, 5, .01)
    setValueAt(a, 5, 90, .01)
    expect(evaluate(a, 3)).toBe(20)
    expect(evaluate(a, 4)).toBeGreaterThan(20)
    expect(evaluate(a, 5)).toBe(90)
    expect(evaluate(a, 8)).toBe(90)
  })
  it('revisits a boundary without deleting it and appends independent intervals', () => {
    const a = anim(0)
    const first = startTimelineRange(a, 2, .01)
    expect(startTimelineRange(a, 2, .01).id).toBe(first.id)
    endTimelineRange(a, 4, .01)
    setValueAt(a, 4, 60, .01)
    startTimelineRange(a, 6, .01)
    endTimelineRange(a, 8, .01)
    setValueAt(a, 8, 120, .01)
    expect(evaluate(a, 5)).toBe(60)
    expect(timelineRangeAt(a, 3).start?.t).toBe(2)
    expect(timelineRangeAt(a, 7).end?.t).toBe(8)
    expect(() => startTimelineRange(a, 5, .01)).toThrow()
  })
  it('requires an end later than its start', () => {
    const a = anim(1)
    expect(() => endTimelineRange(a, 2, .01)).toThrow()
    startTimelineRange(a, 3, .01)
    expect(() => endTimelineRange(a, 2, .01)).toThrow()
    expect(() => endTimelineRange(a, 3, .01)).toThrow()
  })
})
