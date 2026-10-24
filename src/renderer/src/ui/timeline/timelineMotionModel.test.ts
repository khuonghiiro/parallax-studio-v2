import { it, expect } from 'vitest'
import { createProject, createSolidLayer } from '../../project/factory'
import { addKeyframe, evaluate } from '../../animation/keyframes'
import { useEditor } from '../../store/editor'
import { applyTimelineMotion } from './timelineMotionModel'

it('configures the incoming segment at the last key, with one undo and a lock guard', () => {
  const project = createProject()
  const layer = createSolidLayer(project.comp)
  addKeyframe(layer.transform.opacity, 1, 0)
  addKeyframe(layer.transform.opacity, 4, 1)
  project.layers.push(layer)
  useEditor.getState().loadProject(project, null)
  const ref = { kind: 'layer' as const, layerId: layer.id, prop: 'opacity' as const }
  const before = useEditor.getState().project
  applyTimelineMotion(ref, 4, 'hold', { holdUntil: .5 })
  const a = useEditor.getState().project.layers[0].transform.opacity
  expect(a.keyframes[0].easeOptions).toEqual({ holdUntil: .5 })
  expect(evaluate(a, 2)).toBe(0)
  expect(evaluate(a, 3)).toBe(1)
  useEditor.getState().undo()
  expect(useEditor.getState().project).toEqual(before)
  useEditor.getState().update(d => { d.layers[0].locked = true })
  const locked = useEditor.getState().project
  applyTimelineMotion(ref, 1, 'blink', { cycles: 4 })
  expect(useEditor.getState().project).toBe(locked)
})
