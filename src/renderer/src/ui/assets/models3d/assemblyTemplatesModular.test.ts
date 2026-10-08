import { describe, expect, it } from 'vitest'
import { ASSEMBLY_TEMPLATES, TEMPLATE_CATEGORIES } from './assemblyTemplateData'
import { HOUSE_SHELLS } from './assemblyTemplatesShells'
import { DECOR_PARTS } from './assemblyTemplatesDecor'
import { templateFaces } from './assemblyTemplates'
import { WALL_ANCHOR } from './assemblyTemplateKit'
import { modelBounds } from './assemblyGeometry'

describe('modular templates (house shells + decor parts)', () => {
  it('every template has a synced English label/hint for MCP agents', () => {
    expect(ASSEMBLY_TEMPLATES.length).toBeGreaterThanOrEqual(45)
    for (const t of ASSEMBLY_TEMPLATES) {
      expect(t.label.trim(), t.id).not.toBe('')
      expect(t.hint.trim(), t.id).not.toBe('')
      expect(t.en.label.trim(), t.id).not.toBe('')
      expect(t.en.hint.trim(), t.id).not.toBe('')
      expect(TEMPLATE_CATEGORIES.some((c) => c.id === t.category)).toBe(true)
    }
  })

  it('house shells are walls + roof only, no decoration planes', () => {
    expect(HOUSE_SHELLS.length).toBeGreaterThanOrEqual(6)
    for (const t of HOUSE_SHELLS) {
      expect(t.category).toBe('architecture')
      const names = t.faces().map((f) => f.name).join(' ')
      expect(names, t.id).not.toMatch(/cửa|hoa|chậu|đèn|window|door/i)
    }
  })

  it('decor parts declare an anchor and sit on the wall plane (z ≤ 0 side)', () => {
    expect(DECOR_PARTS.length).toBeGreaterThanOrEqual(12)
    for (const t of DECOR_PARTS) {
      expect(t.category).toBe('decor')
      expect(t.anchor?.trim(), t.id).toBeTruthy()
      const b = modelBounds(templateFaces(t))!
      if (t.anchor === WALL_ANCHOR) {
        // Wall parts protrude toward the viewer; nothing pokes far behind the wall.
        expect(b.max[2], t.id).toBeLessThanOrEqual(1)
        expect(b.min[2], t.id).toBeLessThan(0)
      }
    }
  })

  it('categories are listed once, with both languages', () => {
    expect(TEMPLATE_CATEGORIES.map((c) => c.id)).toEqual(['architecture', 'decor', 'props', 'nature', 'stage'])
    for (const c of TEMPLATE_CATEGORIES) expect(c.label && c.en).toBeTruthy()
  })
})
