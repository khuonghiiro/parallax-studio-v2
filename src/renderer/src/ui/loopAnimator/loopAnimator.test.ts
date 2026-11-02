import { describe, expect, it } from 'vitest'
import { evaluateLoopLayerRhythm, getAnimatedGifFrameIndex } from '../../project/gifHelper'
import { applyChromaKeyToImageData, buildGridFrames, parseHexRgb } from './loopFrameExtractor'
import { SAMPLE_LOOP_PRESETS } from './sampleLoops'
import { buildWorkshopLoopConfigFromTemplate } from '../layerAssembly/WorkshopLoopLogicPanel'
import { getBuiltinLoopTemplates } from './loopAnimatorStorage'

describe('Loop Animator & Loop Rhythm Logic', () => {
  it('builds uniform grid frames accurately', () => {
    const frames = buildGridFrames(1024, 1024, {
      cols: 4,
      rows: 4,
      marginX: 0,
      marginY: 0,
      paddingX: 0,
      paddingY: 0
    })
    expect(frames).toHaveLength(16)
    expect(frames[0]).toMatchObject({ x: 0, y: 0, width: 256, height: 256, enabled: true })
    expect(frames[15]).toMatchObject({ x: 768, y: 768, width: 256, height: 256, enabled: true })
  })

  it('parses hex colors and applies chroma key removal', () => {
    expect(parseHexRgb('#00ff00')).toEqual([0, 255, 0])
    const raw = new Uint8ClampedArray([
      0, 255, 0, 255, // pure green background -> should become transparent
      255, 60, 20, 255 // fire orange pixel -> should stay opaque
    ])
    const fakeImageData = { data: raw, width: 2, height: 1 } as unknown as ImageData
    applyChromaKeyToImageData(fakeImageData, {
      enabled: true,
      keyColor: '#00ff00',
      similarity: 0.3,
      smoothness: 0.1,
      spill: 0.4
    })
    expect(raw[3]).toBe(0)
    expect(raw[7]).toBe(255)
  })

  it('evaluates getAnimatedGifFrameIndex across loop, ping-pong, once, and random modes', () => {
    const fakeGif = {
      width: 256,
      height: 256,
      totalDuration: 1.0,
      frames: [
        { index: 0, bitmap: {} as ImageBitmap, duration: 0.25, startTime: 0 },
        { index: 1, bitmap: {} as ImageBitmap, duration: 0.25, startTime: 0.25 },
        { index: 2, bitmap: {} as ImageBitmap, duration: 0.25, startTime: 0.5 },
        { index: 3, bitmap: {} as ImageBitmap, duration: 0.25, startTime: 0.75 }
      ]
    }
    expect(getAnimatedGifFrameIndex(fakeGif, 0.1, { loopMode: 'loop', speed: 1 })).toBe(0)
    expect(getAnimatedGifFrameIndex(fakeGif, 0.6, { loopMode: 'loop', speed: 1 })).toBe(2)
    expect(getAnimatedGifFrameIndex(fakeGif, 2.5, { loopMode: 'once', speed: 1 })).toBe(3)
    const randIdx = getAnimatedGifFrameIndex(fakeGif, 0.5, { loopMode: 'random', speed: 1 })
    expect(randIdx).toBeGreaterThanOrEqual(0)
    expect(randIdx).toBeLessThan(4)
  })

  it('evaluates evaluateLoopLayerRhythm for flicker_opacity, pulse_scale, sync_both, and strobe_beat', () => {
    const noneEval = evaluateLoopLayerRhythm({ loopRhythmMode: 'none' }, 0.5)
    expect(noneEval).toEqual({ opacityMultiplier: 1, scaleMultiplier: 1 })

    const flickerEval = evaluateLoopLayerRhythm(
      {
        loopRhythmMode: 'flicker_opacity',
        loopRhythmRateHz: 3,
        loopRhythmIntensity: 0.5,
        loopMinOpacity: 0.4
      },
      0.35
    )
    expect(flickerEval.opacityMultiplier).toBeGreaterThanOrEqual(0.4)
    expect(flickerEval.opacityMultiplier).toBeLessThanOrEqual(1)
    expect(flickerEval.scaleMultiplier).toBe(1)

    const pulseEval = evaluateLoopLayerRhythm(
      {
        loopRhythmMode: 'pulse_scale',
        loopRhythmRateHz: 2,
        loopRhythmIntensity: 0.8,
        loopScaleBeatPct: 20
      },
      0.25
    )
    expect(pulseEval.opacityMultiplier).toBe(1)
    expect(pulseEval.scaleMultiplier).toBeGreaterThanOrEqual(0.8)
    expect(pulseEval.scaleMultiplier).toBeLessThanOrEqual(1.25)

    const strobeEval = evaluateLoopLayerRhythm(
      {
        loopRhythmMode: 'strobe_beat',
        loopRhythmRateHz: 4,
        loopRhythmIntensity: 0.9,
        loopMinOpacity: 0.3,
        loopScaleBeatPct: 15
      },
      0.05
    )
    expect(strobeEval.opacityMultiplier).toBeGreaterThanOrEqual(0.3)
    expect(strobeEval.scaleMultiplier).toBeGreaterThanOrEqual(1)
  })

  it('creates valid 2.5D Workshop loop config from builtin templates', () => {
    const builtins = getBuiltinLoopTemplates()
    expect(builtins.length).toBeGreaterThanOrEqual(4)
    expect(SAMPLE_LOOP_PRESETS.length).toBeGreaterThanOrEqual(4)
    const cfg = buildWorkshopLoopConfigFromTemplate(builtins[0])
    expect(cfg.enabled).toBe(true)
    expect(cfg.frames?.length).toBe(builtins[0].frameCount)
    expect(cfg.fps).toBe(builtins[0].fps)
    expect(cfg.rhythmMode).toBeDefined()
  })
})
