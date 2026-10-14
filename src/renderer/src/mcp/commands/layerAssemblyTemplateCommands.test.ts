import { describe, expect, it } from 'vitest'
import { runCommand } from '../commands'

describe('layerAssemblyTemplateCommands MCP', () => {
  it('exposes the puppet prompt and applies all 15 parts through existing MCP tools', async () => {
    const detail = await runCommand('get_layer_assembly_template', {
      template_id: 'tmpl-character-puppet-15'
    }) as { slots: unknown[]; prompt_guide: { system_prompt: string } }
    expect(detail.slots).toHaveLength(15)
    expect(detail.prompt_guide.system_prompt).toContain('Knee to ankle ONLY')
    const result = await runCommand('apply_layer_assembly_template', {
      template_id: 'tmpl-character-puppet-15', open_workshop: false,
      images: { cell_11: 'left-shin.png', cell_15: 'right-foot.png' }
    }) as { layer_count: number; bone_count: number; composite: { layers: Array<{ id: string; boneId: string; assetPath?: string }> } }
    expect(result.layer_count).toBe(15)
    expect(result.bone_count).toBe(15)
    expect(result.composite.layers.find((l) => l.id === 'layer-shin-l')).toMatchObject({ boneId: 'bone-shin-l', assetPath: 'left-shin.png' })
    expect(result.composite.layers.find((l) => l.id === 'layer-foot-r')?.assetPath).toBe('right-foot.png')
  })

  it('applies the 13-part template with hand and foot images selected by atlas cell', async () => {
    const result = await runCommand('apply_layer_assembly_template', {
      template_id: 'tmpl-character-articulated-13', open_workshop: false,
      images: { cell_6: 'left-hand.png', cell_13: 'data:image/png;base64,Zm9v' }
    }) as { layer_count: number; bone_count: number; composite: { layers: Array<{ id: string; assetPath?: string; imageUrl?: string }> } }
    expect(result.layer_count).toBe(13)
    expect(result.bone_count).toBe(13)
    expect(result.composite.layers.find((l) => l.id === 'layer-hand-l')?.assetPath).toBe('left-hand.png')
    expect(result.composite.layers.find((l) => l.id === 'layer-foot-r')?.imageUrl).toBe('data:image/png;base64,Zm9v')
  })
  it('runs list_layer_assembly_templates and returns all templates', async () => {
    const res = (await runCommand('list_layer_assembly_templates', {})) as {
      count: number
      categories: Array<{ id: string; label: string }>
      templates: Array<{ id: string; name: string; category: string }>
    }

    expect(res.count).toBeGreaterThanOrEqual(14)
    expect(res.categories.length).toBeGreaterThanOrEqual(5)
    expect(res.templates.some((t) => t.id === 'tmpl-character-male-hero')).toBe(true)
    expect(res.templates.some((t) => t.id === 'tmpl-animal-dog')).toBe(true)
    expect(res.templates.some((t) => t.id === 'tmpl-animal-buffalo')).toBe(true)
    expect(res.templates.some((t) => t.id === 'tmpl-character-child-kid')).toBe(true)
  })

  it('filters templates by category and search term', async () => {
    const resCat = (await runCommand('list_layer_assembly_templates', { category: 'animal' })) as {
      count: number
      templates: Array<{ category: string }>
    }
    expect(resCat.templates.every((t) => t.category === 'animal')).toBe(true)
    expect(resCat.count).toBeGreaterThanOrEqual(5)

    const resSearch = (await runCommand('list_layer_assembly_templates', { search: 'chó' })) as {
      templates: Array<{ id: string }>
    }
    expect(resSearch.templates.some((t) => t.id === 'tmpl-animal-dog')).toBe(true)
  })

  it('runs get_layer_assembly_template with valid template ID and returns full prompt and slots', async () => {
    const res = (await runCommand('get_layer_assembly_template', {
      template_id: 'tmpl-character-male-hero'
    })) as {
      id: string
      name: string
      slots: Array<{ id: string; role: string }>
      prompt_guide: { system_prompt: string; cell_layout: string[] }
      clips: Array<{ id: string; name: string }>
    }

    expect(res.id).toBe('tmpl-character-male-hero')
    expect(res.slots.length).toBeGreaterThanOrEqual(10)
    expect(res.prompt_guide.system_prompt).toContain('CHARACTER CUTOUT SPRITE ATLAS')
    expect(res.prompt_guide.cell_layout.length).toBeGreaterThanOrEqual(10)
    expect(res.clips.length).toBeGreaterThanOrEqual(3)
  })

  it('get_layer_assembly_template throws for invalid template ID', async () => {
    await expect(
      runCommand('get_layer_assembly_template', { template_id: 'non-existent' })
    ).rejects.toThrow()
  })

  it('runs apply_layer_assembly_template and binds slot images', async () => {
    const res = (await runCommand('apply_layer_assembly_template', {
      template_id: 'tmpl-animal-dog',
      name: 'Chú chó Shiba của tôi',
      images: {
        head: 'my_dog_head.png',
        tail: 'my_dog_tail.png'
      },
      open_workshop: false,
      save_to_library: true
    })) as {
      ok: boolean
      template_id: string
      name: string
      bound_slots: string[]
      composite: { layers: Array<{ id: string; assetPath?: string }> }
    }

    expect(res.ok).toBe(true)
    expect(res.template_id).toBe('tmpl-animal-dog')
    expect(res.name).toBe('Chú chó Shiba của tôi')
    expect(res.bound_slots).toContain('head')
    expect(res.bound_slots).toContain('tail')

    const headLayer = res.composite.layers.find((l) => l.id.includes('head'))
    expect(headLayer?.assetPath).toBe('my_dog_head.png')
  })

  it('injects custom appearance, costume, and props into get_layer_assembly_template prompt_guide', async () => {
    const res = (await runCommand('get_layer_assembly_template', {
      template_id: 'tmpl-character-shadiao-panda',
      appearance: 'Đầu gấu trúc cười nham hiểm',
      costume: 'Áo đạo bào tím thêu hạc trắng',
      props: 'Cầm gạch ống đỏ'
    })) as {
      prompt_guide: { system_prompt: string }
    }
    expect(res.prompt_guide.system_prompt).toContain('Đầu gấu trúc cười nham hiểm')
    expect(res.prompt_guide.system_prompt).toContain('Áo đạo bào tím thêu hạc trắng')
    expect(res.prompt_guide.system_prompt).toContain('Cầm gạch ống đỏ')
  })
})
