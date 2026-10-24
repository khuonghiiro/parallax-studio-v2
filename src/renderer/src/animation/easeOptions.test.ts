import { describe, it, expect } from 'vitest'
import { ease } from './easing'
import { anim, addKeyframe, evaluate } from './keyframes'
import { parseEaseOptions } from './easeOptions'
import { setTimelineValueAt } from './timelineRange'

describe('configurable timeline interpolation', () => {
  it('changes pulse count and preserves endpoints', () => {
    expect(ease('pulse', 1 / 3, { cycles: 2 })).toBeCloseTo(1)
    expect(ease('pulse', 1 / 3, { cycles: 3 })).toBeCloseTo(.25)
    for (const mode of ['pulse', 'blink', 'hold', 'easeInOut'] as const) {
      expect(ease(mode, 0, { cycles: 8 })).toBe(0)
      expect(ease(mode, 1, { cycles: 8 })).toBe(1)
    }
  })
  it('supports blink duty, hold timing and smooth strength', () => {
    expect(ease('blink', .15, { cycles: 2, duty: .2 })).toBe(1)
    expect(ease('blink', .15, { cycles: 2, duty: .8 })).toBe(0)
    expect(ease('hold', .4, { holdUntil: .5 })).toBe(0)
    expect(ease('hold', .6, { holdUntil: .5 })).toBe(1)
    expect(ease('easeInOut', .2, { strength: 0 })).toBe(.2)
    expect(ease('easeInOut', .2, { strength: 1 })).toBeLessThan(.2)
  })
  it('persists options and inherits them on inserted keys', () => {
    const a = anim(0)
    addKeyframe(a, 0, 0, 'pulse').easeOptions = { cycles: 2 }
    addKeyframe(a, 3, 100)
    const restored = JSON.parse(JSON.stringify(a))
    expect(evaluate(restored, 1)).toBeCloseTo(100)
    setTimelineValueAt(a, 1.5, 50, .001)
    expect(a.keyframes[1].easeOptions).toEqual({ cycles: 2 })
  })
  it('rejects invalid numbers instead of saving corrupt interpolation', () => {
    for (const value of [{ cycles: 0 }, { cycles: 2.5 }, { cycles: Infinity }, { duty: 1 }, { strength: -1 }, null]) {
      expect(() => parseEaseOptions(value)).toThrow()
    }
  })
})
