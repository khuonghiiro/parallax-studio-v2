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

  it('ghi chuyển động vẽ tay qua motion_samples / motion_keys, chỉnh phát lại và xoá', async () => {
    const ws = openWorkshop()
    const samples = Array.from({ length: 91 }, (_, i) => [i / 60, 20 * Math.sin((i / 60) * Math.PI * 2)])
    const added = (await runCommand('layer_assembly_plant_spine', {
      action: 'add', points: [[0, 100], [0, -100]], motion_samples: samples, motion_end: 'loop'
    })) as { spineId: string; spines: Array<{ motion: { key_count: number; duration: number; lag: number } | null }> }
    expect(added.spines[0].motion?.key_count).toBeGreaterThan(2)
    expect(added.spines[0].motion?.duration).toBeGreaterThan(1.3)
    expect(added.spines[0].motion?.lag).toBe(0.08)

    await runCommand('layer_assembly_plant_spine', { action: 'update', spine_id: added.spineId, motion_speed: 2, motion_wind_mix: 0.5 })
    expect(ws.get().plantSpines![0].motion?.speed).toBe(2)
    expect(ws.get().plantSpines![0].motion?.windMix).toBe(0.5)

    await runCommand('layer_assembly_plant_spine', {
      action: 'update', spine_id: added.spineId, motion_keys: [[0, 0], [0.5, 15], [1, -15]], motion_duration: 1.5
    })
    const m = ws.get().plantSpines![0].motion!
    expect(m.keys).toEqual([{ t: 0, angle: 0 }, { t: 0.5, angle: 15 }, { t: 1, angle: -15 }])
    expect(m.duration).toBe(1.5)
    expect(m.speed).toBeUndefined()

    await runCommand('layer_assembly_plant_spine', {
      action: 'update', spine_id: added.spineId, scale_motion: 1.5, mirror_motion: true
    })
    const m2 = ws.get().plantSpines![0].motion!
    expect(m2.keys[1].angle).toBe(-22.5)
    expect(m2.keys[2].angle).toBe(22.5)

    await runCommand('layer_assembly_plant_spine', { action: 'update', spine_id: added.spineId, clear_motion: true })
    expect(ws.get().plantSpines![0].motion).toBeUndefined()
    await expect(runCommand('layer_assembly_plant_spine', { action: 'update', spine_id: added.spineId, motion_lag: 0.2 })).rejects.toThrow()
    await expect(runCommand('layer_assembly_plant_spine', {
      action: 'update', spine_id: added.spineId, motion_keys: [[0, 0], [1, 500]], motion_duration: 2
    })).rejects.toThrow()

  })

  it('supports auto-directional spine generation (direction) and 1-click Beaufort apply_weather', async () => {
    const ws = openWorkshop()
    const weatherInit = (await runCommand('layer_assembly_plant_spine', {
      action: 'apply_weather',
      weather: 'strong',
      lean: 7,
      direction: 'down'
    })) as { spineId: string; spines: Array<{ amplitude: number; lean: number; points: number[][] }> }
    expect(weatherInit.spines).toHaveLength(1)
    expect(weatherInit.spines[0].amplitude).toBe(22)
    expect(weatherInit.spines[0].lean).toBe(7)
    expect(weatherInit.spines[0].points[0][1]).toBeLessThan(weatherInit.spines[0].points[3][1])

    await runCommand('layer_assembly_plant_spine', {
      action: 'add',
      direction: 'horizontal',
      preset: 'branch'
    })
    expect(ws.get().plantSpines).toHaveLength(2)

    await runCommand('layer_assembly_plant_spine', {
      action: 'apply_weather',
      weather: 'storm',
      lean: -10
    })
    expect(ws.get().plantSpines![0].amplitude).toBe(32)
    expect(ws.get().plantSpines![1].amplitude).toBe(32)
    expect(ws.get().plantSpines![1].lean).toBe(-10)

  })
})
