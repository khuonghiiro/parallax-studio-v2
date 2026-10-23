import { it, expect } from 'vitest'
import { createProject, createSolidLayer } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { evaluate } from '../../animation/keyframes'
import { runCommand } from '../commands'

it('authors range boundaries through MCP and supports undo', async () => {
  const project = createProject()
  const layer = createSolidLayer(project.comp)
  project.layers.push(layer)
  useEditor.getState().loadProject(project, null)
  const target = { target: 'layer', id: layer.id, property: 'opacity' }
  await runCommand('set_keyframe', { ...target, time: 3, value: .5, boundary: 'start' })
  await runCommand('set_keyframe', { ...target, time: 5, value: 0, boundary: 'end' })
  const a = useEditor.getState().project.layers[0].transform.opacity
  expect(evaluate(a, 2)).toBe(1)
  expect(evaluate(a, 3)).toBe(.5)
  expect(evaluate(a, 5)).toBe(0)
  useEditor.getState().undo()
  expect(useEditor.getState().project.layers[0].transform.opacity.keyframes).toHaveLength(2)
})
