import { describe, expect, it } from 'vitest'
import { clampTimelineHeight, timelineBounds } from './timelineSizing'

describe('responsive timeline height', () => {
  it.each([480, 600, 768, 900, 1080, 1440, 2160])('keeps room for the viewer at %ipx height', (height) => {
    expect(clampTimelineHeight(2000, height)).toBeLessThanOrEqual(height * 0.45)
    expect(clampTimelineHeight(-100, height)).toBe(160)
  })
  it('keeps bounds ordered even with a very short viewport', () => {
    expect(timelineBounds(240)).toEqual({ min: 108, max: 108 })
    expect(clampTimelineHeight(300, 240)).toBe(108)
  })
  it('preserves an in-range manual height and clamps it after shrinking', () => {
    expect(clampTimelineHeight(400, 1080)).toBe(400)
    expect(clampTimelineHeight(400, 600)).toBe(270)
  })
})
