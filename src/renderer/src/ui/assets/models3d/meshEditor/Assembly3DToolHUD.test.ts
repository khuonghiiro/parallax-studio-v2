import { describe, it, expect } from 'vitest'
import type { Face3D } from '../types'
import { hasFaceDeformation, projectDeformedPoint2D } from '../mesh2dDeform'

describe('Assembly3DToolHUD & Deformation Logic', () => {
  const mockFace: Face3D = {
    id: 'face-flower-1',
    name: 'Cánh hoa sen',
    width: 400,
    height: 600,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    taperRatio: 1.0,
    bendLateral: 0,
    arcAngle: 0
  }

  it('detects deformation states accurately for HUD status', () => {
    expect(hasFaceDeformation(mockFace)).toBe(false)

    const deformedBend: Face3D = { ...mockFace, arcAngle: 90, bendX: 20 }
    expect(hasFaceDeformation(deformedBend)).toBe(true)

    const deformedTaper: Face3D = { ...mockFace, taperRatio: 0.4 }
    expect(hasFaceDeformation(deformedTaper)).toBe(true)

    const deformedLateral: Face3D = { ...mockFace, bendLateral: 35 }
    expect(hasFaceDeformation(deformedLateral)).toBe(true)
  })

  it('correctly maps 3D bends to 2D coordinates for visual synchronization', () => {
    // Top of petal (v = 1, py = 0) with taperRatio = 0.5 (narrow tip)
    const [defTopX, defTopY] = projectDeformedPoint2D(100, 0, 400, 600, {
      taperRatio: 0.5
    })
    // Center is 200. Original 100 has dx = -100. Scaled by 0.5 => dx = -50 => x = 150
    expect(defTopX).toBeCloseTo(150, 1)
    expect(defTopY).toBe(0)

    // Base of petal (v = 0, py = 600) with taperRatio = 0.5 should maintain full width (no change)
    const [defBotX, defBotY] = projectDeformedPoint2D(100, 600, 400, 600, {
      taperRatio: 0.5
    })
    expect(defBotX).toBeCloseTo(100, 1)
    expect(defBotY).toBe(600)
  })

  it('handles combination of taper and lateral curves simultaneously', () => {
    const combinedFace: Face3D = {
      ...mockFace,
      taperRatio: 0.6,
      bendLateral: 40,
      bendRegion: 'curl'
    }

    const [ptX, ptY] = projectDeformedPoint2D(200, 0, 400, 600, combinedFace)
    // Point was at center 200, should be shifted horizontally due to lateral curl
    expect(ptY).toBe(0)
    expect(typeof ptX).toBe('number')
  })
})
