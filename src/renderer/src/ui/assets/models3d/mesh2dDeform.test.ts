import { describe, it, expect } from 'vitest'
import {
  hasFaceDeformation,
  projectDeformedPoint2D,
  generateDeformedFramePath
} from './mesh2dDeform'

describe('mesh2dDeform', () => {
  const W = 500
  const H = 500

  it('detects face deformation correctly', () => {
    expect(hasFaceDeformation(null)).toBe(false)
    expect(hasFaceDeformation({})).toBe(false)
    expect(hasFaceDeformation({ bendX: 0, bendY: 0, taperRatio: 1 })).toBe(false)
    expect(hasFaceDeformation({ taperRatio: 0.5 })).toBe(true)
    expect(hasFaceDeformation({ bendLateral: 25 })).toBe(true)
    expect(hasFaceDeformation({ arcAngle: 90 })).toBe(true)
    expect(hasFaceDeformation({ bendX: 30 })).toBe(true)
  })

  it('returns original points when no deformation is applied', () => {
    const pt = projectDeformedPoint2D(100, 200, W, H, null)
    expect(pt).toEqual([100, 200])

    const pt2 = projectDeformedPoint2D(100, 200, W, H, { taperRatio: 1, bendLateral: 0 })
    expect(pt2).toEqual([100, 200])
  })

  it('applies taper deformation narrowing at the top (v=1, y=0)', () => {
    // Center point at top should stay centered
    const topCenter = projectDeformedPoint2D(250, 0, W, H, { taperRatio: 0.5 })
    expect(topCenter[0]).toBeCloseTo(250, 1)

    // Left edge at top (px=0) with taperRatio=0.5:
    // cx = 250, (0 - 250) * 0.5 = -125 => x = 125
    const topLeft = projectDeformedPoint2D(0, 0, W, H, { taperRatio: 0.5 })
    expect(topLeft[0]).toBeCloseTo(125, 1)

    // Bottom edge at bottom (y=H, v=0): sV = 1, should not change
    const bottomLeft = projectDeformedPoint2D(0, H, W, H, { taperRatio: 0.5 })
    expect(bottomLeft[0]).toBeCloseTo(0, 1)
  })

  it('applies lateral bend shifting points horizontally based on v', () => {
    // Bottom (v=0): shift should be 0
    const bottomPt = projectDeformedPoint2D(250, H, W, H, { bendLateral: 50, bendRegion: 'all' })
    expect(bottomPt[0]).toBeCloseTo(250, 1)

    // Top (v=1): shift should be positive for bendLateral > 0
    const topPt = projectDeformedPoint2D(250, 0, W, H, { bendLateral: 50, bendRegion: 'all' })
    expect(topPt[0]).toBeGreaterThan(250)
  })

  it('generates a valid SVG frame path', () => {
    const pathNoDeform = generateDeformedFramePath(W, H, null)
    expect(pathNoDeform).toBe('M 0 0 L 500 0 L 500 500 L 0 500 Z')

    const pathDeformed = generateDeformedFramePath(W, H, { taperRatio: 0.6, bendLateral: 20 })
    expect(pathDeformed.startsWith('M ')).toBe(true)
    expect(pathDeformed.endsWith(' Z')).toBe(true)
    expect(pathDeformed).not.toBe('M 0 0 L 500 0 L 500 500 L 0 500 Z')
  })
})
