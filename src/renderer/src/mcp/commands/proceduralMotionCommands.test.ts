import { effectMotion } from '../../animation/motionEffects'
import { beforeEach, describe, expect, it } from 'vitest'
import { createProject, createSolidLayer } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { runCommand } from '../commands'
import { sampleLayerMotion } from '../../animation/proceduralMotion'

describe('MCP procedural Motion parity', () => {
  let id: string
  beforeEach(() => {
    const project = createProject()
    const layer = createSolidLayer(project.comp)
    id = layer.id
    project.layers = [layer]
    useEditor.getState().loadProject(project, null)
  })
  it('sets all controls with one undoable edit and reads renderer samples', async () => {
    const original = useEditor.getState().project
    await runCommand('set_layer_motion', { layer_id: id, type: 'wiggle', speed: 2, amplitude: [10, 20, 3],
      amount: 0.7, seed: 42, start_time: 1, duration: 4, fade_in: 0.5, fade_out: 0.5, phase: 0.1 })
    const motion = effectMotion(useEditor.getState().project.layers[0].appliedEffects![0])
    const result = await runCommand('get_layer_motion', { layer_id: id, time: 2 }) as any
    expect(result.motion).toEqual(motion)
    expect(result.sample).toEqual(sampleLayerMotion(motion, 2))
    useEditor.getState().undo()
    expect(useEditor.getState().project).toEqual(original)
    useEditor.getState().redo()
    expect(effectMotion(useEditor.getState().project.layers[0].appliedEffects![0])).toEqual(motion)
  })
  it('preserves values on bypass, resets correctly, and uses new type defaults', async () => {
    await runCommand('set_layer_motion', { layer_id: id, type: 'wiggle', speed: 4 })
    await runCommand('set_layer_motion', { layer_id: id, enabled: false })
    expect(effectMotion(useEditor.getState().project.layers[0].appliedEffects![0])?.speed).toBe(4)
    await runCommand('set_layer_motion', { layer_id: id, reset: true })
    expect(effectMotion(useEditor.getState().project.layers[0].appliedEffects![0])?.speed).toBe(1.5)
    await runCommand('set_layer_motion', { layer_id: id, type: 'pulse' })
    expect(effectMotion(useEditor.getState().project.layers[0].appliedEffects![0])?.amplitude).toEqual([0.05, 0.05, 0])
  })
  it.each([{ speed: -1 }, { amount: 2 }, { seed: 0.5 }, { duration: -1 }, { start_time: NaN },
    { type: 'bad' }, { amplitude: [1, 2] }, { direction: 'bad' }, { loop_mode: 'bad' }, { loop_width: 0 }, { enabled: 'yes' }])(
    'rejects invalid input atomically: %j', async (patch) => {
      const original = useEditor.getState().project
      await expect(runCommand('set_layer_motion', { layer_id: id, ...patch })).rejects.toThrow()
      expect(useEditor.getState().project).toEqual(original)
    }
  )
  it('rejects missing layers', async () => {
    await expect(runCommand('set_layer_motion', { layer_id: 'missing', type: 'wind' })).rejects.toThrow()
  })
})
