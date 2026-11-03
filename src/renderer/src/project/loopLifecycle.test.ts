import { describe, expect, it } from 'vitest'
import { getAnimatedGifFrameIndex } from './gifHelper'
import type { AnimatedGifData } from './assets'
import {
  evaluateLoopLifecycle,
  hasLoopLifecycle,
  resolveLoopClockAnchor,
  resolveLoopEndTime,
  resolveLoopPlayCount
} from './loopLifecycle'

// 4 khung × 0.25s = chu kỳ 1s
const gif = {
  frames: [0, 1, 2, 3].map((i) => ({ index: i, duration: 0.25, startTime: i * 0.25, bitmap: {} as ImageBitmap })),
  totalDuration: 1,
  width: 8,
  height: 8
} as AnimatedGifData

describe('Loop lifecycle (vòng đời Loop Animate)', () => {
  it('clamps play count and anchors the once-clock at the layer in-point', () => {
    expect(resolveLoopPlayCount({ loopPlayCount: 0 })).toBe(1)
    expect(resolveLoopPlayCount({ loopPlayCount: 99 })).toBe(20)
    expect(resolveLoopClockAnchor({ loopMode: 'once' }, 3)).toBe(3)
    expect(resolveLoopClockAnchor({ loopMode: 'loop' }, 3)).toBe(0)
    expect(resolveLoopClockAnchor({ loopMode: 'loop', loopStartTime: 2 }, 3)).toBe(2)
  })

  it('plays `once` N cycles from its anchor then holds the last frame', () => {
    const props = { loopMode: 'once' as const, loopPlayCount: 2 }
    expect(getAnimatedGifFrameIndex(gif, 2.1, props, 2)).toBe(0)
    expect(getAnimatedGifFrameIndex(gif, 3.6, props, 2)).toBe(2) // vòng 2
    expect(getAnimatedGifFrameIndex(gif, 9, props, 2)).toBe(3) // hết 2 vòng → giữ khung cuối
  })

  it('computes the end time from play count / speed or from the node end time', () => {
    expect(resolveLoopEndTime({ loopMode: 'once', loopPlayCount: 3, speed: 2, loopStartTime: 1 }, 0, 1)).toBeCloseTo(2.5)
    expect(resolveLoopEndTime({ loopMode: 'loop', loopStartTime: 1, loopEndTime: 4 }, 0, 1)).toBe(4)
    expect(resolveLoopEndTime({ loopMode: 'loop' }, 0, 1)).toBeUndefined()
  })

  it('fades in from transparent and hides / fades out at the end', () => {
    const fadeIn = { loopMode: 'loop' as const, loopStartTime: 1, loopFadeInSec: 1 }
    expect(hasLoopLifecycle(fadeIn)).toBe(true)
    expect(evaluateLoopLifecycle(fadeIn, 0.5, 0, 1)).toBe(0)
    expect(evaluateLoopLifecycle(fadeIn, 1.5, 0, 1)).toBeCloseTo(0.5)
    expect(evaluateLoopLifecycle(fadeIn, 3, 0, 1)).toBe(1)

    const hide = { loopMode: 'once' as const, loopStartTime: 0, loopEndAction: 'hide' as const }
    expect(evaluateLoopLifecycle(hide, 0.9, 0, 1)).toBe(1)
    expect(evaluateLoopLifecycle(hide, 1.01, 0, 1)).toBe(0)

    const fade = { loopMode: 'loop' as const, loopStartTime: 0, loopEndTime: 4, loopEndAction: 'fade_out' as const, loopFadeOutSec: 1 }
    expect(evaluateLoopLifecycle(fade, 2, 0, 1)).toBe(1)
    expect(evaluateLoopLifecycle(fade, 3.5, 0, 1)).toBeCloseTo(0.5)
    expect(evaluateLoopLifecycle(fade, 4, 0, 1)).toBe(0)
  })

  it('keeps old layers untouched when no lifecycle is configured', () => {
    expect(hasLoopLifecycle({ loopMode: 'once' })).toBe(false)
    expect(evaluateLoopLifecycle({ loopMode: 'once' }, 99, 0, 1)).toBe(1)
  })
})
