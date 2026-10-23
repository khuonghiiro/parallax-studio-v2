import { describe, it, expect } from 'vitest'
import { anim, evaluate, setValueAt } from './keyframes'
import { startTimelineRange, endTimelineRange, timelineRangeAt, preserveTimelinePast } from './timelineRange'
import { addKeyframe } from './keyframes'

describe('timeline interval editing', () => {
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
