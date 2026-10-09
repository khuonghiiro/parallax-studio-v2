import { describe, it, expect } from 'vitest'
import {
  imageYToUvV,
  uvVToImageY,
  imagePointToUV,
  uvToImagePoint,
  imageBoundsToUvBounds,
  uvBoundsToImageBounds,
  convertPolygonSpace,
  buildSlotPrompts,
  generateSlotGuideSvg,
  evaluateFaceAnchor3D
} from './imageContract'
import type { Face3D } from '../../ui/assets/models3d/types'

describe('imageContract coordinate conversions', () => {
  it('converts single coordinates correctly with v = 1 - y', () => {
    expect(imageYToUvV(0)).toBe(1)
    expect(imageYToUvV(1)).toBe(0)
    expect(imageYToUvV(0.25)).toBe(0.75)
    expect(uvVToImageY(1)).toBe(0)
    expect(uvVToImageY(0)).toBe(1)
    expect(uvVToImageY(0.75)).toBe(0.25)
  })

  it('converts 2D points preserving x and flipping y/v', () => {
    expect(imagePointToUV([0.3, 0.2])).toEqual([0.3, 0.8])
    expect(uvToImagePoint([0.3, 0.8])).toEqual([0.3, 0.2])
  })

  it('converts bounding boxes accurately', () => {
    // Image box [x0, y0, x1, y1] with top at y=0.1, bottom at y=0.9
    const imgBounds: [number, number, number, number] = [0.2, 0.1, 0.8, 0.9]
    const uvBounds = imageBoundsToUvBounds(imgBounds)
    expect(uvBounds[0]).toBeCloseTo(0.2)
    expect(uvBounds[1]).toBeCloseTo(0.1) // vMin = 1 - 0.9 = 0.1
    expect(uvBounds[2]).toBeCloseTo(0.8)
    expect(uvBounds[3]).toBeCloseTo(0.9) // vMax = 1 - 0.1 = 0.9

    const roundTrip = uvBoundsToImageBounds(uvBounds)
    expect(roundTrip[0]).toBeCloseTo(imgBounds[0])
    expect(roundTrip[1]).toBeCloseTo(imgBounds[1])
    expect(roundTrip[2]).toBeCloseTo(imgBounds[2])
    expect(roundTrip[3]).toBeCloseTo(imgBounds[3])
  })

  it('converts polygon space without mutating original points', () => {
    const poly = [[0.1, 0.2], [0.5, 0.9], [0.9, 0.2]]
    const uvPoly = convertPolygonSpace(poly, 'image', 'uv')
    expect(uvPoly).toEqual([[0.1, 0.8], [0.5, 0.1], [0.9, 0.8]])
    expect(poly[0]).toEqual([0.1, 0.2]) // unchanged
  })
})

describe('imageContract prompt and SVG generation', () => {
  it('generates consistent bilingual prompts with attachment and alpha rules', () => {
    const { renderPromptEn, renderPromptVi } = buildSlotPrompts({
      id: 'petal',
      label: 'Cánh hoa',
      en: 'Petal',
      aspect: [2, 3],
      alphaMode: 'cutout',
      prompt: 'One flattened flower petal with narrow base.',
      symmetry: {
        en: 'Bilateral symmetry around center.',
        vi: 'Đối xứng hai bên qua tâm.'
      },
      attachmentBand: { vMin: 0.0, vMax: 0.05 }
    })

    expect(renderPromptEn).toContain('Aspect ratio 2:3')
    expect(renderPromptEn).toContain('transparent alpha background')
    expect(renderPromptEn).toContain('Root attachment edge touches')
    expect(renderPromptVi).toContain('Tỉ lệ khung hình 2:3')
    expect(renderPromptVi).toContain('Nền alpha trong suốt thật')
    expect(renderPromptVi).toContain('Chân gốc tiếp giáp')
  })

  it('generates a valid SVG guide with markers and watermark', () => {
    const svg = generateSlotGuideSvg({
      id: 'leaf',
      label: 'Phiến lá',
      aspect: [1, 2],
      anchorUV: [0.5, 0.0],
      tipUV: [0.5, 1.0],
      attachmentBand: { vMin: 0.0, vMax: 0.08 },
      silhouettePolygon: [[0.5, 0.0], [0.8, 0.5], [0.5, 1.0], [0.2, 0.5]]
    }, 200)

    expect(svg).toContain('<svg')
    expect(svg).toContain('viewBox="0 0 200 400"')
    expect(svg).toContain('ROOT (GỐC)')
    expect(svg).toContain('TIP')
    expect(svg).toContain('VÙNG GỐC / ATTACHMENT')
    expect(svg).toContain('KHÔNG VẼ VẠCH NÀY')
  })
})

describe('imageContract 3D anchor point evaluation', () => {
  it('evaluates resting anchor on flat face', () => {
    const face: Face3D = {
      id: 'test-face',
      name: 'Test',
      width: 100,
      height: 200,
      position: [0, 100, 0],
      rotation: [0, 0, 0]
    }
    // Bottom anchor UV [0.5, 0.0] -> local Y is -h/2 = -100, world Y is 100 - 100 = 0
    const anchor = evaluateFaceAnchor3D(face, [0.5, 0.0])
    expect(anchor[0]).toBeCloseTo(0)
    expect(anchor[1]).toBeCloseTo(0)
    expect(anchor[2]).toBeCloseTo(0)

    // Tip UV [0.5, 1.0] -> local Y is +100, world Y is 100 + 100 = 200
    const tip = evaluateFaceAnchor3D(face, [0.5, 1.0])
    expect(tip[0]).toBeCloseTo(0)
    expect(tip[1]).toBeCloseTo(200)
    expect(tip[2]).toBeCloseTo(0)
  })

  it('accounts for face rotation when calculating anchor', () => {
    const face: Face3D = {
      id: 'rot-face',
      name: 'Rotated Face',
      width: 100,
      height: 200,
      position: [0, 0, 0],
      rotation: [0, 0, 90] // 90 deg in depth space
    }
    // Anchor UV [0.5, 0.0] local is [0, -100, 0]. Under depth-space rotation convention -> [-100, 0, 0]
    const anchor = evaluateFaceAnchor3D(face, [0.5, 0.0])
    expect(anchor[0]).toBeCloseTo(-100)
    expect(anchor[1]).toBeCloseTo(0)
    expect(anchor[2]).toBeCloseTo(0)
  })
})
