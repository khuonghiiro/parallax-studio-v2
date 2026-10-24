import { beforeEach, expect, it, vi } from 'vitest'
import { createProject, createSolidLayer } from '../../project/factory'
import { useEditor, type PropRef } from '../../store/editor'
import { activeTimelineRef, addTimelineKey, focusTimelineProperty, handleTimelineKeyShortcut, navigateTimelineKey, setTimelineEase, useTimelineProperty } from './timelineKeyEditing'

let ref: PropRef
it('selects a new property without changing the playhead or project', () => {
  addTimelineKey(ref)
  useEditor.getState().setTime(2)
  const project = useEditor.getState().project
  const rotation = { ...ref, prop: 'rotation' } as PropRef
  focusTimelineProperty(rotation)
  expect(activeTimelineRef()).toEqual(rotation)
  expect(useEditor.getState().selectedKey).toBeNull()
  expect(useEditor.getState().time).toBe(2)
  expect(useEditor.getState().project).toBe(project)
})

it('moves property focus with arrows without editing values or seeking', () => {
  const project = useEditor.getState().project
  const target = { matches: () => false, closest: (selector: string) => selector === '.tl-property-controls' ? {} : null } as unknown as HTMLElement
  expect(handleTimelineKeyShortcut(key('ArrowDown', { target }))).toBe(true)
  expect(activeTimelineRef()?.prop).toBe('rotation')
  expect(handleTimelineKeyShortcut(key('ArrowUp', { target }))).toBe(true)
  expect(activeTimelineRef()?.prop).toBe('position')
  expect(useEditor.getState().project).toBe(project)
})
beforeEach(() => {
  const project = createProject()
  const layer = createSolidLayer(project.comp)
  project.layers.push(layer)
  useEditor.getState().loadProject(project, null)
  ref = { kind: 'layer', layerId: layer.id, prop: 'position' }
  useTimelineProperty.setState({ ref: null })
  focusTimelineProperty(ref)
})

function key(key: string, options: Partial<KeyboardEvent> = {}) {
  return { key, preventDefault: vi.fn(), ...options } as unknown as KeyboardEvent
}

it('K edits only the active property, selects existing keys and supports undo', () => {
  useEditor.getState().setTime(2)
  expect(handleTimelineKeyShortcut(key('k'))).toBe(true)
  useEditor.getState().setTime(5)
  handleTimelineKeyShortcut(key('k'))
  const layer = useEditor.getState().project.layers[0]
  expect(layer.transform.position.keyframes.map(k => k.t)).toEqual([0, 2, 5])
  expect(layer.transform.rotation.keyframes).toEqual([])
  const snapshot = useEditor.getState().project
  handleTimelineKeyShortcut(key('k'))
  expect(useEditor.getState().project).toBe(snapshot)
  useEditor.getState().undo()
  expect(useEditor.getState().project.layers[0].transform.position.keyframes.map(k => k.t)).toEqual([0, 2])
})

it('navigates keys and changes the incoming segment at the final key', () => {
  useEditor.getState().setTime(0)
  addTimelineKey(ref)
  useEditor.getState().setTime(4)
  addTimelineKey(ref)
  setTimelineEase(ref, 'hold')
  expect(useEditor.getState().project.layers[0].transform.position.keyframes[0].ease).toBe('hold')
  navigateTimelineKey(ref, -1)
  expect(useEditor.getState().time).toBe(0)
  navigateTimelineKey(ref, 1)
  expect(useEditor.getState().time).toBe(4)
})

it('changes an open start without changing the protected past', () => {
  useEditor.getState().setTime(2)
  addTimelineKey(ref)
  setTimelineEase(ref, 'pulse')
  const keys = useEditor.getState().project.layers[0].transform.position.keyframes
  expect(keys[0].ease).toBe('hold')
  expect(keys[1].ease).toBe('pulse')
})

it('continues the chosen movement when adding a third key', () => {
  addTimelineKey(ref)
  setTimelineEase(ref, 'linear')
  useEditor.getState().setTime(2)
  addTimelineKey(ref)
  useEditor.getState().setTime(4)
  addTimelineKey(ref)
  expect(useEditor.getState().project.layers[0].transform.position.keyframes.map(k => k.ease))
    .toEqual(['linear', 'linear', 'hold'])
})

it('defaults to position when a layer is selected without a property', () => {
  useTimelineProperty.setState({ ref: null })
  handleTimelineKeyShortcut(key('k'))
  expect(useEditor.getState().project.layers[0].transform.position.keyframes).toHaveLength(1)
  expect(useEditor.getState().project.layers[0].transform.opacity.keyframes).toEqual([])
})

it('switches the shortcut target when another property is focused', () => {
  addTimelineKey(ref)
  focusTimelineProperty({ ...ref, prop: 'opacity' } as PropRef)
  expect(useEditor.getState().selectedKey).toBeNull()
  handleTimelineKeyShortcut(key('k'))
  expect(useEditor.getState().project.layers[0].transform.opacity.keyframes).toHaveLength(1)
})

it('does not edit locked layers or capture typing, repeat and modifier shortcuts', () => {
  expect(handleTimelineKeyShortcut(key('k', { target: { matches: () => true } as unknown as EventTarget }))).toBe(false)
  expect(handleTimelineKeyShortcut(key('k', { ctrlKey: true }))).toBe(false)
  expect(handleTimelineKeyShortcut(key('k', { repeat: true }))).toBe(false)
  useEditor.getState().update(d => { d.layers[0].locked = true })
  addTimelineKey(ref)
  setTimelineEase(ref, 'pulse')
  expect(useEditor.getState().project.layers[0].transform.position.keyframes).toEqual([])
})
