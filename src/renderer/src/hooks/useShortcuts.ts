import { useEffect } from 'react'
import { snapToFrame } from '../animation/math'
import {
  addTextLayer,
  deleteSelectedKeyframe,
  deleteSelectedLayer,
  duplicateSelectedLayer,
  importImages,
  newProject,
  openProject,
  saveProject
} from '../actions'
import { useEditor } from '../store/editor'

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function useShortcuts(onExport: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isTyping(e)) return
      const st = useEditor.getState()
      const ctrl = e.ctrlKey || e.metaKey
      const fps = st.project.comp.fps
      const k = e.key.toLowerCase()

      if (ctrl) {
        if (k === 'z' && !e.shiftKey) st.undo()
        else if (k === 'y' || (k === 'z' && e.shiftKey)) st.redo()
        else if (k === 's') saveProject(e.shiftKey)
        else if (k === 'o') openProject()
        else if (k === 'n') newProject()
        else if (k === 'i') importImages(true)
        else if (k === 't') addTextLayer()
        else if (k === 'd') duplicateSelectedLayer()
        else if (k === 'm') onExport()
        else return
        e.preventDefault()
        return
      }

      switch (e.key) {
        case ' ':
          if (!st.playing && st.time >= st.project.comp.duration - 1e-3) st.setTime(0)
          st.setPlaying(!st.playing)
          break
        case 'Home':
          st.setTime(0)
          break
        case 'End':
          st.setTime(st.project.comp.duration)
          break
        case 'ArrowLeft':
          st.setTime(snapToFrame(st.time - (e.shiftKey ? 10 : 1) / fps, fps))
          break
        case 'ArrowRight':
          st.setTime(snapToFrame(st.time + (e.shiftKey ? 10 : 1) / fps, fps))
          break
        case 'Delete':
        case 'Backspace':
          if (!deleteSelectedKeyframe()) deleteSelectedLayer()
          break
        case 'Escape':
          st.selectLayer(null)
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExport])
}
