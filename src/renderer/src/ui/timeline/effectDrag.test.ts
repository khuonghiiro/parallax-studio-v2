import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { startEffectDrag } from './effectDrag'
import { addMotionEffect } from '../../animation/motionEffects'
import { createProject, createSolidLayer } from '../../project/factory'
import { useEditor } from '../../store/editor'

class PointerTarget extends EventTarget {
  captured = false
  setPointerCapture() { this.captured = true }
  hasPointerCapture() { return this.captured }
  releasePointerCapture() { this.captured = false }
}
function event(type: string, properties: object): Event { return Object.assign(new Event(type), properties) }
function setup() {
  const layer = useEditor.getState().project.layers[0]
  const target = new PointerTarget()
  const preview = vi.fn()
  const cancel = startEffectDrag({ stopPropagation() {}, preventDefault() {}, button: 0, pointerId: 1,
    clientX: 0, currentTarget: target } as any, layer, layer.appliedEffects![0], 'move', 100, preview)
  return { target, preview, cancel }
}
describe('effect clip gesture history', () => {
  beforeEach(() => {
    vi.stubGlobal('window', new EventTarget())
    const p = createProject({ duration: 10 })
    const l = createSolidLayer(p.comp)
    addMotionEffect(l, 'wind', 1, 3)
    p.layers = [l]
    useEditor.getState().loadProject(p, null)
  })
  afterEach(() => vi.unstubAllGlobals())
  it('previews multiple moves but commits exactly one undo step', () => {
    const { target, preview } = setup()
    target.dispatchEvent(event('pointermove', { pointerId: 1, clientX: 50 }))
    target.dispatchEvent(event('pointermove', { pointerId: 1, clientX: 100 }))
    expect(preview).toHaveBeenCalled()
    expect(useEditor.getState().past).toHaveLength(0)
    target.dispatchEvent(event('pointerup', { pointerId: 1 }))
    expect(useEditor.getState().past).toHaveLength(1)
    expect(useEditor.getState().project.layers[0].appliedEffects![0].startTime).toBe(2)
    useEditor.getState().undo()
    expect(useEditor.getState().project.layers[0].appliedEffects![0].startTime).toBe(1)
  })
  it.each(['escape', 'cancel', 'blur'])('cancels on %s without touching project history', (mode) => {
    const { target, cancel } = setup()
    target.dispatchEvent(event('pointermove', { pointerId: 1, clientX: 100 }))
    if (mode === 'escape') window.dispatchEvent(event('keydown', { key: 'Escape' }))
    else if (mode === 'blur') window.dispatchEvent(new Event('blur'))
    else cancel?.()
    target.dispatchEvent(event('pointerup', { pointerId: 1 }))
    expect(useEditor.getState().past).toHaveLength(0)
    expect(target.captured).toBe(false)
  })
  it('does not overwrite concurrent MCP edits', () => {
    const { target } = setup()
    target.dispatchEvent(event('pointermove', { pointerId: 1, clientX: 100 }))
    useEditor.getState().update((p) => { p.layers[0].appliedEffects![0].startTime = 4 })
    target.dispatchEvent(event('pointerup', { pointerId: 1 }))
    expect(useEditor.getState().project.layers[0].appliedEffects![0].startTime).toBe(4)
    expect(useEditor.getState().past).toHaveLength(1)
  })
})
