import { describe, expect, it } from 'vitest'
import { runCommand } from '../commands'

describe('layerAssemblyTemplateCommands MCP', () => {
  it('exposes the 13-part human character templates and applies all 13 parts through MCP tools', async () => {
    const detail = (await runCommand('get_layer_assembly_template', {
      template_id: 'tmpl-character-front'
    })) as { slots: unknown[]; prompt_guide: { system_prompt: string } }
    expect(detail.slots).toHaveLength(13)
    expect(detail.prompt_guide.system_prompt).toContain('FACELESS')

    const result = (await runCommand('apply_layer_assembly_template', {
      template_id: 'tmpl-character-front',
      open_workshop: false,
      images: { cell_11: 'left-shin.png', cell_2: 'custom-glasses.png' }
    })) as {
      layer_count: number
      bone_count: number
      composite: { layers: Array<{ id: string; boneId: string; assetPath?: string }> }
    }
    expect(result.layer_count).toBe(13)
    expect(result.bone_count).toBe(15)
    expect(result.composite.layers.find((l) => l.id === 'layer-shin-l')).toMatchObject({
      boneId: 'bone-shin-l',
      assetPath: 'left-shin.png'
    })
    expect(result.composite.layers.find((l) => l.id === 'layer-glasses')?.assetPath).toBe('custom-glasses.png')
  })

  it('applies the similar academy student character template with custom forearm and glasses images selected by atlas cell', async () => {
    const result = (await runCommand('apply_layer_assembly_template', {
      template_id: 'tmpl-character-quarter',
      open_workshop: false,
      images: { cell_8: 'left-forearm.png', cell_2: 'data:image/png;base64,Zm9v' }
    })) as {
      layer_count: number
      bone_count: number
      composite: { layers: Array<{ id: string; assetPath?: string; imageUrl?: string }> }
    }
    expect(result.layer_count).toBe(13)
    expect(result.bone_count).toBe(15)
    expect(result.composite.layers.find((l) => l.id === 'layer-forearm-l')?.assetPath).toBe('left-forearm.png')
    expect(result.composite.layers.find((l) => l.id === 'layer-glasses')?.imageUrl).toBe('data:image/png;base64,Zm9v')
  })

  it('runs list_layer_assembly_templates and returns the 5 curated templates', async () => {
    const res = (await runCommand('list_layer_assembly_templates', {})) as {
      count: number
      categories: Array<{ id: string; label: string }>
      templates: Array<{ id: string; name: string; category: string }>
    }

    expect(res.count).toBe(5)
    expect(res.categories.length).toBeGreaterThanOrEqual(3)
    expect(res.templates.some((t) => t.id === 'tmpl-character-front')).toBe(true)
    expect(res.templates.some((t) => t.id === 'tmpl-character-quarter')).toBe(true)
    expect(res.templates.some((t) => t.id === 'tmpl-nature-modular-tree')).toBe(true)
    expect(res.templates.some((t) => t.id === 'tmpl-nature-modular-rock')).toBe(true)
    expect(res.templates.some((t) => t.id === 'tmpl-nature-bonsai')).toBe(true)
  })

  it('filters templates by category and search term', async () => {
    const resCat = (await runCommand('list_layer_assembly_templates', { category: 'nature' })) as {
      count: number
      templates: Array<{ category: string }>
    }
    expect(resCat.templates.every((t) => t.category === 'nature')).toBe(true)
    expect(resCat.count).toBe(3)

    const resSearch = (await runCommand('list_layer_assembly_templates', { search: 'bonsai' })) as {
      templates: Array<{ id: string }>
    }
    expect(resSearch.templates.some((t) => t.id === 'tmpl-nature-bonsai')).toBe(true)
  })

  it('runs get_layer_assembly_template with valid template ID (including legacy alias) and returns full prompt and slots', async () => {
    const res = (await runCommand('get_layer_assembly_template', {
      template_id: 'tmpl-character-male-hero'
    })) as {
      id: string
      name: string
      slots: Array<{ id: string; role: string }>
      prompt_guide: { system_prompt: string; cell_layout: string[] }
      clips: Array<{ id: string; name: string }>
    }

    expect(res.id).toBe('tmpl-character-front')
    expect(res.slots.length).toBe(13)
    expect(res.prompt_guide.system_prompt).toContain('CHARACTER CUTOUT SPRITE ATLAS')
    expect(res.prompt_guide.cell_layout.length).toBe(13)
    expect(res.clips.length).toBeGreaterThanOrEqual(3)
  })

  it('get_layer_assembly_template throws for invalid template ID', async () => {
    await expect(
      runCommand('get_layer_assembly_template', { template_id: 'non-existent' })
    ).rejects.toThrow()
  })

  it('runs apply_layer_assembly_template and binds slot images', async () => {
    const res = (await runCommand('apply_layer_assembly_template', {
      template_id: 'tmpl-nature-bonsai',
      name: 'Cây Bonsai của tôi',
      images: {
        'bonsai-pot': 'my_pot.png',
        'bonsai-trunk': 'my_trunk.png'
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
    expect(res.template_id).toBe('tmpl-nature-bonsai')
    expect(res.name).toBe('Cây Bonsai của tôi')
    expect(res.bound_slots).toContain('bonsai-pot')
    expect(res.bound_slots).toContain('bonsai-trunk')

    const potLayer = res.composite.layers.find((l) => l.id.includes('bonsai-pot'))
    expect(potLayer?.assetPath).toBe('my_pot.png')
  })

  it('injects custom appearance, costume, and props into get_layer_assembly_template prompt_guide', async () => {
    const res = (await runCommand('get_layer_assembly_template', {
      template_id: 'tmpl-character-front',
      appearance: 'Nam kiếm khách tóc dài buộc cao',
      costume: 'Áo đạo bào tím thêu hạc trắng',
      props: 'Cầm trường kiếm phát sáng'
    })) as {
      prompt_guide: { system_prompt: string }
    }
    expect(res.prompt_guide.system_prompt).toContain('Nam kiếm khách tóc dài buộc cao')
    expect(res.prompt_guide.system_prompt).toContain('Áo đạo bào tím thêu hạc trắng')
    expect(res.prompt_guide.system_prompt).toContain('Cầm trường kiếm phát sáng')
  })
})
