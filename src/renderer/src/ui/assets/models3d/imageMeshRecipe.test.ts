import { describe, expect, it } from 'vitest'
import { IMAGE_MESH_TEMPLATES } from './imageMeshTemplates'
import { bindTemplateImages, imageTemplateGuide, resolveImageTemplate } from './imageMeshRecipe'
import { templateFaces } from './assemblyTemplates'
import { buildAlphaTrimmedGeometry } from './alphaMeshBuilder'

describe('image mesh recipes', () => {
  it('builds a non-flat leaf mesh and removes transparent corner pixels', () => {
    const leaf = templateFaces(IMAGE_MESH_TEMPLATES[0])[0]
    const n = leaf.gridRes!
    const mask = Array.from({ length: n }, (_, row) => Array.from({ length: n }, (_, col) =>
      ((col + 0.5 - n / 2) / (n * 0.35)) ** 2 + ((row + 0.5 - n / 2) / (n * 0.48)) ** 2 <= 1))
    const geometry = buildAlphaTrimmedGeometry(leaf.width, leaf.height, mask, n, n, leaf.bendX, leaf.bendY,
      'all', undefined, 0, undefined, 0, true, leaf.depthProfile, leaf.depthIntensity)
    try {
      geometry.computeBoundingBox()
      expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThan(1)
      expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeLessThan(leaf.width)
      expect(geometry.getIndex()!.count).toBeGreaterThan(100)
      expect([...geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true)
    } finally { geometry.dispose() }
  })
  it('covers every face with an image slot of the correct canvas ratio and real alpha mesh settings', () => {
    for (const template of IMAGE_MESH_TEMPLATES) {
      const guide = imageTemplateGuide(template)
      for (const f of guide.faces) {
        const slot = guide.slots.find((s) => s.id === f.imageSlot)!
        expect(slot, `${template.id}: ${f.name}`).toBeDefined()
        expect(f.width / f.height).toBeCloseTo(slot.aspect[0] / slot.aspect[1], 2)
        expect(f.mesh?.meshMode).toBe('auto')
        expect(slot.renderPrompt).toContain('orthographic')
        expect(slot.faceIndices).toContain(f.index)
      }
      for (const variant of guide.variants) {
        const faces = templateFaces(resolveImageTemplate(template, variant.id))
        expect(faces.every((f) => [...f.position, ...f.rotation, f.width, f.height].every(Number.isFinite))).toBe(true)
      }
    }
  })

  it('shares petal images across six faces without mutating originals or other slots', () => {
    const template = IMAGE_MESH_TEMPLATES.find((t) => t.id === 'mesh-flower')!
    const faces = templateFaces(template)
    const bound = bindTemplateImages(template, faces, { petal: 'flowers/petal.png' })
    expect(bound.filter((f) => f.assetPath === 'flowers/petal.png')).toHaveLength(6)
    expect(faces.every((f) => !f.assetPath)).toBe(true)
    expect(bound.find((f) => f.imageSlot === 'stem')?.assetPath).toBeUndefined()
    expect(() => bindTemplateImages(template, faces, { typo: 'a.png' })).toThrow(/Unknown image slot/)
    expect(() => bindTemplateImages(template, faces, { petal: '' })).toThrow(/non-empty/)
    expect(() => resolveImageTemplate(template, 'missing')).toThrow(/variant/)
  })
})
