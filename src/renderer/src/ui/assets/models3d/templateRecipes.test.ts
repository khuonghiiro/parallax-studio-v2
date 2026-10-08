import { describe, expect, it } from 'vitest'
import { ASSEMBLY_TEMPLATES } from './assemblyTemplateData'
import { simplifyAspect } from './templateRecipes'
import { imageTemplateGuide } from './imageMeshRecipe'

describe('templateRecipes & 100% template recipe coverage', () => {
  it('simplifies aspect ratios accurately', () => {
    expect(simplifyAspect(600, 400)).toEqual([3, 2])
    expect(simplifyAspect(500, 500)).toEqual([1, 1])
    expect(simplifyAspect(120, 1200)).toEqual([1, 10])
    expect(simplifyAspect(660, 427)).toEqual([660, 427])
  })

  it('matches every image canvas to its assigned faces and never exposes unused slots', () => {
    for (const template of ASSEMBLY_TEMPLATES) {
      const guide = imageTemplateGuide(template)
      expect(guide.slots.reduce((sum, slot) => sum + slot.reuseCount, 0)).toBe(guide.meshFaceCount)
      for (const slot of guide.slots) {
        expect(slot.reuseCount, `${template.id}/${slot.id}`).toBeGreaterThan(0)
        expect(slot.renderPrompt).toContain(slot.alpha.en)
        for (const index of slot.faceIndices) {
          const face = guide.faces[index]
          expect(face.width * slot.aspect[1], `${template.id}/${face.name}`).toBe(face.height * slot.aspect[0])
        }
      }
    }
  })

  it('provides exact gable outlines, different hip roof shapes and handed shed walls', () => {
    const guide = (id: string) => imageTemplateGuide(ASSEMBLY_TEMPLATES.find((t) => t.id === id)!)
    const gable = guide('gable-house')
    expect(gable.slots.find((s) => s.id === 'facade')?.silhouettePolygon).toEqual([
      [0.5, 0], [1, 260 / 660], [1, 1], [0, 1], [0, 260 / 660]
    ])
    const hip = guide('shell-hip-roof').slots.filter((s) => s.id.startsWith('roof'))
    expect(hip.map((s) => s.silhouettePolygon?.length)).toEqual([4, 3])
    const shed = guide('shell-shed-roof').slots.filter((s) => s.id.startsWith('side'))
    expect(shed).toHaveLength(2)
    expect(shed[0].silhouettePolygon).not.toEqual(shed[1].silhouettePolygon)
  })

  it('does not merge unrelated automatic parts just because their ratios match', () => {
    const guide = imageTemplateGuide(ASSEMBLY_TEMPLATES.find((t) => t.id === 'popup-card')!)
    expect(guide.faces[0].imageSlot).not.toBe(guide.faces[1].imageSlot)
  })

  it('guarantees 100% of ASSEMBLY_TEMPLATES have imageRecipe with slots', () => {
    expect(ASSEMBLY_TEMPLATES.length).toBeGreaterThan(50)
    for (const tmpl of ASSEMBLY_TEMPLATES) {
      expect(tmpl.imageRecipe, `Template ${tmpl.id} must have imageRecipe`).toBeDefined()
      expect(tmpl.imageRecipe?.slots.length, `Template ${tmpl.id} must have at least 1 slot`).toBeGreaterThan(0)

      for (const slot of tmpl.imageRecipe!.slots) {
        expect(slot.id).toBeTruthy()
        expect(slot.label).toBeTruthy()
        expect(slot.aspect.length).toBe(2)
        expect(slot.prompt).toBeTruthy()
      }

      const faces = tmpl.faces()
      expect(faces.length, `Template ${tmpl.id} must define faces`).toBeGreaterThan(0)
      for (const face of faces) {
        expect(face.imageSlot, `Face "${face.name}" in template "${tmpl.id}" must have imageSlot`).toBeDefined()
      }
    }
  })

  it('flower template (mesh-flower) has 3 distinct slots: petal, center, stem', () => {
    const flower = ASSEMBLY_TEMPLATES.find((t) => t.id === 'mesh-flower')
    expect(flower).toBeDefined()
    expect(flower!.imageRecipe).toBeDefined()
    const slots = flower!.imageRecipe!.slots
    expect(slots.map((s) => s.id)).toEqual(['petal', 'center', 'stem'])
    expect(slots.find((s) => s.id === 'petal')?.aspect).toEqual([2, 3])
    expect(slots.find((s) => s.id === 'center')?.aspect).toEqual([1, 1])
    expect(slots.find((s) => s.id === 'stem')?.aspect).toEqual([1, 10])
  })
})
