import { describe, it, expect } from 'vitest'
import { computeTaggedLayout, VIEW_ORDER, selectedViews } from './taggedLayout'

describe('independent viewport tags', () => {
  it('migrates the old camera stage split', () => {
    expect(selectedViews({ primary: 'animate2d', split: false, animate2dSplit: true })).toEqual(['camera', 'editor', 'animate2d'])
  })
  it('places depth below camera drafting in a shared column', () => {
    for (const views of [['animate2d', 'topview'], VIEW_ORDER] as const) {
      const layout = computeTaggedLayout(1000, 700, 16 / 9, [...views])
      expect(layout.depth!.x).toBe(layout.stage2d!.x)
      expect(layout.depth!.y).toBeGreaterThan(layout.stage2d!.y)
      expect(layout.depth!.h).toBe(layout.stage2d!.h)
    }
  })
  it('keeps every enabled pane visible and non-overlapping for all 15 combinations', () => {
    for (const width of [400, 1000]) for (let mask = 1; mask < 16; mask++) {
      const views = VIEW_ORDER.filter((_, i) => mask & (1 << i))
      const layout = computeTaggedLayout(width, 700, 16 / 9, views)
      const panes = [layout.cam, layout.ed, layout.stage2d, layout.depth].filter((p) => p != null)
      expect(panes).toHaveLength(views.length)
      for (const [i, a] of panes.entries()) {
        expect(a.x).toBeGreaterThanOrEqual(0)
        expect(a.y).toBeGreaterThanOrEqual(34)
        expect(a.x + a.w).toBeLessThanOrEqual(width)
        expect(a.y + a.h).toBeLessThanOrEqual(700)
        for (const b of panes.slice(i + 1)) expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true)
      }
    }
  })
})
