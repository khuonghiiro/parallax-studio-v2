import { describe, expect, it } from 'vitest'
import {
  ALL_LAYER_TEMPLATES,
  findLayerTemplate,
  buildCompositeFromTemplate,
  LAYER_TEMPLATE_CATEGORY_TABS
} from './index'

describe('Layer Assembly Templates Catalog', () => {
  it('contains at least 14 templates covering characters, animals, nature, and architecture', () => {
    expect(ALL_LAYER_TEMPLATES.length).toBeGreaterThanOrEqual(14)
    const ids = ALL_LAYER_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ALL_LAYER_TEMPLATES.length)
  })

  it('contains humanoid templates across all requested age groups', () => {
    const ageGroups = ALL_LAYER_TEMPLATES.filter((t) => t.category === 'character').map((t) => t.ageGroup)
    expect(ageGroups).toContain('child')
    expect(ageGroups).toContain('youth')
    expect(ageGroups).toContain('adult')
    expect(ageGroups).toContain('middleaged')
    expect(ageGroups).toContain('elderly')
  })

  it('contains animal templates for dog, buffalo, cat, fish, and rooster', () => {
    const animalIds = ALL_LAYER_TEMPLATES.filter((t) => t.category === 'animal').map((t) => t.id)
    expect(animalIds).toContain('tmpl-animal-dog')
    expect(animalIds).toContain('tmpl-animal-buffalo')
    expect(animalIds).toContain('tmpl-animal-cat')
    expect(animalIds).toContain('tmpl-animal-fish')
    expect(animalIds).toContain('tmpl-animal-rooster')
  })

  it('every template has a valid prompt guide with non-empty system prompt and cell layout', () => {
    for (const tmpl of ALL_LAYER_TEMPLATES) {
      expect(tmpl.name.trim()).not.toBe('')
      expect(tmpl.description.trim()).not.toBe('')
      expect(tmpl.slots.length).toBeGreaterThanOrEqual(3)
      expect(tmpl.promptGuide.systemPrompt.trim().length).toBeGreaterThan(50)
      expect(tmpl.promptGuide.cellLayout.length).toBeGreaterThanOrEqual(3)
      expect(tmpl.promptGuide.userGuide.trim()).not.toBe('')
    }
  })

  it('buildComposite() returns a valid LayerComposite with proper dimensions and layers', () => {
    for (const tmpl of ALL_LAYER_TEMPLATES) {
      const comp = buildCompositeFromTemplate(tmpl, { head: 'custom_head.png' })
      expect(comp.id).toMatch(/^comp-/)
      expect(comp.width).toBeGreaterThanOrEqual(400)
      expect(comp.height).toBeGreaterThanOrEqual(400)
      expect(comp.layers.length).toBe(tmpl.slots.length)

      const headSlot = tmpl.slots.find((s) => s.id === 'head' || s.role === 'head')
      if (headSlot) {
        const headLayer = comp.layers.find((l) => l.id === `layer-${headSlot.id}`)
        expect(headLayer?.assetPath).toBe('custom_head.png')
      }
    }
  })

  it('findLayerTemplate finds templates case-insensitively and returns undefined for unknown', () => {
    expect(findLayerTemplate('tmpl-character-male-hero')).toBeDefined()
    expect(findLayerTemplate('TMPL-ANIMAL-DOG')).toBeDefined()
    expect(findLayerTemplate('unknown-template-xyz')).toBeUndefined()
  })

  it('category tabs match template categories', () => {
    const cats = new Set(ALL_LAYER_TEMPLATES.map((t) => t.category))
    for (const cat of cats) {
      expect(LAYER_TEMPLATE_CATEGORY_TABS.some((tab) => tab.id === cat)).toBe(true)
    }
  })
})
