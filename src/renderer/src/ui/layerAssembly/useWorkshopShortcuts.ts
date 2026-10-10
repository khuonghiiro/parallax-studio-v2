import { useEffect, useRef } from 'react'
import type { useLayerWorkshop } from './useLayerWorkshop'
import { applyRigAction } from './workshopRig'

export interface WorkshopBoneContext {
  tab?: string
  boneId?: string | null
  selectBone?: (id: string | null) => void
}

export function useWorkshopShortcuts(
  state: ReturnType<typeof useLayerWorkshop>,
  togglePlay: () => void,
  close: () => void,
  boneContext?: WorkshopBoneContext
) {
  const boneCtxRef = useRef(boneContext)
  boneCtxRef.current = boneContext

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
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        const ctx = boneCtxRef.current
        if (ctx?.boneId && (ctx.tab === 'bones' || state.selection.length === 0)) {
          const targetBoneId = ctx.boneId
          state.setComposite((c) => applyRigAction(c, { action: 'delete-bone', boneId: targetBoneId }))
          ctx.selectBone?.(null)
        } else if (state.selection.length) {
          state.run('delete')
        }
      }
      else if (e.code === 'Space') togglePlay()
      else if (e.key === 'Escape') {
        const ctx = boneCtxRef.current
        if (ctx?.boneId) ctx.selectBone?.(null)
        else if (state.selection.length) state.select(null)
        else close()
      }
      else if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && state.selection.length) {
        if (!state.history.gestureActive) state.history.begin()
        const step = e.shiftKey ? 10 : (e.altKey ? 1 : 2)
        let dx = 0
        let dy = 0
        if (key === 'arrowup') dy = -step
        else if (key === 'arrowdown') dy = step
        else if (key === 'arrowleft') dx = -step
        else if (key === 'arrowright') dx = step
        state.selection.forEach((id) => {
          const l = state.composite.layers.find((layer) => layer.id === id)
          if (l && !l.locked) {
            state.update(id, { x: l.x + dx, y: l.y + dy })
          }
        })
      }
      else if (
        !mod &&
        state.selection.length &&
        (key === '+' || key === '=' || e.code === 'NumpadAdd' || key === '-' || key === '_' || e.code === 'NumpadSubtract')
      ) {
        const isPlus = key === '+' || key === '=' || e.code === 'NumpadAdd'
        const step = e.altKey ? 25 : 5
        // Phím +: layer tiến ra phía trước (tiền cảnh, gần camera hơn -> Z âm hơn)
        // Phím -: layer lùi sâu về phía sau (hậu cảnh, xa camera hơn -> Z dương hơn)
        const dz = isPlus ? -step : step
        state.selection.forEach((id) => {
          const l = state.composite.layers.find((layer) => layer.id === id)
          if (l && !l.locked) {
            state.update(id, { z: Math.max(-2000, Math.min(2000, Math.round(l.z + dz))) })
          }
        })
      }
      else return
      e.preventDefault(); e.stopImmediatePropagation()
    }
    const end = () => state.history.end()
    window.addEventListener('keydown', handle, true)
    window.addEventListener('keyup', end)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('keydown', handle, true)
      window.removeEventListener('keyup', end)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [state, togglePlay, close])
}
