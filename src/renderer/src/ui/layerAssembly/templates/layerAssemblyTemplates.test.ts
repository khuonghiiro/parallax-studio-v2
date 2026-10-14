import { describe, expect, it } from 'vitest'
import { validateRig } from '../workshopRig'
import {
  ALL_LAYER_TEMPLATES,
  findLayerTemplate,
  buildCompositeFromTemplate,
  LAYER_TEMPLATE_CATEGORY_TABS
} from './index'

describe('Layer Assembly Templates Catalog', () => {
  it('provides 2 13-part 2.5D anime cutout character templates at 1:1 native pixel scale with faceless head and swappable expressions', () => {
    const front = findLayerTemplate('tmpl-character-front')!
    const quarter = findLayerTemplate('tmpl-character-quarter')!

    expect(front).toBeDefined()
    expect(quarter).toBeDefined()

    expect(front.slots).toHaveLength(13)
    expect(quarter.slots).toHaveLength(13)

    for (const tmpl of [front, quarter]) {
      // Every slot uses scale: 1 (100% native pixel proportions, zero resizing)
      expect(tmpl.slots.every((s) => s.defaultTransform.scale === 1)).toBe(true)

      const comp = buildCompositeFromTemplate(tmpl)
      const faceNormal = comp.layers.find((l) => l.id === 'layer-face-normal')
      const faceHappy = comp.layers.find((l) => l.id === 'layer-face-happy')
      const glasses = comp.layers.find((l) => l.id === 'layer-glasses')

      expect(Boolean(faceNormal?.hidden)).toBe(false)
      expect(faceHappy?.hidden).toBe(true)
      expect(Boolean(glasses?.hidden)).toBe(false)
    }

    // All layers use real PNG cutout assets (no fake inline data:image/svg+xml placeholders)
    for (const tmpl of ALL_LAYER_TEMPLATES) {
      const comp = buildCompositeFromTemplate(tmpl)
      expect(comp.layers.every((l) => Boolean(l.assetPath) && !l.imageUrl?.startsWith('data:image/svg+xml'))).toBe(true)
    }
  })

  it('removes conflicting legacy layouts and describes only real import slots', () => {
    for (const template of ALL_LAYER_TEMPLATES.filter((t) => t.category === 'character')) {
      const prompt = template.promptGuide.systemPrompt
      expect(prompt).not.toMatch(/16:9|3840x2160|COLUMN 1|Cell 23|5x5 EQUAL CELLS/)
      expect(prompt).toContain('Exactly 5 rows x 5 columns')
      expect(prompt).not.toMatch(/\b\d{3,5}[x×]\d{3,5}\b/)
      expect(template.promptGuide.aspectRatio).toBe('1:1')
      expect(template.promptGuide.recommendedResolution).toBe('model-native')
      expect(prompt).toContain(`Exactly ${template.slots.length} isolated parts`)
      expect(prompt).toContain('no blur, glow, fringe')
      expect(template.promptGuide.userGuide).not.toContain('slice_atlas.py')
      const assignments = [...prompt.matchAll(/^(\d+)\. .*?\[([^\]]+)\]/gm)]
      expect(assignments.map((match) => `${match[1]}:${match[2]}`).sort()).toEqual(
        template.slots.map((slot) => `${slot.atlasCell}:${slot.id}`).sort()
      )
    }
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

  it('contains the 5 retained curated real-cutout templates (2 characters + 3 nature presets)', () => {
    expect(ALL_LAYER_TEMPLATES.length).toBe(5)
    const ids = ALL_LAYER_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ALL_LAYER_TEMPLATES.length)
    expect(ids).toEqual([
      'tmpl-character-front',
      'tmpl-character-quarter',
      'tmpl-nature-modular-tree',
      'tmpl-nature-modular-rock',
      'tmpl-nature-bonsai'
    ])
  })

  it('every template has a valid prompt guide with non-empty system prompt and cell layout', () => {
    for (const tmpl of ALL_LAYER_TEMPLATES) {
      expect(tmpl.name.trim()).not.toBe('')
      expect(tmpl.description.trim()).not.toBe('')
      expect(tmpl.slots.length).toBeGreaterThanOrEqual(5)
      expect(tmpl.promptGuide.systemPrompt.trim().length).toBeGreaterThan(50)
      expect(tmpl.promptGuide.cellLayout.length).toBeGreaterThanOrEqual(5)
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

  it('findLayerTemplate finds templates case-insensitively and supports legacy aliases', () => {
    expect(findLayerTemplate('tmpl-character-front')).toBeDefined()
    expect(findLayerTemplate('tmpl-character-male-hero')?.id).toBe('tmpl-character-front')
    expect(findLayerTemplate('TMPL-NATURE-BONSAI')).toBeDefined()
    expect(findLayerTemplate('unknown-template-xyz')).toBeUndefined()
  })

  it('category tabs match template categories', () => {
    const cats = new Set(ALL_LAYER_TEMPLATES.map((t) => t.category))
    for (const cat of cats) {
      expect(LAYER_TEMPLATE_CATEGORY_TABS.some((tab) => tab.id === cat)).toBe(true)
    }
  })

  it('provides a default visual asset for every slot in every template so no layer renders as an empty placeholder box', () => {
    for (const tmpl of ALL_LAYER_TEMPLATES) {
      const comp = buildCompositeFromTemplate(tmpl)
      for (const layer of comp.layers) {
        expect(Boolean(layer.imageUrl || layer.assetPath), `${tmpl.id}:${layer.id}`).toBe(true)
      }
    }
  })

  it('merges user character appearance, costume, and props into the AI prompt and cell assignments', async () => {
    const { buildTemplatePromptWithBrief } = await import('./characterPrompt')
    const tmpl = findLayerTemplate('tmpl-character-front')!
    const customPrompt = buildTemplatePromptWithBrief(tmpl, {
      appearance: 'Nam kiếm khách tóc đen buộc cao, mắt sắc lạnh',
      costume: 'Hoàng bào rồng vàng cổ trang và hài thêu rồng',
      props: 'Cầm quạt xếp thiết phiến và đeo kiếm báu'
    })
    expect(customPrompt).toContain('USER CHARACTER & COSTUME SPECIFICATION')
    expect(customPrompt).toContain('Nam kiếm khách tóc đen buộc cao, mắt sắc lạnh')
    expect(customPrompt).toContain('Hoàng bào rồng vàng cổ trang và hài thêu rồng')
    expect(customPrompt).toContain('Cầm quạt xếp thiết phiến và đeo kiếm báu')
    expect(customPrompt).toContain('Match user\'s described appearance/hair/facial style: "Nam kiếm khách tóc đen buộc cao, mắt sắc lạnh"')
    expect(customPrompt).toContain('Draw wearing user\'s described outfit/clothing: "Hoàng bào rồng vàng cổ trang và hài thêu rồng"')
    expect(customPrompt).toContain('Match user\'s described accessory/weapon/prop: "Cầm quạt xếp thiết phiến và đeo kiếm báu"')
  })

  it('enforces full 4-corner unclipped margins, trunk-to-root continuity, and canopy-conforming fruit/blossom leaf blending in nature prompts', async () => {
    const { buildTemplatePromptWithBrief } = await import('./characterPrompt')
    const treeTmpl = findLayerTemplate('tmpl-nature-modular-tree')!
    const rockTmpl = findLayerTemplate('tmpl-nature-modular-rock')!

    const treePrompt = treeTmpl.promptGuide.systemPrompt
    expect(treePrompt).toContain('COMPLETE 4-CORNER UNCLIPPED MOSSY ROOT HILLOCK & SEAMLESS TRUNK BASE CONTINUITY')
    expect(treePrompt).toContain('CANOPY-CONFORMING RIPE RED APPLES OVERLAY (SEAMLESS FOLIAGE & LEAF BLEND)')
    expect(treePrompt).toContain('CANOPY-CONFORMING BLOSSOM CLUSTERS OVERLAY (SEAMLESS FOLIAGE FIT, NO BUSH STEMS)')
    expect(treePrompt).toContain('ZERO EDGE CLIPPING — FULL 4-CORNER SILHOUETTES')

    const rockPrompt = rockTmpl.promptGuide.systemPrompt
    expect(rockPrompt).toContain('COMPLETE 4-CORNER UNCLIPPED EARTHEN TURF & STONE BASE MOUND')
    expect(rockPrompt).toContain('NEVER slice the left or right ends vertically flat')

    const customTreePrompt = buildTemplatePromptWithBrief(treeTmpl, {
      appearance: 'Gốc rễ cổ thụ rêu xanh bo tròn 4 góc',
      costume: 'Tán lá xanh ngọc bích bồng bềnh',
      props: 'Quả táo đỏ chín mọng cài lá xanh'
    })
    expect(customTreePrompt).toContain('USER NATURE & PROP CUSTOMIZATION')
    expect(customTreePrompt).toContain('Gốc rễ cổ thụ rêu xanh bo tròn 4 góc')
  })
})
