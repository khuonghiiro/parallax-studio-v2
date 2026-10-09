import { describe, expect, it } from 'vitest'
import { createWorkshopHistory } from './workshopHistory'
import type { LayerComposite } from './types'

function makeComp(name: string): LayerComposite {
  return {
    id: 'test-comp',
    name,
    category: 'nature',
    width: 600,
    height: 600,
    layers: []
  }
}

describe('workshopHistory', () => {
  it('tracks past, present, and future states with undo and redo', () => {
    const history = createWorkshopHistory(makeComp('Initial'))
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)

    history.update(makeComp('Edit 1'))
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
    expect(history.current.name).toBe('Edit 1')

    history.update(makeComp('Edit 2'))
    expect(history.current.name).toBe('Edit 2')

    history.undo()
    expect(history.current.name).toBe('Edit 1')
    expect(history.canRedo).toBe(true)

    history.undo()
    expect(history.current.name).toBe('Initial')
    expect(history.canUndo).toBe(false)

    history.redo()
    expect(history.current.name).toBe('Edit 1')
  })

  it('merges continuous updates during an active gesture into one undo step', () => {
    const history = createWorkshopHistory(makeComp('Initial'))

    history.begin()
    history.update(makeComp('Drag step 1'))
    history.update(makeComp('Drag step 2'))
    history.update(makeComp('Drag step 3'))
    history.end()

    expect(history.current.name).toBe('Drag step 3')
    history.undo()
    // Undo should jump straight back to Initial, merging all drag steps into one
    expect(history.current.name).toBe('Initial')
  })

  it('ignores no-op identical updates', () => {
    const initial = makeComp('Initial')
    const history = createWorkshopHistory(initial)
    history.update(initial)
    expect(history.canUndo).toBe(false)
  })
})
