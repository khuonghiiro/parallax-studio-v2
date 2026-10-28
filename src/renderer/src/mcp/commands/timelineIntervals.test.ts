import { beforeEach, describe, expect, it } from 'vitest'
import { createProject, createSolidLayer } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { runCommand } from '../commands'

describe('retime_layers explicit intervals MCP parity', () => {
  beforeEach(() => {
    const project = createProject({ duration: 10, fps: 30 })
    const layer = createSolidLayer(project.comp)
    layer.id = 'l'
    layer.transform.opacity.keyframes = [
      { id: 'a', t: 2, value: 0, ease: 'linear' }, { id: 'b', t: 4, value: 1, ease: 'hold' }
    ]
    project.layers = [layer]
    useEditor.getState().loadProject(project, null)
  })
  const intervals = [{ kind: 'keys', layerId: 'l', prop: 'opacity', startId: 'a', endId: 'b' }]
  it('retimes a range in one undo step', async () => {
    await runCommand('retime_layers', { intervals, mode: 'shift', seconds: 1 })
    expect(useEditor.getState().project.layers[0].transform.opacity.keyframes.map(k => k.t)).toEqual([3, 5])
    expect(useEditor.getState().past).toHaveLength(1)
    useEditor.getState().undo()
    expect(useEditor.getState().project.layers[0].transform.opacity.keyframes[0].t).toBe(2)
  })
  it.each(['in', 'out'])('supports %s for explicit intervals', async mode => {
    await runCommand('retime_layers', { intervals, mode, seconds: 3 })
    expect(useEditor.getState().project.layers[0].transform.opacity.keyframes.map(k => k.t)).toEqual(mode === 'in' ? [3, 4] : [2, 3])
  })
  it('rejects invalid IDs without altering project', async () => {
    const before = useEditor.getState().project
    await expect(runCommand('retime_layers', { intervals: [{ ...intervals[0], endId: 'missing' }], mode: 'shift', seconds: 1 })).rejects.toThrow()
    expect(useEditor.getState().project).toBe(before)
  })
})
