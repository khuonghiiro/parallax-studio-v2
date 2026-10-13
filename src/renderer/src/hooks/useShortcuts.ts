import { useEffect, useRef } from 'react'
import { snapToFrame } from '../animation/math'
import {
  addTextLayer,
  deleteSelectedAudioTrack,
  deleteSelectedKeyframe,
  deleteSelectedLayer,
  duplicateSelectedLayer,
  importImages,
  newProject,
  openProject,
  saveProject,
  toast
} from '../actions'
import { useEditor } from '../store/editor'
import { useView } from '../store/view'

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function isModalOpen(): boolean {
  const view = useView.getState()
  if (view.dialog !== null || view.assemblyModalModel !== null) return true
  if (typeof document !== 'undefined') {
    return Boolean(document.querySelector('.modal-backdrop, .la-dialog-backdrop, .a3d-backdrop'))
  }
  return false
}

export function useShortcuts(onExport: () => void): void {
  const lastLPressRef = useRef<number>(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return

      const view = useView.getState()
      // Escape should always close non-export dialogs or blur active inputs
      if (e.key === 'Escape') {
        if (view.dialog && view.dialog !== 'export') {
          view.openDialog(null)
          e.preventDefault()
          return
        }
        if (isTyping(e)) {
          ;(e.target as HTMLElement | null)?.blur?.()
          e.preventDefault()
          return
        }
      }

      // Block background scene/timeline shortcuts while any modal or workshop is open
      if (isModalOpen() || isTyping(e)) return

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
          if (!deleteSelectedKeyframe()) {
            if (!deleteSelectedAudioTrack()) {
              deleteSelectedLayer()
            }
          }
          break
        case 'Escape':
          st.selectLayer(null)
          st.selectAudioTrack(null)
          break
        case 'l':
        case 'L': {
          const now = performance.now()
          const isDoubleL = now - lastLPressRef.current < 450
          lastLPressRef.current = now
          useEditor.getState().setInspectorTab('scene')
          useView.getState().openAudioDialog(isDoubleL ? 'waveform' : 'levels')
          if (isDoubleL) {
            toast('Phím tắt LL (After Effects): Đã mở bảng sóng âm Waveform & Audio Studio')
          } else {
            toast('Phím tắt L (After Effects): Đã mở bảng cấu hình Audio Levels & Mixer')
          }
          break
        }
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExport])
}

