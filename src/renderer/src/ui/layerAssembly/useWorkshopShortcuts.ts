import { useEffect, useRef } from 'react'
import type { useLayerWorkshop } from './useLayerWorkshop'
import { applyRigAction, ensureRigClips } from './workshopRig'
import { expandLinkedSelection } from './workshopParts'
import {
  BONE_Z_ORDER_LARGE_STEP,
  BONE_Z_ORDER_STEP,
  applyBoneZOrderStep
} from './workshopBoneDepthOrder'

export interface WorkshopBoneContext {
  primaryMode?: 'assembly' | 'cutter'
  tab?: string
  boneId?: string | null
  selectBone?: (id: string | null) => void
  time?: number
  stopPlayback?: () => void
  isErasing?: boolean
}

export function handleWorkshopKeydown(
  e: KeyboardEvent,
  state: ReturnType<typeof useLayerWorkshop>,
  togglePlay: () => void,
  close: () => void,
  ctx?: WorkshopBoneContext
) {
  if (ctx?.primaryMode === 'cutter') return
  if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')) {
    e.stopPropagation()
    return
  }
  // Timeline owns key deletion and drag cancellation; never delete a bone here.
  if ((e.target as Element)?.closest?.('.lw-animation-timeline') && ['Escape', 'Delete', 'Backspace'].includes(e.key)) {
    return
  }
  const mod = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()
  // The viewport/gizmo owns Escape while a gesture is active.
  if (e.key === 'Escape' && state.history.gestureActive) return
  if (state.history.gestureActive && mod && (key === 'z' || key === 'y')) {
    e.preventDefault()
    e.stopImmediatePropagation()
    return
  }
  if (mod && key === 'z') e.shiftKey ? state.redo() : state.undo()
  else if (mod && key === 'y') state.redo()
  else if (mod && key === 'a') state.setIds(state.composite.layers.map((l) => l.id))
  else if (mod && key === 'd') state.run('duplicate')
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (ctx?.boneId && ctx.tab === 'bones') {
      const targetBoneId = ctx.boneId
      state.setComposite((c) => applyRigAction(c, { action: 'delete-bone', boneId: targetBoneId }))
      ctx.selectBone?.(null)
    } else if (state.selection.length && ctx?.tab !== 'animation' && ctx?.tab !== 'plant') {
      state.run('delete')
    }
  } else if (e.code === 'Space') {
    if (ctx?.isErasing) {
      return
    }
    togglePlay()
  } else if (e.key === 'Escape') {
    if (ctx?.boneId) ctx.selectBone?.(null)
    else if (state.selection.length) state.select(null)
    else close()
  } else if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && state.selection.length) {
    if (!state.history.gestureActive) state.history.begin()
    const step = e.shiftKey ? 10 : e.altKey ? 1 : 2
    let dx = 0
    let dy = 0
    if (key === 'arrowup') dy = -step
    else if (key === 'arrowdown') dy = step
    else if (key === 'arrowleft') dx = -step
    else if (key === 'arrowright') dy = step
    expandLinkedSelection(state.composite, state.selection).forEach((id) => {
      const l = state.composite.layers.find((layer) => layer.id === id)
      if (l && !l.locked) {
        state.update(id, { x: l.x + dx, y: l.y + dy })
      }
    })
  } else if (
    !mod &&
    (key === '+' || key === '=' || e.code === 'NumpadAdd' || key === '-' || key === '_' || e.code === 'NumpadSubtract')
  ) {
    const isPlus = key === '+' || key === '=' || e.code === 'NumpadAdd'
    const activeRig = state.composite.rig ? ensureRigClips(state.composite.rig).rig : null

    if (ctx?.tab === 'animation' && activeRig && activeRig.bones.length > 0) {
      const selectedBoneExists = ctx.boneId && activeRig.bones.some((b) => b.id === ctx.boneId)
      const layerBoneId = state.selection
        .map((id) => state.composite.layers.find((l) => l.id === id)?.boneId)
        .find((bid): bid is string => !!bid && activeRig.bones.some((b) => b.id === bid))
      const targetBoneId = selectedBoneExists ? ctx.boneId! : layerBoneId ?? activeRig.bones[0].id
      const delta = (isPlus ? 1 : -1) * (e.altKey ? BONE_Z_ORDER_LARGE_STEP : BONE_Z_ORDER_STEP)
      ctx.stopPlayback?.()
      state.setComposite((c) => applyBoneZOrderStep(c, targetBoneId, ctx.time ?? 0, delta))
      if (ctx.boneId !== targetBoneId) {
        ctx.selectBone?.(targetBoneId)
      }
    } else if (state.selection.length && ctx?.tab !== 'plant') {
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
    } else {
      return
    }
  } else return
  e.preventDefault()
  e.stopImmediatePropagation()
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
    const handle = (e: KeyboardEvent) => handleWorkshopKeydown(e, state, togglePlay, close, boneCtxRef.current)
    const end = () => state.history.end()
    const endKey = (e: KeyboardEvent) => {
      if (e.key.startsWith('Arrow')) end()
    }
    window.addEventListener('keydown', handle, true)
    window.addEventListener('keyup', endKey)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('keydown', handle, true)
      window.removeEventListener('keyup', endKey)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [state, togglePlay, close])
}
