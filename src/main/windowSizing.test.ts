import { describe, expect, it } from 'vitest'
import { initialWindowSize } from './windowSizing'

describe('window size at startup', () => {
  it('fits a scaled laptop work area without extending behind the taskbar', () => {
    expect(initialWindowSize({ width: 1280, height: 680 })).toEqual({
      width: 1280, height: 680, minWidth: 640, minHeight: 480
    })
  })
  it('caps startup size on a large screen', () => {
    expect(initialWindowSize({ width: 3840, height: 2120 })).toEqual({
      width: 1600, height: 960, minWidth: 640, minHeight: 480
    })
  })
  it('never asks for a minimum larger than a very small display', () => {
    expect(initialWindowSize({ width: 600, height: 440 })).toEqual({
      width: 600, height: 440, minWidth: 600, minHeight: 440
    })
  })
})
