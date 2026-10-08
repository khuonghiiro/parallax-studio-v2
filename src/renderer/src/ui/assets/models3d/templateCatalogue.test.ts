import { describe, it, expect } from 'vitest'
import {
  ALL_CREATE_TEMPLATES,
  CATEGORY_TABS,
  buildBlankModel
} from './templateCatalogue'

describe('Create 3D Template Catalogue & Custom Blank Model', () => {
  it('buildBlankModel() generates a valid blank custom Model3D with 1 starter face', () => {
    const blank = buildBlankModel()
    expect(blank.id).toMatch(/^model-custom-/)
    expect(blank.name).toBe('Mô hình 3D tự tạo mới')
    expect(blank.category).toBe('custom')
    expect(blank.scale).toBe(1.0)
    expect(blank.faces).toHaveLength(1)
    expect(blank.faces[0].name).toBe('Mặt chính 1')
    expect(blank.faces[0].position).toEqual([0, 0, 0])
    expect(blank.faces[0].rotation).toEqual([0, 0, 0])
    expect(blank.faces[0].width).toBeGreaterThan(0)
    expect(blank.faces[0].height).toBeGreaterThan(0)
  })

  it('ALL_CREATE_TEMPLATES contains over 20 rich and diverse templates', () => {
    expect(ALL_CREATE_TEMPLATES.length).toBeGreaterThanOrEqual(20)
    
    // Contains classic 4 templates
    const ids = ALL_CREATE_TEMPLATES.map((t) => t.id)
    expect(ids).toContain('template-cottage')
    expect(ids).toContain('template-cube')
    expect(ids).toContain('template-corner')
    expect(ids).toContain('template-room')

    // Contains extended architecture, props, nature, stage templates
    expect(ids).toContain('template-gable-house')
    expect(ids).toContain('template-shop-awning')
    expect(ids).toContain('template-gate')
    expect(ids).toContain('template-tower-8')
    expect(ids).toContain('template-chest-open')
    expect(ids).toContain('template-folding-screen')
    expect(ids).toContain('template-tree-cross')
    expect(ids).toContain('template-diorama')
  })

  it('every template can build a valid Model3D with non-empty faces', () => {
    for (const t of ALL_CREATE_TEMPLATES) {
      const model = t.buildModel()
      expect(model.id).toBeTruthy()
      expect(model.name).toBeTruthy()
      expect(model.faces.length).toBe(t.facesCount)
      expect(model.faces.length).toBeGreaterThan(0)
      for (const face of model.faces) {
        expect(face.id).toBeTruthy()
        expect(face.width).toBeGreaterThan(0)
        expect(face.height).toBeGreaterThan(0)
        expect(face.position).toHaveLength(3)
        expect(face.rotation).toHaveLength(3)
      }
    }
  })

  it('CATEGORY_TABS covers all required categories', () => {
    const tabIds = CATEGORY_TABS.map((t) => t.id)
    expect(tabIds).toEqual(['all', 'architecture', 'props', 'nature', 'stage'])
  })
})
