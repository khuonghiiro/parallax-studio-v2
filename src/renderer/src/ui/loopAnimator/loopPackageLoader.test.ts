import { describe, expect, it } from 'vitest'
import {
  resolveEffectiveLoopConfig,
  applyLoopColorFilterToCanvas,
  getLoopColorSignature
} from './loopPackageLoader'

describe('loopPackageLoader', () => {
  it('correctly resolves and inherits configuration overrides without mutating base JSON', () => {
    const baseJson = {
      name: 'Ánh Lửa Cháy',
      fps: 14,
      speed: 1.0,
      loopMode: 'loop' as const,
      colorConfig: {
        tintColor: '#ff5500',
        tintIntensity: 0.8,
        brightness: 1.0,
        contrast: 1.0
      },
      rhythm: {
        rhythmMode: 'flicker_opacity' as const,
        rhythmRateHz: 2.5,
        rhythmIntensity: 0.4,
        minOpacity: 0.3,
        scaleBeatPct: 15
      }
    }

    // 1. Without overrides -> uses base JSON
    const res1 = resolveEffectiveLoopConfig(baseJson, null)
    expect(res1.fps).toBe(14)
    expect(res1.speed).toBe(1.0)
    expect(res1.loopMode).toBe('loop')
    expect(res1.color.tintColor).toBe('#ff5500')
    expect(res1.rhythm?.rhythmMode).toBe('flicker_opacity')

    // 2. With layer overrides (e.g. user changed tint to blue and speed to 2.0 on layer in Scene)
    const overrides = {
      speed: 2.0,
      color: {
        tintColor: '#00e5ff',
        tintIntensity: 0.9,
        brightness: 1.3
      }
    }

    const res2 = resolveEffectiveLoopConfig(baseJson, overrides)
    // Overridden fields
    expect(res2.speed).toBe(2.0)
    expect(res2.color.tintColor).toBe('#00e5ff')
    expect(res2.color.brightness).toBe(1.3)
    // Inherited fields from base
    expect(res2.fps).toBe(14)
    expect(res2.loopMode).toBe('loop')
    expect(res2.color.contrast).toBe(1.0)
    expect(res2.rhythm?.rhythmMode).toBe('flicker_opacity')

    // Base JSON was NOT modified
    expect(baseJson.speed).toBe(1.0)
    expect(baseJson.colorConfig.tintColor).toBe('#ff5500')
  })

  it('safely handles environments without document', () => {
    const fakeCanvas = {} as HTMLCanvasElement
    const out = applyLoopColorFilterToCanvas(fakeCanvas, {
      tintColor: '#38bdf8',
      tintIntensity: 0.5,
      brightness: 1.2
    })
    expect(out).toBe(fakeCanvas)
  })

  it('computes compact color signatures for TexturePool caching', () => {
    expect(getLoopColorSignature(null)).toBe('default')
    expect(getLoopColorSignature({ brightness: 1.0, contrast: 1.0, hueRotate: 0 })).toBe('default')
    const sig = getLoopColorSignature({
      tintColor: '#00e5ff',
      tintIntensity: 0.65,
      brightness: 1.25,
      hueRotate: 45
    })
    expect(sig).not.toBe('default')
    expect(sig).toContain('#00e5ff')
    expect(sig).toContain('1.25')
    expect(sig).toContain('45')
  })
})
