import { describe, it, expect } from 'vitest'
import {
  applyColorAdjustments,
  isDefaultAdjustments,
  getPresetAdjustments
} from './photoAdjustments'
import { DEFAULT_PHOTO_ADJUSTMENTS } from './types'

describe('photoAdjustments logic', () => {
  it('detects default adjustments accurately', () => {
    expect(isDefaultAdjustments(DEFAULT_PHOTO_ADJUSTMENTS)).toBe(true)
    expect(isDefaultAdjustments({ ...DEFAULT_PHOTO_ADJUSTMENTS, brightness: 10 })).toBe(false)
    expect(isDefaultAdjustments({ ...DEFAULT_PHOTO_ADJUSTMENTS, grayscale: true })).toBe(false)
  })

  it('converts to grayscale accurately', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255])
    applyColorAdjustments(data, 1, 1, {
      ...DEFAULT_PHOTO_ADJUSTMENTS,
      grayscale: true
    })
    // 255 * 0.299 = ~76
    expect(data[0]).toBe(76)
    expect(data[1]).toBe(76)
    expect(data[2]).toBe(76)
    expect(data[3]).toBe(255)
  })

  it('inverts color accurately', () => {
    const data = new Uint8ClampedArray([100, 150, 200, 255])
    applyColorAdjustments(data, 1, 1, {
      ...DEFAULT_PHOTO_ADJUSTMENTS,
      invert: true
    })
    expect(data[0]).toBe(155)
    expect(data[1]).toBe(105)
    expect(data[2]).toBe(55)
    expect(data[3]).toBe(255)
  })

  it('adjusts brightness and contrast smoothly without overflowing', () => {
    const data = new Uint8ClampedArray([120, 120, 120, 255, 0, 0, 0, 255])
    applyColorAdjustments(data, 2, 1, {
      ...DEFAULT_PHOTO_ADJUSTMENTS,
      brightness: 20,
      contrast: 25
    })
    expect(data[0]).toBeGreaterThan(120)
    expect(data[4]).toBeGreaterThanOrEqual(0)
    expect(data[4]).toBeLessThanOrEqual(255)
  })

  it('provides sensible preset adjustments', () => {
    const vivid = getPresetAdjustments('vivid')
    expect(vivid.saturation).toBeGreaterThan(0)
    expect(vivid.contrast).toBeGreaterThan(0)

    const bw = getPresetAdjustments('bw')
    expect(bw.grayscale).toBe(true)

    const cool = getPresetAdjustments('cinematic_cool')
    expect(cool.warmth).toBeLessThan(0)
  })
})
