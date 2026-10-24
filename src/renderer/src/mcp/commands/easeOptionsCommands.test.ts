import { it, expect } from 'vitest'
import { createProject, createSolidLayer } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { evaluate } from '../../animation/keyframes'
import { runCommand } from '../commands'

it('sets motion parameters through MCP, validates before mutation and supports undo', async () => {
  const project = createProject()
  const layer = createSolidLayer(project.comp)
  project.layers.push(layer)
  useEditor.getState().loadProject(project, null)
  const target = { target: 'layer', id: layer.id, property: 'opacity' }
  await runCommand('set_keyframe', { ...target, time: 0, value: 0, ease: 'blink', ease_options: { cycles: 2, duty: .2 } })
  await runCommand('set_keyframe', { ...target, time: 4, value: 1 })
  const a = useEditor.getState().project.layers[0].transform.opacity
  expect(evaluate(a, .6)).toBe(1)
  expect(evaluate(a, .2)).toBe(0)
  const before = useEditor.getState().project
  await expect(runCommand('set_keyframe', { ...target, time: 0, value: 0, ease_options: { cycles: -4 } })).rejects.toThrow()
  expect(useEditor.getState().project).toBe(before)
  useEditor.getState().undo()
  expect(useEditor.getState().project.layers[0].transform.opacity.keyframes).toHaveLength(1)
  expect(useEditor.getState().project.layers[0].transform.opacity.keyframes[0].easeOptions?.cycles).toBe(2)
})
