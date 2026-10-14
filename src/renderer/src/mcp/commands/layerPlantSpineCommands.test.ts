import { afterEach, describe, expect, it } from 'vitest'
import { layerPlantSpineCommands } from './layerPlantSpineCommands'

const runCommand = async (name: string, params: Record<string, unknown>) =>
  layerPlantSpineCommands[name](params as never, {} as never)
import { registerLayerAssemblySession } from '../../ui/layerAssembly/layerAssemblyBridge'
import type { LayerComposite } from '../../ui/layerAssembly/types'

const layer = (id: string) => ({
  id, name: id, x: 0, y: 0, z: 0, scale: 1, rotation: 0, opacity: 1,
  motion: { type: 'sway' as const, speed: 1, amplitude: 4, anchor: 'bottom' as const }
})

let unregister: (() => void) | null = null
afterEach(() => { unregister?.(); unregister = null })

function openWorkshop(): { get: () => LayerComposite } {
  let comp: LayerComposite = {
    id: 'c', name: 'Cây', category: 'nature', width: 400, height: 400,
    layers: [layer('trunk'), layer('leaves')]
  }
  unregister = registerLayerAssemblySession({
    getComposite: () => comp,
    setComposite: (c) => { comp = typeof c === 'function' ? c(comp) : c },
    getSelectedLayerId: () => 'leaves',
    setSelectedLayerId: () => {},
    getSelectedLayerIds: () => ['leaves'],
    getIsPlaying: () => false,
    setIsPlaying: () => {},
    getTime: () => 0,
    setTime: () => {},
    save: async () => {},
    insertToScene: async () => {},
    close: () => {}
  })
  return { get: () => comp }
}

describe('layer_assembly_plant_spine', () => {
  it('adds a spine bound to all layers, updates and deletes it', async () => {
    const ws = openWorkshop()
    const added = (await runCommand('layer_assembly_plant_spine', {
      action: 'add', points: [[0, 150], [4, 50], [-2, -60]], apply_to: 'all', preset: 'canopy', amplitude: 5
    })) as { spineId: string; spines: Array<{ layer_ids: string[]; amplitude: number; stiffness: number }> }
    expect(added.spines[0].layer_ids).toEqual(['trunk', 'leaves'])
    expect(added.spines[0].amplitude).toBe(5)
    expect(added.spines[0].stiffness).toBe(0.7)
    expect(ws.get().layers.every((l) => l.motion.type === 'none')).toBe(true)

    await runCommand('layer_assembly_plant_spine', { action: 'update', spine_id: added.spineId, turbulence: 0.9, phase_offset: 0.5 })
    expect(ws.get().plantSpines![0].turbulence).toBe(0.9)
    expect(ws.get().plantSpines![0].phaseOffset).toBe(0.5)

    const listed = (await runCommand('layer_assembly_plant_spine', { action: 'list' })) as { spines: unknown[] }
    expect(listed.spines).toHaveLength(1)

    await runCommand('layer_assembly_plant_spine', { action: 'delete', spine_id: added.spineId })
    expect(ws.get().plantSpines).toEqual([])
  })

  it('binds to the selected layer by default and validates input', async () => {
    const ws = openWorkshop()
    await runCommand('layer_assembly_plant_spine', { action: 'add', points: [[0, 100], [0, -100]] })
    expect(ws.get().plantSpines![0].layerIds).toEqual(['leaves'])
    await expect(runCommand('layer_assembly_plant_spine', { action: 'add' })).rejects.toThrow()
    await expect(runCommand('layer_assembly_plant_spine', { action: 'add', points: [[0, 0], [0, -50]], preset: 'cactus' })).rejects.toThrow()
    await expect(runCommand('layer_assembly_plant_spine', { action: 'update', spine_id: 'missing', amplitude: 3 })).rejects.toThrow()
  })
})
