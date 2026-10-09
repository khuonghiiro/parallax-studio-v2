import type { LayerComposite } from './types'

export function createWorkshopHistory(initial: LayerComposite) {
  let present = initial
  let past: LayerComposite[] = [], future: LayerComposite[] = []
  let gesture = false, captured = false, lastKey = '', lastAt = -Infinity
  return {
    get current() { return present },
    get canUndo() { return past.length > 0 },
    get canRedo() { return future.length > 0 },
    get gestureActive() { return gesture },
    begin() { gesture = true; captured = false; lastKey = '' },
    end() { gesture = false; captured = false; lastKey = '' },
    update(next: LayerComposite, key = '') {
      if (next === present || JSON.stringify(next) === JSON.stringify(present)) return
      const now = performance.now()
      const merge = gesture ? captured : !!key && key === lastKey && now - lastAt < 450
      if (!merge) past = [...past, present].slice(-100)
      present = next; future = []; captured = gesture; lastKey = key; lastAt = now
    },
    undo() {
      if (!past.length) return
      future = [present, ...future]; present = past.at(-1)!; past = past.slice(0, -1)
      gesture = false; captured = false; lastKey = ''
    },
    redo() {
      if (!future.length) return
      past = [...past, present]; present = future[0]; future = future.slice(1)
      gesture = false; captured = false; lastKey = ''
    }
  }
}
