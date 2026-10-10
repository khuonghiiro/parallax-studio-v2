import { describe, it, expect } from 'vitest'
import { getLayerFullResUrl } from './useLayerAssetImage'
import { createCameraFrustumHelper } from './layerAssembly3DHelpers'
import { KNIGHT_COMPOSITE } from './knightComposite'

describe('Layer Assembly Brush Eraser & 3D Camera Depth', () => {
  it('prioritizes directUrl over assetPath so edited eraser pixels take immediate effect', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const assetPath = 'character_hero/v2/torso.png'

    // When directUrl is provided (edited by eraser), it MUST take precedence over assetPath
    const resolved = getLayerFullResUrl(assetPath, dataUrl)
    expect(resolved).toBe(dataUrl)

    // When directUrl is undefined/empty, fallback to assetPath resolution
    const fallback = getLayerFullResUrl(assetPath, undefined)
    expect(fallback).not.toBe(dataUrl)
  })

  it('ensures all layers in knightComposite default to z <= 0 to stay inside camera volume', () => {
    for (const layer of KNIGHT_COMPOSITE.layers) {
      // In 3D: posZ = -layer.z * zExaggeration. When layer.z <= 0, posZ >= 0 (in front of or on canvas plane)
      expect(layer.z).toBeLessThanOrEqual(0)
    }

    const thighL = KNIGHT_COMPOSITE.layers.find((l) => l.id === 'knight-thigh-l')
    const forearmL = KNIGHT_COMPOSITE.layers.find((l) => l.id === 'knight-forearm-l')
    expect(thighL).toBeDefined()
    expect(forearmL).toBeDefined()

    // Thigh starts at canvas plane z = 0
    expect(thighL!.z).toBe(0)
    // Symmetrical frontal depth between outer limbs and core
    expect(thighL!.z - forearmL!.z).toBeGreaterThan(40)
  })

  it('creates extended camera frustum helper that bounds both foreground and background depth', () => {
    const frustum = createCameraFrustumHelper(420, 540, 1000, false, 220)
    expect(frustum).toBeDefined()
    const pos = frustum.geometry.getAttribute('position')
    expect(pos).toBeDefined()
    expect(pos.count).toBeGreaterThan(20)

    // Verify presence of background depth points (z = -220)
    let hasBackDepth = false
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getZ(i) - -220) < 0.001) {
        hasBackDepth = true
        break
      }
    }
    expect(hasBackDepth).toBe(true)
  })
})
