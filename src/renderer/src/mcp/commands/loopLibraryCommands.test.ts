import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditor } from '../../store/editor'
import { getBuiltinLoopTemplates, saveLoopTemplate } from '../../ui/loopAnimator/loopAnimatorStorage'
import { useLoopAnimator } from '../../ui/loopAnimator/loopAnimatorState'
import { loopAnimatorCommands } from './loopAnimatorCommands'

const run = async (name: string, params: Record<string, unknown> = {}): Promise<Record<string, any>> =>
  (await loopAnimatorCommands[name](params, { reqId: 't', method: name, params })) as Record<string, any>

function mockStorage(): void {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    }
  })
}

describe('MCP loop library commands', () => {
  beforeEach(() => {
    mockStorage()
    useEditor.getState().update((d) => {
      d.layers = d.layers.filter((l) => !l.id.startsWith('mcp_loop_'))
    })
  })

  it('open_loop_animator blank=true starts an empty session', async () => {
    await run('open_loop_animator', { preset_id: getBuiltinLoopTemplates()[0].id })
    const res = await run('open_loop_animator', { blank: true })
    expect(res.ok).toBe(true)
    expect(res.image_url).toBeNull()
    expect(res.frames_count).toBe(0)
    expect(useLoopAnimator.getState().activePresetId).toBeNull()
  })

  it('lists templates, reports usages, requires force, then deletes', async () => {
    const tpl = saveLoopTemplate({ ...getBuiltinLoopTemplates()[0], id: 'mcp_tpl', name: 'Mẫu MCP', isBuiltin: false })
    const shotId = useEditor.getState().project.shots[0]?.id ?? ''
    useEditor.getState().update((d) => {
      d.layers.push({ id: 'mcp_loop_a', type: 'image', name: 'A', shotId, props: { loopTemplateId: tpl.id } } as unknown as (typeof d.layers)[number])
      d.layers.push({ id: 'mcp_loop_b', type: 'image', name: 'B', shotId, props: { loopTemplateId: tpl.id } } as unknown as (typeof d.layers)[number])
    })

    const list = await run('list_loop_templates')
    expect(list.templates.find((t: { id: string }) => t.id === tpl.id)?.usages_count).toBe(2)

    const usages = await run('get_loop_template_usages', { template_id: tpl.id })
    expect(usages.total).toBe(2)

    const blocked = await run('delete_loop_template', { template_id: tpl.id })
    expect(blocked.ok).toBe(false)
    expect(blocked.requires_force).toBe(true)

    const detached = await run('detach_loop_template_usage', { template_id: tpl.id, layer_id: 'mcp_loop_a' })
    expect(detached).toMatchObject({ ok: true, action: 'detached', remaining: 1 })

    const removed = await run('detach_loop_template_usage', { template_id: tpl.id, layer_id: 'mcp_loop_b', remove_layer: true })
    expect(removed).toMatchObject({ ok: true, action: 'removed_layer', remaining: 0 })
    expect(useEditor.getState().project.layers.some((l) => l.id === 'mcp_loop_b')).toBe(false)

    const deleted = await run('delete_loop_template', { template_id: tpl.id })
    expect(deleted).toMatchObject({ ok: true, detached: 0 })
    await expect(run('get_loop_template_usages', { template_id: tpl.id })).rejects.toThrow()
  })
})
