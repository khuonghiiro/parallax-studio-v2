import { useEffect } from 'react'
import type { useLayerWorkshop } from './useLayerWorkshop'

export function useWorkshopShortcuts(state: ReturnType<typeof useLayerWorkshop>, togglePlay: () => void, close: () => void) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')) { e.stopPropagation(); return }
      const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase()
      // The viewport/gizmo owns Escape while a gesture is active.
      if (e.key === 'Escape' && state.history.gestureActive) return
      if (state.history.gestureActive && mod && (key === 'z' || key === 'y')) { e.preventDefault(); e.stopImmediatePropagation(); return }
      if (mod && key === 'z') e.shiftKey ? state.redo() : state.undo()
      else if (mod && key === 'y') state.redo()
      else if (mod && key === 'a') state.setIds(state.composite.layers.map((l) => l.id))
      else if (mod && key === 'd') state.run('duplicate')
      else if (e.key === 'Delete' || e.key === 'Backspace') state.run('delete')
      else if (e.code === 'Space') togglePlay()
      else if (e.key === 'Escape') { if (state.selection.length) state.select(null); else close() }
      else return
      e.preventDefault(); e.stopImmediatePropagation()
    }
    const end = () => state.history.end()
    window.addEventListener('keydown', handle, true)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('keydown', handle, true)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [state, togglePlay, close])
}
