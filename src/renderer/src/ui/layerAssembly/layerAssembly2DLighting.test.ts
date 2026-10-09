import { describe, it, expect } from 'vitest'
import { computeLayer2DLighting, computeCanvasAtmosphere } from './layerAssembly2DLighting'
import type { AssembledLayerItem } from './types'

const createMockLayer = (id: string, z: number): AssembledLayerItem => ({
  id,
  name: `Layer ${id}`,
  x: 0,
  y: 0,
  z,
  scale: 1,
  rotation: 0,
  opacity: 1,
  motion: {
    type: 'none',
    speed: 1,
    amplitude: 0,
    anchor: 'center'
  }
})

describe('layerAssembly2DLighting', () => {
  it('handles sun disabled gracefully', () => {
    const layer = createMockLayer('1', 0)
    const result = computeLayer2DLighting(layer, 0, { sun: false, shadows: true })
    expect(result.shadowDx).toBe(0)
    expect(result.shadowDy).toBe(3)
    expect(result.atmosphereFilter).toBe('')
    expect(result.combinedFilter).toContain('drop-shadow')
  })

  it('handles shadows disabled', () => {
    const layer = createMockLayer('1', 0)
    const result = computeLayer2DLighting(layer, 0, { sun: true, shadows: false })
    expect(result.dropShadowFilter).toBe('')
    expect(result.combinedFilter).not.toContain('drop-shadow')
    expect(result.atmosphereFilter).not.toBe('')
  })

  it('casts shadow to the left when sun is to the right (azimuth > 0)', () => {
    const layer = createMockLayer('1', 0)
    const result = computeLayer2DLighting(layer, 50, {
      sun: true,
      shadows: true,
      azimuth: 45,
      elevation: 40,
      preset: 'auto'
    })
    // Sun on right (azimuth 45) -> shadowDx must be negative
    expect(result.shadowDx).toBeLessThan(0)
    // Sun from above -> shadowDy must be positive
    expect(result.shadowDy).toBeGreaterThan(0)
  })

  it('casts shadow to the right when sun is to the left (azimuth < 0)', () => {
    const layer = createMockLayer('1', 0)
    const result = computeLayer2DLighting(layer, 50, {
      sun: true,
      shadows: true,
      azimuth: -45,
      elevation: 40,
      preset: 'auto'
    })
    // Sun on left (azimuth -45) -> shadowDx must be positive
    expect(result.shadowDx).toBeGreaterThan(0)
    expect(result.shadowDy).toBeGreaterThan(0)
  })

  it('stretches shadow longer when sun elevation is low (e.g. sunset)', () => {
    const layer = createMockLayer('1', 0)
    const highSun = computeLayer2DLighting(layer, 50, {
      sun: true,
      shadows: true,
      azimuth: 30,
      elevation: 70
    })
    const lowSun = computeLayer2DLighting(layer, 50, {
      sun: true,
      shadows: true,
      azimuth: 30,
      elevation: 15
    })
    expect(lowSun.shadowDy).toBeGreaterThan(highSun.shadowDy)
  })

  it('gives larger shadow displacement to foreground layers (Z < 0) than background layers (Z > 0)', () => {
    const maxZ = 60
    const foregroundLayer = createMockLayer('fg', -30) // Pot in front
    const backgroundLayer = createMockLayer('bg', 50) // Leaves in back

    const fgResult = computeLayer2DLighting(foregroundLayer, maxZ, {
      sun: true,
      shadows: true,
      azimuth: 45,
      elevation: 40
    })
    const bgResult = computeLayer2DLighting(backgroundLayer, maxZ, {
      sun: true,
      shadows: true,
      azimuth: 45,
      elevation: 40
    })

    expect(Math.abs(fgResult.shadowDx)).toBeGreaterThan(Math.abs(bgResult.shadowDx))
    expect(fgResult.shadowDy).toBeGreaterThan(bgResult.shadowDy)
    expect(fgResult.shadowBlur).toBeGreaterThan(bgResult.shadowBlur)
  })

  it('applies mood atmospheric tint filters based on preset', () => {
    const layer = createMockLayer('1', 0)
    const night = computeLayer2DLighting(layer, 0, { sun: true, preset: 'night' })
    expect(night.atmosphereFilter).toContain('brightness')
    expect(night.atmosphereFilter).toContain('saturate')
    expect(night.shadowColor).toContain('10, 16, 32')

    const sunset = computeLayer2DLighting(layer, 0, { sun: true, preset: 'sunset' })
    expect(sunset.atmosphereFilter).toContain('sepia')
    expect(sunset.shadowColor).toContain('38, 16, 26')
  })

  it('computes canvas atmosphere info for 2D container', () => {
    const atmo = computeCanvasAtmosphere({ sun: true, preset: 'night' }, false)
    expect(atmo.background).toBeDefined()
    expect(atmo.icon).toBe('🌙')
    expect(atmo.isDarkScene).toBe(true)
  })
})
