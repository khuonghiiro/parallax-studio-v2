import { describe, expect, it } from 'vitest'
import { runCommand } from '../commands'

describe('layerAssemblyTemplateCommands MCP', () => {
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
})
