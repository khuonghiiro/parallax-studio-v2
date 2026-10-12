import { describe, expect, it } from 'vitest'
import { validateRig } from '../workshopRig'
import {
  ALL_LAYER_TEMPLATES,
  findLayerTemplate,
  buildCompositeFromTemplate,
  LAYER_TEMPLATE_CATEGORY_TABS
} from './index'

describe('Layer Assembly Templates Catalog', () => {
  it('provides a complete 15-part puppet with separate knee and ankle chains', () => {
    const template = findLayerTemplate('tmpl-character-puppet-15')!
    const composite = template.buildComposite()
    expect(composite.layers).toHaveLength(15)
    expect(composite.rig!.bones).toHaveLength(15)
    expect(composite.layers.every((layer) => layer.imageUrl?.startsWith('data:image/svg+xml'))).toBe(true)
    for (const side of ['l', 'r']) {
      expect(composite.rig!.bones.find((b) => b.id === `bone-shin-${side}`)?.parentId).toBe(`bone-thigh-${side}`)
      expect(composite.rig!.bones.find((b) => b.id === `bone-foot-${side}`)?.parentId).toBe(`bone-shin-${side}`)
      const walk = composite.rig!.clips!.find((clip) => clip.id === 'clip-walk')!
      expect(new Set(walk.tracks[`bone-shin-${side}`].map((key) => key.rotation)).size).toBeGreaterThan(1)
    }
  })

  it('removes conflicting legacy layouts and describes only real import slots', () => {
    for (const template of ALL_LAYER_TEMPLATES.filter((t) => t.category === 'character')) {
      const prompt = template.promptGuide.systemPrompt
      expect(prompt).not.toMatch(/16:9|3840x2160|COLUMN 1|Cell 23|5x5 EQUAL CELLS/)
      expect(prompt).toContain('Exactly 5 rows x 5 columns')
      expect(prompt).toContain(`Exactly ${template.slots.length} isolated parts`)
      expect(prompt).toContain('no blur, glow, fringe')
      expect(template.promptGuide.userGuide).not.toContain('slice_atlas.py')
      const assignments = [...prompt.matchAll(/^(\d+)\. .*?\[([^\]]+)\]/gm)]
      expect(assignments.map((match) => `${match[1]}:${match[2]}`).sort()).toEqual(
        template.slots.map((slot) => `${slot.atlasCell}:${slot.id}`).sort()
      )
    }
    const prompt = findLayerTemplate('tmpl-character-puppet-15')!.promptGuide.systemPrompt
    expect(prompt).toContain('Knee to ankle ONLY; NO thigh, foot, shoe or sole')
    expect(prompt).toContain('Elbow to wrist ONLY; NO upper arm, hand, fingers or held prop')
  })

  it('ships 13 independent illustrated parts with working wrist and ankle chains', () => {
    const template = findLayerTemplate('tmpl-character-articulated-13')!
    const composite = buildCompositeFromTemplate(template)
    expect(composite.layers).toHaveLength(13)
    expect(composite.rig?.bones).toHaveLength(13)
    expect(composite.layers.every((layer) => layer.imageUrl?.startsWith('data:image/svg+xml'))).toBe(true)
    for (const side of ['l', 'r']) {
      expect(composite.rig?.bones.find((b) => b.id === `bone-hand-${side}`)?.parentId).toBe(`bone-forearm-${side}`)
      expect(composite.rig?.bones.find((b) => b.id === `bone-foot-${side}`)?.parentId).toBe(`bone-thigh-${side}`)
      expect(composite.layers.find((l) => l.id === `layer-hand-${side}`)?.boneId).toBe(`bone-hand-${side}`)
      expect(composite.layers.find((l) => l.id === `layer-foot-${side}`)?.boneId).toBe(`bone-foot-${side}`)
    }
    const wave = composite.rig!.clips!.find((clip) => clip.id === 'clip-wave')!
    expect(new Set(wave.tracks['bone-hand-r'].map((key) => key.rotation)).size).toBeGreaterThan(1)
  })

  it('keeps atlas cells, prompt and every rig structurally consistent', () => {
    for (const template of ALL_LAYER_TEMPLATES) {
      const cells = template.slots.map((slot) => slot.atlasCell)
      expect(new Set(cells).size, template.id).toBe(cells.length)
      expect(cells.every((cell) => Number.isInteger(cell) && cell! >= 1 && cell! <= 25)).toBe(true)
      expect(template.promptGuide.cellLayout).toHaveLength(template.slots.length)
      for (const slot of template.slots) {
        expect(template.promptGuide.systemPrompt).toContain(`${slot.atlasCell}. ${slot.nameEn} [${slot.id}]`)
      }
      const composite = buildCompositeFromTemplate(template)
      expect(() => validateRig(composite), template.id).not.toThrow()
      for (const clip of composite.rig?.clips ?? []) {
        expect(() => validateRig({ ...composite, rig: { ...composite.rig!, ...clip } }), template.id).not.toThrow()
      }
    }
  })

  it('isolates edits between drafts and the catalog', () => {
    for (const template of ALL_LAYER_TEMPLATES) {
      const first = buildCompositeFromTemplate(template)
      const second = buildCompositeFromTemplate(template)
      first.layers[0].motion.amplitude = 999
      expect(second.layers[0].motion.amplitude).not.toBe(999)
      if (first.rig) {
        first.rig.bones[0].x = 9999
        expect(second.rig!.bones[0].x).not.toBe(9999)
        expect(template.bones[0].x).not.toBe(9999)
      }
    }
  })
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
