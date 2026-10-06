import { describe, expect, it } from 'vitest'
import type { LayerGlow } from '@shared/types'

function computeGlowIntensity(glow: LayerGlow, t: number): number {
  if (!glow.enabled) return 0
  const glowStart = glow.startTime ?? 0
  const glowDur = glow.duration ?? 0

  if (t < glowStart) return 0
  let timeFactor = 1.0
  if (glowDur > 0) {
    const elapsed = t - glowStart
    if (elapsed > glowDur) return 0
    const fadeIn = Math.min(0.12, glowDur * 0.25)
    const fadeOut = Math.min(0.15, glowDur * 0.25)
    if (elapsed < fadeIn && fadeIn > 0.001) {
      timeFactor = elapsed / fadeIn
    } else if (elapsed > glowDur - fadeOut && fadeOut > 0.001) {
      timeFactor = (glowDur - elapsed) / fadeOut
    }
  }

  const baseIntensity = glow.intensity ?? 1.2
  const minI = (glow.minIntensity ?? 0.15) * baseIntensity
  const spd = glow.speed ?? 2.0
  const localT = Math.max(0, t - glowStart)

  let computedI = baseIntensity
  if (glow.animated === 'breathe') {
    const wave = 0.5 + 0.5 * Math.sin(localT * spd * Math.PI * 2)
    computedI = minI + (baseIntensity - minI) * wave
  } else if (glow.animated === 'blink') {
    const cycle = (localT * spd) % 1
    computedI = cycle < 0.5 ? baseIntensity : minI
  } else if (glow.animated === 'flicker') {
    const f = 0.5 + 0.3 * Math.sin(localT * spd * 17.3) + 0.15 * Math.sin(localT * spd * 31.7) + 0.05 * Math.sin(localT * spd * 7.1)
    const drop = ((localT * spd * 3) % 1) > 0.88 ? 0.3 : 1.0
    computedI = minI + (baseIntensity - minI) * Math.max(0, Math.min(1, f * drop))
  }
  return computedI * timeFactor
}

describe('Layer Neon Edge Glow (Outline Glow)', () => {
  it('returns 0 intensity when glow is disabled', () => {
    const glow: LayerGlow = {
      enabled: false,
      side: 'outer',
      color: '#3dd6f5',
      intensity: 1.5
    }
    expect(computeGlowIntensity(glow, 0)).toBe(0)
    expect(computeGlowIntensity(glow, 1.5)).toBe(0)
  })

  it('keeps static intensity when animated is none or undefined', () => {
    const glow: LayerGlow = {
      enabled: true,
      side: 'outer',
      color: '#f59e0b',
      thickness: 12,
      intensity: 1.8,
      animated: 'none'
    }
    expect(computeGlowIntensity(glow, 0)).toBeCloseTo(1.8, 5)
    expect(computeGlowIntensity(glow, 0.25)).toBeCloseTo(1.8, 5)
    expect(computeGlowIntensity(glow, 0.75)).toBeCloseTo(1.8, 5)
    expect(computeGlowIntensity(glow, 2.0)).toBeCloseTo(1.8, 5)
  })

  it('breathes smoothly between minIntensity and base intensity', () => {
    const glow: LayerGlow = {
      enabled: true,
      side: 'both',
      color: '#ec4899',
      thickness: 10,
      intensity: 2.0,
      animated: 'breathe',
      speed: 1.0, // 1 Hz = 1 chu kỳ mỗi giây
      minIntensity: 0.2 // min = 0.2 * 2.0 = 0.4
    }

    // Tại t = 0: sin(0) = 0 => wave = 0.5 => 0.4 + 1.6 * 0.5 = 1.2
    expect(computeGlowIntensity(glow, 0)).toBeCloseTo(1.2, 2)

    // Tại t = 0.25s: sin(PI / 2) = 1.0 => wave = 1.0 => max intensity 2.0
    expect(computeGlowIntensity(glow, 0.25)).toBeCloseTo(2.0, 2)

    // Tại t = 0.75s: sin(3*PI / 2) = -1.0 => wave = 0 => min intensity 0.4
    expect(computeGlowIntensity(glow, 0.75)).toBeCloseTo(0.4, 2)

    // Tại t = 1.0s: hoàn thành 1 chu kỳ, quay lại 1.2
    expect(computeGlowIntensity(glow, 1.0)).toBeCloseTo(1.2, 2)
  })

  it('blinks sharply like a signal light', () => {
    const glow: LayerGlow = {
      enabled: true,
      side: 'inner',
      color: '#10b981',
      thickness: 6,
      intensity: 1.5,
      animated: 'blink',
      speed: 2.0, // 2 Hz = 0.5s per cycle (0.25s on, 0.25s off)
      minIntensity: 0.1 // min = 0.1 * 1.5 = 0.15
    }

    // Chu kỳ 1: [0 .. 0.5s]
    // Nửa đầu (0 .. 0.25s): bật sáng tối đa 1.5
    expect(computeGlowIntensity(glow, 0.1)).toBeCloseTo(1.5, 5)
    // Nửa sau (0.25s .. 0.5s): mờ tối thiểu 0.15
    expect(computeGlowIntensity(glow, 0.35)).toBeCloseTo(0.15, 5)

    // Chu kỳ 2: [0.5 .. 1.0s]
    expect(computeGlowIntensity(glow, 0.6)).toBeCloseTo(1.5, 5)
    expect(computeGlowIntensity(glow, 0.85)).toBeCloseTo(0.15, 5)
  })

  it('supports outer, inner, and both glow sides with valid presets', () => {
    const outerGlow: LayerGlow = { enabled: true, side: 'outer', thickness: 8 }
    const innerGlow: LayerGlow = { enabled: true, side: 'inner', thickness: 14 }
    const bothGlow: LayerGlow = { enabled: true, side: 'both', thickness: 20 }

    expect(outerGlow.side).toBe('outer')
    expect(innerGlow.side).toBe('inner')
    expect(bothGlow.side).toBe('both')
  })

  it('activates glow strictly within the [startTime, startTime + duration] window', () => {
    const glow: LayerGlow = {
      enabled: true,
      startTime: 2.0,
      duration: 1.5,
      intensity: 2.0,
      animated: 'none'
    }
    // Trước startTime (t = 1.0s): tắt hoàn toàn
    expect(computeGlowIntensity(glow, 1.0)).toBe(0)
    expect(computeGlowIntensity(glow, 1.99)).toBe(0)

    // Ở giữa thời lượng (t = 2.75s): sáng tối đa
    expect(computeGlowIntensity(glow, 2.75)).toBeCloseTo(2.0, 2)

    // Sau khi hết duration (t = 3.6s): tắt hoàn toàn
    expect(computeGlowIntensity(glow, 3.6)).toBe(0)
  })

  it('remains active indefinitely from startTime when duration is 0 (Suốt layer)', () => {
    const glow: LayerGlow = {
      enabled: true,
      startTime: 3.0,
      duration: 0,
      intensity: 1.5,
      animated: 'none'
    }
    expect(computeGlowIntensity(glow, 2.5)).toBe(0)
    expect(computeGlowIntensity(glow, 3.5)).toBeCloseTo(1.5, 2)
    expect(computeGlowIntensity(glow, 10.0)).toBeCloseTo(1.5, 2)
  })
})
