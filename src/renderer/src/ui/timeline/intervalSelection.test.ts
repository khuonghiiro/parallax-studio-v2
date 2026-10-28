import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createProject, createSolidLayer } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { intervalBounds, retimeTimelineIntervals, type TimelineInterval } from '../../project/timelineIntervals'
import { useTimelineSelection } from './timelineSelection'
import { startIntervalDrag } from './intervalDrag'
import { setSelectedLayerInPoint, setSelectedLayerOutPoint } from './timelineActions'

const first: TimelineInterval = { kind: 'keys', layerId: 'layer', prop: 'opacity', startId: 'a', endId: 'b' }
const second: TimelineInterval = { kind: 'keys', layerId: 'layer', prop: 'opacity', startId: 'c', endId: 'd' }
class Target extends EventTarget {
  captured = false
  setPointerCapture() { this.captured = true }
  hasPointerCapture() { return this.captured }
  releasePointerCapture() { this.captured = false }
}
const event = (type: string, data: object) => Object.assign(new Event(type), data)
function down(item = first, ctrlKey = false) {
  const target = new Target()
  startIntervalDrag({ button: 0, pointerId: 1, clientX: 0, ctrlKey, currentTarget: target,
    stopPropagation() {}, preventDefault() {} } as any, item, 100)
  return target
}
describe('timeline interval selection and gestures', () => {
  beforeEach(() => {
    vi.stubGlobal('window', new EventTarget())
    vi.stubGlobal('document', { querySelectorAll: () => [] })
    const p = createProject({ duration: 12, fps: 30 })
    const layer = createSolidLayer(p.comp)
    layer.id = 'layer'
    layer.transform.opacity.keyframes = [
      { id: 'a', t: 1, value: 0, ease: 'linear', timelineBoundary: 'start' },
      { id: 'b', t: 3, value: 1, ease: 'hold', timelineBoundary: 'end' },
      { id: 'c', t: 6, value: 0, ease: 'linear', timelineBoundary: 'start' },
      { id: 'd', t: 8, value: 1, ease: 'hold', timelineBoundary: 'end' }
    ]
    p.layers = [layer]
    useEditor.getState().loadProject(p, null)
  })
  afterEach(() => vi.unstubAllGlobals())
  it('Ctrl toggles independent ranges on the same row without moving time or creating history', () => {
    down(first, true); down(second, true)
    expect(useTimelineSelection.getState().intervals).toEqual([first, second])
    down(first, true)
    expect(useTimelineSelection.getState().intervals).toEqual([second])
    expect(useEditor.getState().past).toHaveLength(0)
    expect(useEditor.getState().time).toBe(0)
  })
  it('drags both ranges once and supports undo/redo', () => {
    down(first, true); down(second, true)
    const target = down()
    target.dispatchEvent(event('pointermove', { pointerId: 1, clientX: 100 }))
    expect(useEditor.getState().past).toHaveLength(0)
    target.dispatchEvent(event('pointerup', { pointerId: 1 }))
    expect(useEditor.getState().project.layers[0].transform.opacity.keyframes.map(k => k.t)).toEqual([2, 4, 7, 9])
    expect(useEditor.getState().past).toHaveLength(1)
    useEditor.getState().undo()
    expect(intervalBounds(useEditor.getState().project, first)).toEqual({ start: 1, end: 3 })
    useEditor.getState().redo()
    expect(intervalBounds(useEditor.getState().project, second)).toEqual({ start: 7, end: 9 })
  })
  it.each(['pointercancel', 'lostpointercapture', 'escape', 'blur'])('cancels %s without a history entry', reason => {
    const target = down()
    target.dispatchEvent(event('pointermove', { pointerId: 1, clientX: 100 }))
    if (reason === 'escape') window.dispatchEvent(event('keydown', { key: 'Escape' }))
    else if (reason === 'blur') window.dispatchEvent(new Event('blur'))
    else target.dispatchEvent(new Event(reason))
    target.dispatchEvent(event('pointerup', { pointerId: 1 }))
    expect(useEditor.getState().past).toHaveLength(0)
    expect(target.captured).toBe(false)
  })
  it('does not retime unselected intervals', () => {
    useEditor.getState().update(p => retimeTimelineIntervals(p, [first], 'shift', 1))
    expect(intervalBounds(useEditor.getState().project, second)).toEqual({ start: 6, end: 8 })
  })
  it('refuses overlapping intervals atomically', () => {
    const before = useEditor.getState().project
    expect(() => useEditor.getState().update(p => retimeTimelineIntervals(p, [first, second], 'in', 2))).toThrow()
    expect(useEditor.getState().project).toBe(before)
    expect(useEditor.getState().past).toHaveLength(0)
  })
  it('sets IN/OUT on selected intervals across properties', () => {
    useEditor.getState().update(p => { p.layers[0].transform.scale.keyframes = [
      { id: 'x', t: 1, value: [1, 1, 1], ease: 'linear' }, { id: 'y', t: 3, value: [2, 2, 2], ease: 'hold' }
    ] })
    const other: TimelineInterval = { ...first, prop: 'scale', startId: 'x', endId: 'y' }
    useTimelineSelection.setState({ intervals: [first, other] })
    expect(setSelectedLayerInPoint(2)).toBe(true)
    expect(setSelectedLayerOutPoint(4)).toBe(true)
    expect(intervalBounds(useEditor.getState().project, first)).toEqual({ start: 2, end: 4 })
    expect(intervalBounds(useEditor.getState().project, other)).toEqual({ start: 2, end: 4 })
  })
  it('skips locked layers and clears selection after loading another project', () => {
    down(first, true)
    useEditor.getState().update(p => { p.layers[0].locked = true })
    const before = useEditor.getState().project
    useEditor.getState().update(p => retimeTimelineIntervals(p, [first], 'shift', 1))
    expect(useEditor.getState().project).toBe(before)
    useEditor.getState().loadProject(createProject(), null)
    expect(useTimelineSelection.getState().intervals).toEqual([])
  })
  it('does not overwrite edits made during a drag', () => {
    const target = down()
    target.dispatchEvent(event('pointermove', { pointerId: 1, clientX: 100 }))
    useEditor.getState().update(p => { p.layers[0].name = 'Changed' })
    target.dispatchEvent(event('pointerup', { pointerId: 1 }))
    expect(intervalBounds(useEditor.getState().project, first)).toEqual({ start: 1, end: 3 })
  })
})
