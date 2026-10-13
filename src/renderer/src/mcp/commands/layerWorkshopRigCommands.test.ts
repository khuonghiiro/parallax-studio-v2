import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { layerWorkshopRigCommands } from './layerWorkshopRigCommands'
import { registerLayerAssemblySession } from '../../ui/layerAssembly/layerAssemblyBridge'
import { createWorkshopHistory } from '../../ui/layerAssembly/workshopHistory'
import type { LayerComposite } from '../../ui/layerAssembly/types'

const initial = (): LayerComposite => ({
  id: 'rig-test', name: 'Test', category: 'character', width: 500, height: 600, layers: [],
  rig: { duration: 2, loop: true,
    bones: [{ id: 'root', name: 'Root', x: 0, y: 0, angle: 0, length: 80 }],
    tracks: { root: [
      { time: 0, x: 12, y: 24, rotation: 10, scaleX: 1.2, scaleY: 0.8, easing: 'linear' },
      { time: 2, x: 50, y: 60, rotation: 90, scaleX: 2, scaleY: 3, easing: 'hold' }
    ] }
  }
})

describe('workshop animation commands', () => {
  let history: ReturnType<typeof createWorkshopHistory>
  let unregister: () => void
  const command = (params: Record<string, unknown>) => layerWorkshopRigCommands.layer_assembly_rig(params, { reqId: 'test', method: 'layer_assembly_rig', params })
  const keys = () => history.current.rig!.tracks.root
  beforeEach(() => {
    history = createWorkshopHistory(initial())
    unregister = registerLayerAssemblySession({
      getComposite: () => history.current,
      setComposite: (update) => history.update(typeof update === 'function' ? update(history.current) : update),
      getTime: () => 0, setTime: () => {}, getIsPlaying: () => false, setIsPlaying: () => {},
      getSelectedLayerId: () => null, setSelectedLayerId: () => {},
      save: async () => {}, insertToScene: async () => {}, close: () => {}
    })
  })
  afterEach(() => unregister())

  it('keeps omitted channels and interpolation when changing only rotation', () => {
    command({ action: 'set-key', bone_id: 'root', time: 0, rotation: 45 })
    expect(keys()[0]).toMatchObject({ x: 12, y: 24, rotation: 45, scaleX: 1.2, scaleY: 0.8, easing: 'linear' })
  })
  it('samples the authored endpoint rather than wrapping a partial pose to time zero', () => {
    command({ action: 'set-pose', time: 2, poses: [{ bone_id: 'root', rotation: 120 }] })
    expect(keys()[1]).toMatchObject({ x: 50, y: 60, rotation: 120, scaleX: 2, scaleY: 3, easing: 'hold' })
  })
  it('rejects unknown bones without committing a partial pose', () => {
    expect(() => command({ action: 'set-pose', time: 1, poses: [
      { bone_id: 'root', rotation: 45 }, { bone_id: 'missing', rotation: 90 }
    ] })).toThrow(/bone/i)
    expect(history.canUndo).toBe(false)
    expect(history.current).toEqual(initial())
  })
  it('commits a frame-based batch once and rolls back invalid batches', () => {
    command({ action: 'batch', operations: [
      { action: 'set-key', bone_id: 'root', frame: 15, fps: 30, rotation: 40 },
      { action: 'set-interpolation', bone_id: 'root', frame: 15, fps: 30, easing: 'ease-out' }
    ] })
    expect(keys()[1]).toMatchObject({ time: 0.5, rotation: 40, easing: 'ease-out' })
    history.undo()
    expect(history.current).toEqual(initial())
    expect(history.canUndo).toBe(false)
    expect(() => command({ action: 'batch', operations: [
      { action: 'set-key', bone_id: 'root', time: 0.5, rotation: 20 },
      { action: 'set-key', bone_id: 'missing', time: 1, rotation: 30 }
    ] })).toThrow()
    expect(history.current).toEqual(initial())
  })
  it('moves exact subframe keys without losing destination keys', () => {
    command({ action: 'set-key', bone_id: 'root', time: 1 / 30, rotation: 22 })
    command({ action: 'move-key', bone_id: 'root', time: 1 / 30, target_time: 0.5 })
    expect(keys()[1]).toMatchObject({ time: 0.5, rotation: 22 })
    expect(() => command({ action: 'move-key', bone_id: 'root', time: 0.5, target_time: 2 })).toThrow(/occupied/i)
    expect(keys()).toHaveLength(3)
  })
  it('requires fps for frames and rejects conflicting units or invalid curves', () => {
    expect(() => command({ action: 'set-key', bone_id: 'root', frame: 12 })).toThrow(/fps/i)
    expect(() => command({ action: 'set-key', bone_id: 'root', frame: 12, time: 1, fps: 30 })).toThrow()
    expect(() => command({ action: 'set-interpolation', bone_id: 'root', time: 0,
      easing: 'bezier', bezier: [-1, 0, 1, 1] })).toThrow()
  })
})
