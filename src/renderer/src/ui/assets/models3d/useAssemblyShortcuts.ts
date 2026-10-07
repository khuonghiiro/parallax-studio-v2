import { useEffect, useRef } from 'react'
import type { Vec3 } from './assemblyGeometry'

export interface AssemblyShortcutActions {
  undo: () => void
  redo: () => void
  duplicate: () => void
  remove: () => void
  nudge: (delta: Vec3) => void
  toggleHidden: () => void
  toggleLocked: () => void
  frame: () => void
}

/** Shortcut reference shown in the workshop's help popover. */
export const ASSEMBLY_SHORTCUTS: Array<[string, string]> = [
  ['Ctrl + Z', 'Hoàn tác'],
  ['Ctrl + Y / Ctrl + Shift + Z', 'Làm lại'],
  ['Ctrl + D', 'Nhân bản mặt'],
  ['Delete', 'Xóa mặt'],
  ['← → ↑ ↓', 'Dịch X / Y 1 đơn vị (Shift ×10)'],
  ['PageUp / PageDown', 'Dịch chiều sâu Z (Shift ×10)'],
  ['H', 'Ẩn / hiện mặt'],
  ['L', 'Khóa / mở khóa mặt'],
  ['F', 'Lấy nét camera vào mặt đang chọn'],
  ['Esc', 'Hủy thao tác gizmo đang kéo']
]

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Maps a key event to a workshop action; returns false when the key is not a shortcut. */
function dispatch(e: KeyboardEvent, a: AssemblyShortcutActions): boolean {
  const mod = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()
  const step = e.shiftKey ? 10 : 1
  let action: (() => void) | null = null
  if (mod) {
    if (key === 'z') action = e.shiftKey ? a.redo : a.undo
    else if (key === 'y') action = a.redo
    else if (key === 'd') action = a.duplicate
  } else {
    const nudges: Record<string, Vec3> = {
      ArrowLeft: [-step, 0, 0],
      ArrowRight: [step, 0, 0],
      ArrowUp: [0, step, 0],
      ArrowDown: [0, -step, 0],
      PageUp: [0, 0, step],
      PageDown: [0, 0, -step]
    }
    const delta = nudges[e.key]
    if (delta) action = () => a.nudge(delta)
    else if (e.key === 'Delete' || e.key === 'Backspace') action = a.remove
    else if (!e.altKey && key === 'h') action = a.toggleHidden
    else if (!e.altKey && key === 'l') action = a.toggleLocked
    else if (!e.altKey && key === 'f') action = a.frame
  }
  if (!action) return false
  action()
  return true
}

/**
 * Workshop keyboard shortcuts. Listens in the capture phase so the main editor's global
 * shortcuts (Ctrl+Z on the project, Delete layer, Space play…) do not fire while the modal
 * is open. Typing in inputs and Escape (gizmo cancel) are left untouched.
 */
export function useAssemblyShortcuts(enabled: boolean, actions: AssemblyShortcutActions): void {
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || isEditable(e.target)) return
      if (dispatch(e, actionsRef.current)) e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled])
}
