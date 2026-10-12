import { beforeEach, describe, expect, it } from 'vitest'
import { createProject, createSolidLayer } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { runCommand } from '../commands'
import { listLayerEffects, sampleMotionEffects } from '../../animation/motionEffects'

describe('MCP unified animation effect stack', () => {
  let id: string
  beforeEach(() => {
    const project = createProject()
    const layer = createSolidLayer(project.comp)
    id = layer.id
    project.layers = [layer]
    useEditor.getState().loadProject(project, null)
  })
  const layer = () => useEditor.getState().project.layers[0]
  it('adds multiple effects, edits one, bypasses and removes it with undo/redo', async () => {
    const a = await runCommand('apply_layer_fx', { layer_id: id, preset: 'motionWind', time: 0, duration: 4 }) as any
    const b = await runCommand('apply_layer_fx', { layer_id: id, preset: 'motionWiggle', time: 1, duration: 2 }) as any
    expect(a.fx_id).not.toBe(b.fx_id)
    const first = structuredClone(layer().appliedEffects![0])
    await runCommand('update_layer_fx', { layer_id: id, fx_id: b.fx_id, name: 'Va chạm', start_time: 2, duration: 1, seed: 17, amount: 0.5 })
    expect(layer().appliedEffects![0]).toEqual(first)
    const edited = layer().appliedEffects![1]
    expect(edited).toMatchObject({ name: 'Va chạm', startTime: 2, duration: 1, motion: { seed: 17, amount: 0.5 } })
    const list = await runCommand('list_layer_fx', { layer_id: id }) as any
    expect(list.effects).toHaveLength(2)
    await runCommand('toggle_layer_fx', { layer_id: id, fx_id: b.fx_id, enabled: false })
    expect(layer().appliedEffects![1].enabled).toBe(false)
    await runCommand('remove_layer_fx', { layer_id: id, fx_id: b.fx_id })
    expect(layer().appliedEffects).toHaveLength(1)
    await runCommand('undo')
    expect(layer().appliedEffects).toHaveLength(2)
    await runCommand('redo')
    expect(layer().appliedEffects).toHaveLength(1)
  })
  it('exposes legacy Motion and upgrades it once without changing evaluated motion', async () => {
    useEditor.getState().update((p) => { p.layers[0].motion = { type: 'wind', speed: 0.5, amplitude: [5, 2, 1] } })
    const before = sampleMotionEffects(layer(), 1, [100, 100])
    const fxId = listLayerEffects(layer())[0].id
    await runCommand('update_layer_fx', { layer_id: id, fx_id: fxId, name: 'Gió cũ' })
    expect(layer().motion).toBeUndefined()
    expect(layer().appliedEffects).toHaveLength(1)
    expect(sampleMotionEffects(layer(), 1, [100, 100])).toEqual(before)
    await runCommand('set_layer_motion', { layer_id: id, speed: 2 })
    expect(layer().appliedEffects).toHaveLength(1)
  })
  it('rejects invalid ids, parameters and locked layers atomically', async () => {
    const fx = await runCommand('apply_layer_fx', { layer_id: id, preset: 'motionWind' }) as any
    const original = useEditor.getState().project
    for (const patch of [{ fx_id: 'missing' }, { duration: -1 }, { amount: 2 }, { seed: 1.2 }]) {
      await expect(runCommand('update_layer_fx', { layer_id: id, fx_id: fx.fx_id, ...patch })).rejects.toThrow()
      expect(useEditor.getState().project).toBe(original)
    }
    useEditor.getState().update((p) => { p.layers[0].locked = true })
    const locked = useEditor.getState().project
    await expect(runCommand('update_layer_fx', { layer_id: id, fx_id: fx.fx_id, speed: 2 })).rejects.toThrow()
    await expect(runCommand('remove_layer_fx', { layer_id: id, fx_id: fx.fx_id })).rejects.toThrow()
    expect(useEditor.getState().project).toBe(locked)
  })
  it('retimes existing keyframe effects through the same API', async () => {
    const fx = await runCommand('apply_layer_fx', { layer_id: id, preset: 'fadeIn', time: 1, duration: 2 }) as any
    await runCommand('update_layer_fx', { layer_id: id, fx_id: fx.fx_id, start_time: 3, duration: 4 })
    expect(layer().transform.opacity.keyframes.map((k) => k.t)).toEqual([3, 7])
    await expect(runCommand('update_layer_fx', { layer_id: id, fx_id: fx.fx_id, duration: 0 })).rejects.toThrow()
    expect(layer().transform.opacity.keyframes.map((k) => k.t)).toEqual([3, 7])
  })
})
