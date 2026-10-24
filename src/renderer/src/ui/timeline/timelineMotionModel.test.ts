import { it, expect } from 'vitest'
import { createProject, createSolidLayer } from '../../project/factory'
import { addKeyframe, evaluate } from '../../animation/keyframes'
import { useEditor } from '../../store/editor'
import { applyTimelineMotion, closeMotionPopup, selectQuickTimelineMotion, useMotionPopup } from './timelineMotionModel'
import { toggleTimelineKey } from './timelineKeyEditing'

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

it('auto-creates start keyframe on quick motion click and toggles keyframe cleanly', () => {
  closeMotionPopup()
  const project = createProject()
  const layer = createSolidLayer(project.comp)
  project.layers.push(layer)
  useEditor.getState().loadProject(project, null)
  useEditor.getState().setTime(1.5)
  const ref = { kind: 'layer' as const, layerId: layer.id, prop: 'opacity' as const }

  // Clicking a quick motion button when 0 keyframes exist auto-creates the start keyframe & applies mode
  selectQuickTimelineMotion(ref, 1.5, 'pulse', { clientX: 100, clientY: 100 })
  const afterSelect = useEditor.getState().project.layers[0].transform.opacity
  expect(afterSelect.keyframes.map(k => k.t)).toEqual([0, 1.5])
  expect(afterSelect.keyframes[1].ease).toBe('pulse')
  expect(useMotionPopup.getState().popup).toBeNull()

  // Clicking the already-active motion button opens the tuning popup
  selectQuickTimelineMotion(ref, 1.5, 'pulse', { clientX: 120, clientY: 140 })
  expect(useMotionPopup.getState().popup?.time).toBe(1.5)
  closeMotionPopup()

  // Toggling keyframe at 1.5s removes both 1.5s and the lone 0s silent hold guard
  toggleTimelineKey(ref)
  expect(useEditor.getState().project.layers[0].transform.opacity.keyframes).toEqual([])
})
