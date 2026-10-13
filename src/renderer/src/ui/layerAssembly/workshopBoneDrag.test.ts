import { describe, expect, it } from 'vitest'
import type { LayerRig } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { startBoneDrag, boneDragAction } from './workshopBoneDrag'
import { createWorkshopHistory } from './workshopHistory'

const rig: LayerRig = { duration: 2, loop: true, bones: [
  { id: 'root', name: 'Root', x: 0, y: 0, length: 50, angle: 0 },
  { id: 'child', name: 'Child', parentId: 'root', x: 50, y: 0, length: 40, angle: 0 }
], tracks: {
  root: [{ time: 0, x: 0, y: 0, rotation: 90, easing: 'linear' }],
  child: [{ time: 0, x: 10, y: 20, rotation: 5, easing: 'hold' }]
} }

describe('bone pose gestures', () => {
  it('adds displacement in parent coordinates without resetting existing translation', () => {
    const drag = startBoneDrag(rig, 'child', 0, false, 'head', { x: -18, y: 62 })
    const action = boneDragAction(drag, { x: -8, y: 82 }, false)
    expect(action.action).toBe('set-key')
    if (action.action === 'set-key') {
      expect(action.key.x).toBeCloseTo(30)
      expect(action.key.y).toBeCloseTo(10)
      expect(action.key.rotation).toBeUndefined()
    }
  })
  it('restores pose and redo history on Escape cancellation', () => {
    const initial: LayerComposite = { id: 'test', name: 'Initial', category: 'character', width: 500, height: 600, layers: [], rig }
    const history = createWorkshopHistory(initial)
    history.update({ ...initial, name: 'Next' }); history.undo()
    history.begin(); history.update({ ...initial, name: 'Dragging' }); history.cancel()
    expect(history.current).toEqual(initial)
    expect(history.canUndo).toBe(false)
    history.redo(); expect(history.current.name).toBe('Next')
  })
})
