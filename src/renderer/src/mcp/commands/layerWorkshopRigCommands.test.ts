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
  it('supports Moho/Adobe Animate fps, scale_keys, hold-frames, snap-joints and view_angle presets via MCP', () => {
    command({ action: 'settings', fps: 24, duration: 4, scale_keys: true })
    expect(history.current.rig?.fps).toBe(24)
    expect(history.current.rig?.duration).toBe(4)
    expect(keys()[1].time).toBeCloseTo(4, 3)

    command({ action: 'hold-frames', time: 0, hold_frames: 6, fps: 24 })
    expect(history.current.rig?.duration).toBeCloseTo(4.25, 3)

    command({ action: 'add-bone', bone_id: 'child', parent_id: 'root', x: 95, y: 12, length: 45, angle: 0 })
    command({ action: 'snap-joints' })
    const rootBone = history.current.rig!.bones.find((b) => b.id === 'root')!
    expect(rootBone.length).toBeCloseTo(Math.hypot(95, 12), 1)

    command({ action: 'apply-template', template: 'humanoid' })
    command({ action: 'apply-preset-animation', preset: 'bow', view_angle: 'front' })
    expect(history.current.rig?.tracks['bone-torso']?.[1]?.rotation).toBe(0)
  })

  it('dựng khung xương sinh vật, chuỗi đốt, chia đốt, nhân chi & giới hạn góc khớp qua MCP', () => {
    const res = command({ action: 'apply-creature-rig', species: 'spider', leg_pairs: 4, leg_segments: 3, fit_to_layers: false }) as {
      species: string
      boneCount: number
      clips: string[]
    }
    expect(res.species).toBe('spider')
    expect(res.boneCount).toBe(history.current.rig!.bones.length)
    expect(res.clips).toContain('clip-spider-walk')
    expect(() => command({ action: 'apply-creature-rig', species: 'unicorn' })).toThrow(/species/)

    command({ action: 'apply-creature-rig', species: 'fish', facing: 'right', binding_mode: 'soft', include_clips: false })
    expect(history.current.rig!.bones.find((b) => b.id === 'bone-fish-head')!.x).toBeGreaterThan(0)

    command({ action: 'add-bone-chain', parent_id: 'bone-fish-root', segments: 3, length: 90, angle: 90, name: 'Râu', id_prefix: 'whisker' })
    expect(history.current.rig!.bones.filter((b) => b.id.startsWith('whisker-'))).toHaveLength(3)
    command({ action: 'subdivide-bone', bone_id: 'whisker-1', segments: 2 })
    expect(history.current.rig!.bones.some((b) => b.id === 'whisker-1-d2')).toBe(true)
    command({ action: 'radial-array-bone', bone_id: 'whisker-1', count: 3, step_angle: 20 })
    expect(history.current.rig!.bones.some((b) => b.id === 'whisker-1-a3')).toBe(true)

    command({ action: 'update-bone', bone_id: 'whisker-2', min_angle: -20, max_angle: 35 })
    expect(history.current.rig!.bones.find((b) => b.id === 'whisker-2')).toMatchObject({ minAngle: -20, maxAngle: 35 })
    expect(() => command({ action: 'update-bone', bone_id: 'whisker-2', min_angle: 10 })).toThrow(/max_angle/)
    command({ action: 'update-bone', bone_id: 'whisker-2', limit_angle: false })
    expect(history.current.rig!.bones.find((b) => b.id === 'whisker-2')!.minAngle).toBeUndefined()
  })
})