import { describe, it, expect } from 'vitest'
import {
  computeCompositeContentBounds,
  fitCharacterToCanvas,
  fitCanvasToCharacter
} from './layerAssemblyFit'
import type { LayerComposite } from './types'

describe('layerAssemblyFit', () => {
  const mockComposite: LayerComposite = {
    id: 'test-comp',
    name: 'Test',
    category: 'character',
    width: 600,
    height: 600,
    layers: [
      {
        id: 'l1',
        name: 'Body',
        x: 0,
        y: 50,
        z: 0,
        scale: 0.3,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      }
    ],
    rig: {
      duration: 4,
      loop: false,
      bones: [
        { id: 'b1', name: 'Root', x: 0, y: 0, length: 60, angle: 90 },
        { id: 'b2', name: 'Head', parentId: 'b1', x: 0, y: 60, length: 40, angle: 90 }
      ],
      tracks: {}
    }
  }

  it('computes content bounds from bones and layers', () => {
    const bounds = computeCompositeContentBounds(mockComposite)
    expect(bounds).not.toBeNull()
    expect(bounds!.height).toBeGreaterThan(50)
  })

  it('scales character to fit canvas (~84%)', () => {
    const fitted = fitCharacterToCanvas(mockComposite)
    expect(fitted).not.toBe(mockComposite)
    expect(fitted.layers[0].scale).toBeGreaterThan(mockComposite.layers[0].scale)
    expect(fitted.rig!.bones[0].length).toBeGreaterThan(mockComposite.rig!.bones[0].length)
  })

  it('fits canvas frame to character', () => {
    const frameFitted = fitCanvasToCharacter(mockComposite)
    expect(frameFitted.width).toBeLessThanOrEqual(600)
    expect(frameFitted.height).toBeLessThanOrEqual(600)
  })
})
