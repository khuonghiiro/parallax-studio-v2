import { describe, expect, it } from 'vitest'
import { getAnimatedGifFrameIndex } from './gifHelper'
import type { AnimatedGifData } from './assets'

describe('getAnimatedGifFrameIndex', () => {
  const dummyGif: AnimatedGifData = {
    totalDuration: 0.3,
    width: 100,
    height: 100,
    frames: [
      { index: 0, startTime: 0.0, duration: 0.1, bitmap: null as unknown as ImageBitmap },
      { index: 1, startTime: 0.1, duration: 0.1, bitmap: null as unknown as ImageBitmap },
      { index: 2, startTime: 0.2, duration: 0.1, bitmap: null as unknown as ImageBitmap }
    ]
  }

  it('selects correct frame in normal loop mode', () => {
    expect(getAnimatedGifFrameIndex(dummyGif, 0.0)).toBe(0)
    expect(getAnimatedGifFrameIndex(dummyGif, 0.05)).toBe(0)
    expect(getAnimatedGifFrameIndex(dummyGif, 0.1)).toBe(1)
    expect(getAnimatedGifFrameIndex(dummyGif, 0.15)).toBe(1)
    expect(getAnimatedGifFrameIndex(dummyGif, 0.2)).toBe(2)
    expect(getAnimatedGifFrameIndex(dummyGif, 0.29)).toBe(2)

    // Second cycle
    expect(getAnimatedGifFrameIndex(dummyGif, 0.3)).toBe(0)
    expect(getAnimatedGifFrameIndex(dummyGif, 0.45)).toBe(1)
    expect(getAnimatedGifFrameIndex(dummyGif, 0.55)).toBe(2)
  })

  it('handles speed multiplier', () => {
    // 2x speed: 0.05s becomes 0.10s (frame 1)
    expect(getAnimatedGifFrameIndex(dummyGif, 0.05, { speed: 2 })).toBe(1)
    // 0.5x speed: 0.20s becomes 0.10s (frame 1)
    expect(getAnimatedGifFrameIndex(dummyGif, 0.20, { speed: 0.5 })).toBe(1)
  })

  it('handles timeOffset', () => {
    // Offset by +0.1s: at t=0s it displays frame 1
    expect(getAnimatedGifFrameIndex(dummyGif, 0.0, { timeOffset: 0.1 })).toBe(1)
    // At t=0.1s with offset +0.1s (total 0.2s) displays frame 2
    expect(getAnimatedGifFrameIndex(dummyGif, 0.1, { timeOffset: 0.1 })).toBe(2)
  })

  it('handles ping-pong mode', () => {
    // Total cycle is 0.6s (forward 0.0-0.3s, backward 0.3-0.6s)
    expect(getAnimatedGifFrameIndex(dummyGif, 0.15, { loopMode: 'ping-pong' })).toBe(1)
    expect(getAnimatedGifFrameIndex(dummyGif, 0.25, { loopMode: 'ping-pong' })).toBe(2)
    // At 0.35s in cycle: rem = 0.35 => frameT = 0.6 - 0.35 = 0.25s (frame 2)
    expect(getAnimatedGifFrameIndex(dummyGif, 0.35, { loopMode: 'ping-pong' })).toBe(2)
    // At 0.45s in cycle: rem = 0.45 => frameT = 0.6 - 0.45 = 0.15s (frame 1)
    expect(getAnimatedGifFrameIndex(dummyGif, 0.45, { loopMode: 'ping-pong' })).toBe(1)
  })

  it('handles once mode', () => {
    expect(getAnimatedGifFrameIndex(dummyGif, 0.1, { loopMode: 'once' })).toBe(1)
    // Past totalDuration: stays on last frame
    expect(getAnimatedGifFrameIndex(dummyGif, 1.5, { loopMode: 'once' })).toBe(2)
  })
})
