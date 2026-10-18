import { afterEach, describe, expect, it } from 'vitest'
import { layerPartsCommands } from './layerPartsCommands'
import { registerLayerAssemblySession } from '../../ui/layerAssembly/layerAssemblyBridge'
import type { AssembledLayerItem, LayerComposite } from '../../ui/layerAssembly/types'
import { useEditor } from '../../store/editor'
import { createImageLayer, createProject, createShot } from '../../project/factory'

const run = async (name: string, params: Record<string, unknown>) => layerPartsCommands[name](params as never, {} as never) as Promise<Record<string, unknown>>

const layer = (id: string, extra: Partial<AssembledLayerItem> = {}): AssembledLayerItem => ({
  id, name: id, x: 0, y: 0, z: 0, scale: 1, rotation: 0, opacity: 1,
  motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, ...extra
})

let unregister: (() => void) | null = null
afterEach(() => { unregister?.(); unregister = null })

function openWorkshop(): { get: () => LayerComposite } {
  let comp: LayerComposite = {
    id: 'hero', name: 'Hero', category: 'character', width: 600, height: 900,
    assets: { face_happy: 'hero/face-happy.png' },
    layers: [
      layer('head', { y: -300 }),
      layer('face-normal', { y: -277, hidden: true, assetPath: 'hero/face-normal.png' }),
      layer('face-happy', { y: -276, z: -32, asset: '@face_happy', assetPath: 'hero/face-happy.png' }),
      layer('arm-left', { x: -100 })
    ]
  }
  unregister = registerLayerAssemblySession({
    getComposite: () => comp,
    setComposite: (c) => { comp = typeof c === 'function' ? c(comp) : c },
    getSelectedLayerId: () => null, setSelectedLayerId: () => {}, getSelectedLayerIds: () => [],
    getIsPlaying: () => false, setIsPlaying: () => {}, getTime: () => 0, setTime: () => {},
    save: async () => {}, insertToScene: async () => {}, close: () => {}
  })
  return { get: () => comp }
}

describe('layer_assembly_parts', () => {
  it('auto-detects groups and slots, then moves a locked group together', async () => {
    const ws = openWorkshop()
    const res = await run('layer_assembly_parts', { action: 'auto_detect' })
    const parts = res.parts as { groups: Array<{ id: string; members: unknown[] }>; slots: Array<{ slot: string }> }
    expect(parts.groups.map((g) => g.id).sort()).toEqual(['part-arm-left', 'part-head'])
    expect(parts.slots[0].slot).toBe('face')
    await run('layer_assembly_parts', { action: 'move', layer_id: 'face-happy', x: 10, y: -266 })
    expect(ws.get().layers.find((l) => l.id === 'head')!).toMatchObject({ x: 10, y: -290 })
    await run('layer_assembly_parts', { action: 'lock_group', group_id: 'part-head', locked: false })
    await run('layer_assembly_parts', { action: 'move', layer_id: 'face-happy', x: 0, y: -266 })
    expect(ws.get().layers.find((l) => l.id === 'head')!.x).toBe(10)
  })

  it('activates variants and adds a new variant keeping the anchor', async () => {
    const ws = openWorkshop()
    await run('layer_assembly_parts', { action: 'auto_detect' })
    await run('layer_assembly_parts', { action: 'activate_variant', layer_id: 'face-normal' })
    expect(ws.get().layers.find((l) => l.id === 'face-normal')).toMatchObject({ hidden: false, y: -276, z: -32 })
    const res = await run('layer_assembly_parts', { action: 'replace_asset', layer_id: 'face-normal', asset_path: 'hero/face-cry.png', mode: 'variant' })
    const added = ws.get().layers.find((l) => l.id === res.layerId)!
    expect(added).toMatchObject({ slot: 'face', variant: 'cry', y: -276, hidden: false })
  })

  it('validates parameters', async () => {
    openWorkshop()
    await expect(run('layer_assembly_parts', { action: 'nope' })).rejects.toThrow()
    await expect(run('layer_assembly_parts', { action: 'lock_group', group_id: 'missing' })).rejects.toThrow()
    await expect(run('layer_assembly_parts', { action: 'create_group', layer_ids: ['ghost'] })).rejects.toThrow()
  })
})

describe('swap_composite_part', () => {
  it('lists variants for a scene layer and rejects unknown variants', async () => {
    const proj = createProject({ width: 1920, height: 1080 })
    const shot = createShot('Cảnh 1')
    proj.shots = [shot]
    const img = createImageLayer({ id: 'a1', name: 'face.png', kind: 'image', mime: 'image/png', width: 100, height: 100 }, proj.comp)
    img.id = 'scene-face'
    img.name = '[Hero] face-happy'
    img.shotId = shot.id
    img.composite = { instanceId: 'i1', compositeId: 'missing-template', compositeName: 'Hero', lockedGroup: true }
    proj.layers = [img]
    useEditor.setState({ project: proj, selectedShotId: shot.id })
    const res = await run('swap_composite_part', { layer_id: 'scene-face' })
    expect(res).toMatchObject({ ok: true, variants: [] })
    await expect(run('swap_composite_part', { layer_id: 'scene-face', variant_layer_id: 'x' })).rejects.toThrow()
    await expect(run('swap_composite_part', { layer_id: 'ghost' })).rejects.toThrow()
  })
})
