import type { PointerEvent as ReactPointerEvent } from 'react'
import type { AppliedLayerEffect, Layer } from '@shared/types'
import { dragEffectTiming, retimeLayerEffect, type EffectDragMode, type EffectTiming } from '../../animation/effectTiming'
import { useEditor } from '../../store/editor'

/** Preview geometry locally; release commits once, Escape/cancel leaves project and history untouched. */
export function startEffectDrag(e: ReactPointerEvent, layer: Layer, effect: AppliedLayerEffect,
  mode: EffectDragMode, pixelsPerSecond: number, preview: (timing: EffectTiming | null) => void): (() => void) | undefined {
  e.stopPropagation()
  if (e.button !== 0 || layer.locked || pixelsPerSecond <= 0) return
  e.preventDefault()
  const element = e.currentTarget as HTMLElement
  const startX = e.clientX
  const epoch = useEditor.getState().epoch
  const sourceProject = useEditor.getState().project
  const { fps, duration } = useEditor.getState().project.comp
  let pending: EffectTiming | null = null
  let finished = false
  element.setPointerCapture(e.pointerId)
  const move = (event: PointerEvent): void => {
    if (event.pointerId !== e.pointerId || Math.abs(event.clientX - startX) < 3 && !pending) return
    pending = dragEffectTiming(effect, layer.outPoint, (event.clientX - startX) / pixelsPerSecond, mode, fps, duration)
    preview(pending)
  }
  const finish = (commit: boolean): void => {
    if (finished) return
    finished = true
    element.removeEventListener('pointermove', move)
    element.removeEventListener('pointerup', up)
    element.removeEventListener('pointercancel', cancel)
    element.removeEventListener('lostpointercapture', cancel)
    window.removeEventListener('keydown', key, true)
    window.removeEventListener('blur', cancel)
    if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId)
    preview(null)
    if (!commit || !pending || useEditor.getState().epoch !== epoch || useEditor.getState().project !== sourceProject) return
    const timing = pending
    useEditor.getState().update((project) => {
      const current = project.layers.find((l) => l.id === layer.id)
      if (!current || current.locked) return
      if (current.appliedEffects?.some((fx) => fx.id === effect.id) || effect.id === `legacy-motion-${current.id}` && current.motion) {
        retimeLayerEffect(current, effect.id, timing)
      }
    })
  }
  const up = (event: PointerEvent): void => { if (event.pointerId === e.pointerId) finish(true) }
  const cancel = (): void => finish(false)
  const key = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(false) }
  }
  element.addEventListener('pointermove', move)
  element.addEventListener('pointerup', up)
  element.addEventListener('pointercancel', cancel)
  element.addEventListener('lostpointercapture', cancel)
  window.addEventListener('keydown', key, true)
  window.addEventListener('blur', cancel)
  return cancel
}
