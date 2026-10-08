import { describe, expect, it } from 'vitest'
import type { AssetMeta } from '@shared/types'
import { probeImageSize, probeIsAnimatedGif, AnimatedGifData } from './assets'
import { createProject, createShot, createImageLayer } from './factory'
import { evaluateScene } from '../engine/evaluateScene'
import { getAnimatedGifFrameIndex } from './gifHelper'

/** Dựng GIF89a tối giản trong bộ nhớ (120×120, `frames` khung) để kiểm thử probe mà không cần file mẫu. */
function buildGif(frames: number): Uint8Array {
  const bytes: number[] = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] // "GIF89a"
  bytes.push(120, 0, 120, 0, 0x80, 0, 0) // Logical screen 120×120 + bảng màu toàn cục 2 màu
  bytes.push(0, 0, 0, 255, 255, 255)
  for (let i = 0; i < frames; i++) {
    bytes.push(0x21, 0xf9, 0x04, 0x00, 0x04, 0x00, 0x00, 0x00) // Graphic Control Extension (delay 40ms)
    bytes.push(0x2c, 0, 0, 0, 0, 120, 0, 120, 0, 0x00) // Image descriptor
    bytes.push(0x02, 0x02, 0x4c, 0x01, 0x00) // LZW min code + 1 sub-block + terminator
  }
  bytes.push(0x3b)
  return new Uint8Array(bytes)
}

describe('Animated GIF in Scene Integration Test', () => {
  const uint8Array = buildGif(15)

  it('correctly probes dimensions and animated status from an animated GIF', () => {
    // 1. Probe width & height
    const size = probeImageSize(uint8Array)
    expect(size).toEqual([120, 120])

    // 2. Probe if animated (multiple frames detected from GIF data blocks)
    const isAnimated = probeIsAnimatedGif(uint8Array)
    expect(isAnimated).toBe(true)
    expect(probeIsAnimatedGif(buildGif(1))).toBe(false)
  })

  it('can be added into a scene/shot and evaluated across time', () => {
    const project = createProject({ duration: 5 })
    const shot = createShot('Cảnh 1 (Animated GIF)', [0, 0, 0], 0)
    project.shots.push(shot)

    const gifAsset: AssetMeta = {
      id: 'asset_test_gif_1',
      name: 'sample_animation.gif',
      kind: 'image',
      mime: 'image/gif',
      width: 120,
      height: 120,
      isAnimated: true,
      frameCount: 15
    }

    // Add layer into the shot
    const gifLayer = createImageLayer(gifAsset, project.comp, 0)
    gifLayer.shotId = shot.id
    gifLayer.props.speed = 1.0
    gifLayer.props.loopMode = 'loop'
    gifLayer.props.timeOffset = 0.0

    project.layers.push(gifLayer)

    // Evaluate scene at t = 0s
    const ev0 = evaluateScene(project, 0)
    const evaluatedLayer0 = ev0.layers.find((l) => l.layer.id === gifLayer.id)
    expect(evaluatedLayer0).toBeDefined()
    expect(evaluatedLayer0?.layer.type).toBe('image')
    expect((evaluatedLayer0?.layer.props as any).assetId).toBe('asset_test_gif_1')

    // Mock decoded animated gif data with 15 frames of 0.04s each (total = 0.60s)
    const mockFrames = Array.from({ length: 15 }, (_, i) => ({
      index: i,
      startTime: Number((i * 0.04).toFixed(4)),
      duration: 0.04,
      bitmap: {} as ImageBitmap
    }))

    const animData: AnimatedGifData = {
      frames: mockFrames,
      totalDuration: 0.60,
      width: 120,
      height: 120
    }

    // Test frame selection at different timeline points in the shot
    // t = 0.0s -> frame 0
    expect(getAnimatedGifFrameIndex(animData, 0.0, gifLayer.props)).toBe(0)

    // t = 0.08s -> frame 2
    expect(getAnimatedGifFrameIndex(animData, 0.08, gifLayer.props)).toBe(2)

    // t = 0.30s (halfway) -> frame 7
    expect(getAnimatedGifFrameIndex(animData, 0.30, gifLayer.props)).toBe(7)

    // t = 0.60s (loops back) -> frame 0
    expect(getAnimatedGifFrameIndex(animData, 0.60, gifLayer.props)).toBe(0)

    // t = 0.70s (0.70 % 0.60 = 0.10s) -> frame 2
    expect(getAnimatedGifFrameIndex(animData, 0.70, gifLayer.props)).toBe(2)

    // Test with 2x speed: t = 0.15s behaves like t = 0.30s -> frame 7
    expect(getAnimatedGifFrameIndex(animData, 0.15, { ...gifLayer.props, speed: 2.0 })).toBe(7)

    // Test with 'once' loop mode: after 0.60s it should stay at the last frame (14)
    expect(getAnimatedGifFrameIndex(animData, 1.50, { ...gifLayer.props, loopMode: 'once' })).toBe(14)

    // Test with 'ping-pong': at 0.70s (0.6s forward + 0.1s backward = 0.5s from start) -> frame 12
    expect(getAnimatedGifFrameIndex(animData, 0.70, { ...gifLayer.props, loopMode: 'ping-pong' })).toBe(12)
  })
})
