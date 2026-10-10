import { describe, it, expect } from 'vitest'
import type { ImageMeshDefinition } from '@shared/imageMeshDefinition'
import { evaluateMeshGeometry } from './evaluateDeformation'
import { updateSkinGeometry } from './updateSkinGeometry'

const definition: ImageMeshDefinition = {
  version: 1, id: 'hair', name: 'Hair', modifiers: [], materials: {}, anchorUV: [0.5, 1],
  surface: { width: 100, height: 200, subdivisions: [1, 1], restUVBounds: [0, 0, 1, 1] },
  skin: {
    positions: [-5, 0, 0, 5, 0, 0, 0, -100, 0], uvs: [0, 1, 1, 1, 0.5, 0], indices: [0, 2, 1],
    binding: { boneId: 'hair', x: 0, y: 0, rotation: 0, scale: 1 },
    rig: { duration: 1, loop: false,
      bones: [{ id: 'hair', name: 'Hair', x: 0, y: 0, length: 100, angle: 90 }],
      tracks: { hair: [
        { time: 0, x: 0, y: 0, rotation: 0, easing: 'linear' },
        { time: 1, x: 0, y: 0, rotation: 90, easing: 'linear' }
      ] }
    }
  }
}
describe('serialized workshop skin playback/export', () => {
  it('round-trips alpha topology and produces the same pose in preview and export', () => {
    const restored = JSON.parse(JSON.stringify(definition)) as ImageMeshDefinition
    const preview = evaluateMeshGeometry(definition, { time: 1 })
    const exported = evaluateMeshGeometry(restored, { time: 0, unitSpace: true })
    const buffer = exported.getAttribute('position')
    updateSkinGeometry(exported, restored, 1)
    expect(exported.getAttribute('position')).toBe(buffer)
    expect(Array.from(exported.getIndex()!.array)).toEqual([0, 2, 1])
    for (let i = 0; i < buffer.count; i++) {
      expect(buffer.getX(i) * 100).toBeCloseTo(preview.getAttribute('position').getX(i))
      expect(buffer.getY(i) * 200).toBeCloseTo(preview.getAttribute('position').getY(i))
    }
    updateSkinGeometry(exported, restored, 0)
    expect(buffer.getX(2)).toBeCloseTo(0)
    expect(buffer.getY(2)).toBeCloseTo(-0.5)
    preview.dispose(); exported.dispose()
  })
})
