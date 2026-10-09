import { describe, expect, it } from 'vitest'
import { IMAGE_MESH_TEMPLATES } from './imageMeshTemplates'
import { bindTemplateImages, imageTemplateGuide, resolveImageTemplate } from './imageMeshRecipe'
import { templateFaces } from './assemblyTemplates'
import { buildAlphaTrimmedGeometry } from './alphaMeshBuilder'

describe('image mesh recipes', () => {
  it('reports exact image counts, pixel ratios, alpha and reuse contracts for all variants', () => {
    const counts = [[1, 1], [3, 8], [3, 8], [4, 10], [3, 5], [2, 2], [1, 3], [1, 14]]
    IMAGE_MESH_TEMPLATES.forEach((template, index) => {
      for (const variant of template.imageRecipe!.variants) {
        const guide = imageTemplateGuide(template, variant.id)
        expect([guide.sourceImageCount, guide.meshFaceCount]).toEqual(counts[index])
        expect(guide.slots.reduce((sum, s) => sum + s.reuseCount, 0)).toBe(guide.meshFaceCount)
        for (const slot of guide.slots) {
          const [w, h] = slot.recommendedPixels
          expect(w * slot.aspect[1]).toBe(h * slot.aspect[0])
          expect(Math.max(w, h)).toBeLessThanOrEqual(2048)
          expect(Math.min(w, h)).toBeGreaterThan(0)
          expect(slot.imageCount).toBe(1)
          expect(slot.reuseCount).toBe(slot.faceIndices.length)
          expect(slot.mirrorImage).toBe(false)
          expect(slot.renderPrompt).toContain(slot.symmetry.en)
          expect(slot.renderPrompt).toContain(slot.alpha.en)
          expect(slot.symmetry.vi).toBeTruthy()
        }
      }
    })
  })

  it('trumpet flower template defines 6 flared petals, stamens and stem with top curvature', () => {
    const template = IMAGE_MESH_TEMPLATES.find((t) => t.id === 'mesh-trumpet-flower')!
    expect(template).toBeDefined()
    const guide = imageTemplateGuide(template)
    expect(guide.sourceImageCount).toBe(3)
    expect(guide.meshFaceCount).toBe(8)
    const petalSlot = guide.slots.find((s) => s.id === 'petal')!
    expect(petalSlot.reuseCount).toBe(6)
    expect(petalSlot.aspect).toEqual([1, 2])
    const stamenSlot = guide.slots.find((s) => s.id === 'stamen')!
    expect(stamenSlot.reuseCount).toBe(1)
    expect(stamenSlot.aspect).toEqual([1, 2])
    const faces = templateFaces(template)
    const bound = bindTemplateImages(template, faces, { petal: 'lily/petal.png' })
    expect(bound.filter((f) => f.assetPath === 'lily/petal.png')).toHaveLength(6)
    // Check that flared petals have bendRegion top, bendX/bendY and pre-configured silhouettePolygon set
    const petalFace = faces.find((f) => f.imageSlot === 'petal')!
    expect(petalFace.bendRegion).toBe('top')
    expect(petalFace.bendX).toBe(42)
    expect(petalFace.bendY).toBe(-36)
    expect(petalFace.silhouettePolygon).toBeDefined()
    expect(petalFace.silhouettePolygon!.length).toBeGreaterThan(4)
  })

  it('360 degree radial grass clump generates 14 multi-tiered blades from 1 single blade slot', () => {
    const template = IMAGE_MESH_TEMPLATES.find((t) => t.id === 'mesh-grass-radial')!
    expect(template).toBeDefined()
    const guide = imageTemplateGuide(template)
    expect(guide.sourceImageCount).toBe(1)
    expect(guide.meshFaceCount).toBe(14)
    expect(guide.slots[0].id).toBe('blade')
    expect(guide.slots[0].reuseCount).toBe(14)
    expect(guide.slots[0].aspect).toEqual([1, 5])
    const faces = templateFaces(template)
    // All 14 blades bound to the single blade image
    const bound = bindTemplateImages(template, faces, { blade: 'grass/single_blade.png' })
    expect(bound.filter((f) => f.assetPath === 'grass/single_blade.png')).toHaveLength(14)
    // Heights vary across blades (350, 300, 250, 200, 175)
    const heights = new Set(faces.map((f) => f.height))
    expect(heights.size).toBeGreaterThanOrEqual(4)
    // Every face has organic bendRegion (top, all, curl) and bendY curvature
    for (const f of faces) {
      expect(['top', 'all', 'curl']).toContain(f.bendRegion)
      expect(f.bendY).toBeGreaterThanOrEqual(20)
    }
  })

  it('keeps high-rise walls opaque and aligns twelve floor bands across both elevations', () => {
    const guide = imageTemplateGuide(IMAGE_MESH_TEMPLATES.find((t) => t.id === 'mesh-highrise')!)
    expect(guide.slots.map((s) => s.reuseCount)).toEqual([2, 2, 1])
    for (const slot of guide.slots) {
      expect(slot.alphaMode).toBe('opaque')
      expect(slot.renderPrompt).toContain('alpha=255')
      if (slot.id !== 'roof') expect(slot.renderPrompt).toContain('y=k/12')
    }
  })

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

  it('provides schema version 1, bilingual prompts, SVG guide and 3D anchor for every template', () => {
    for (const template of IMAGE_MESH_TEMPLATES) {
      const guide = imageTemplateGuide(template)
      expect(guide.schemaVersion).toBe(1)
      expect(guide.slots.length).toBeGreaterThan(0)
      for (const slot of guide.slots) {
        expect(slot.anchorUV).toBeDefined()
        expect(slot.anchorUV).toHaveLength(2)
        expect(slot.guideSvgDataUrl).toContain('data:image/svg+xml')
        expect(slot.renderPromptEn).toBeTruthy()
        expect(slot.renderPromptVi).toBeTruthy()
      }
      for (const face of guide.faces) {
        expect(face.anchor3D).toBeDefined()
        expect(face.anchor3D).toHaveLength(3)
        expect(face.anchor3D.every(Number.isFinite)).toBe(true)
      }
    }
  })
})
