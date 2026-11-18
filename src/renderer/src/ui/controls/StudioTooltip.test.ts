import { describe, expect, it } from 'vitest'
import { computeStudioTooltipPosition } from './StudioTooltip'

describe('computeStudioTooltipPosition (<StudioTooltip>)', () => {
  it('places tooltip to the right for left-rail buttons like BuiltInAssetBar', () => {
    const pos = computeStudioTooltipPosition(
      { left: 8, top: 200, right: 40, bottom: 232, width: 32, height: 32 },
      { width: 190, height: 58 },
      { width: 1920, height: 1009 },
      'right'
    )
    expect(pos.effectiveSide).toBe('right')
    expect(pos.left).toBe(48)
    expect(pos.top).toBe(187)
  })

  it('flips right -> left automatically when near the right viewport edge', () => {
    const pos = computeStudioTooltipPosition(
      { left: 1880, top: 240, right: 1912, bottom: 272, width: 32, height: 32 },
      { width: 200, height: 60 },
      { width: 1920, height: 1009 },
      'right'
    )
    expect(pos.effectiveSide).toBe('left')
    expect(pos.left).toBe(1672)
  })

  it('places tooltip cleanly above bottom floating HUD bars and clamps horizontal bounds', () => {
    const pos = computeStudioTooltipPosition(
      { left: 10, top: 960, right: 42, bottom: 992, width: 32, height: 32 },
      { width: 210, height: 64 },
      { width: 1920, height: 1009 },
      'top'
    )
    expect(pos.effectiveSide).toBe('top')
    expect(pos.left).toBe(8)
    expect(pos.top).toBe(888)
    expect(pos.caretOffsetPx).toBeGreaterThanOrEqual(12)
  })
})
