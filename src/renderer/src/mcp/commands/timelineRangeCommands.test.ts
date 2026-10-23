import { it, expect } from 'vitest'
import { createProject, createSolidLayer } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { evaluate } from '../../animation/keyframes'
import { runCommand } from '../commands'

it.each(['hold', 'pulse'] as const)('honors explicit %s on an MCP start boundary', async ease => {
  const project = createProject()
  const layer = createSolidLayer(project.comp)
  project.layers.push(layer)
  useEditor.getState().loadProject(project, null)
  const target = { target: 'layer', id: layer.id, property: 'opacity' }
  await runCommand('set_keyframe', { ...target, time: 1, value: 0, boundary: 'start', ease })
  await runCommand('set_keyframe', { ...target, time: 6, value: 1, boundary: 'end' })
  const a = useEditor.getState().project.layers[0].transform.opacity
  expect(a.keyframes[1].ease).toBe(ease)
  expect(evaluate(a, 2)).toBeCloseTo(ease === 'hold' ? 0 : 1)
  expect(evaluate(a, 5)).toBeCloseTo(0)
  expect(evaluate(a, 6)).toBe(1)
})

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
