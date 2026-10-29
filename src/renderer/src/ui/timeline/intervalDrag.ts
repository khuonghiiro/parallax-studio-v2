import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEditor } from '../../store/editor'
import { toast } from '../../actions'
import { intervalBounds, intervalId, retimeTimelineIntervals, type TimelineInterval } from '../../project/timelineIntervals'
import { selectedIntervals, useTimelineSelection } from './timelineSelection'

type PreviewGeometry = { el: HTMLElement; left: string; width: string; item: TimelineInterval }
function clampDragDelta(source: ReturnType<typeof useEditor.getState>['project'], items: TimelineInterval[],
  anchor: TimelineInterval, mode: 'move' | 'in' | 'out', delta: number): number {
  const bounds = items.map(item => intervalBounds(source, item)!).filter(Boolean)
  const origin = intervalBounds(source, anchor)!
  const frame = 1 / source.comp.fps
  const minStart = Math.min(...bounds.map(b => b.start))
  const maxEnd = Math.max(...bounds.map(b => b.end))
  if (mode === 'move') return Math.max(-minStart, Math.min(source.comp.duration - maxEnd, delta))
  const lower = mode === 'in' ? 0 : Math.max(...bounds.map(b => b.start)) + frame
  const upper = mode === 'out' ? source.comp.duration : Math.min(...bounds.map(b => b.end)) - frame
  const boundary = mode === 'in' ? origin.start : origin.end
  return Math.max(lower, Math.min(upper, boundary + delta)) - boundary
}
function previewTrim(mode: 'move' | 'in' | 'out', pending: number, source: ReturnType<typeof useEditor.getState>['project'],
  item: TimelineInterval, geometry: PreviewGeometry[], pixelsPerSecond: number): void {
    if (mode !== 'move') {
      const anchor = intervalBounds(source, item)!
      const boundary = (mode === 'in' ? anchor.start : anchor.end) + pending
      for (const g of geometry) {
        const bounds = intervalBounds(source, g.item)!
        const start = mode === 'in' ? boundary : bounds.start
        const end = mode === 'out' ? boundary : bounds.end
        if (start < 0 || end > source.comp.duration || end <= start) continue
        g.el.style.left = `${parseFloat(g.left) + (start - bounds.start) * pixelsPerSecond}px`
        g.el.style.width = `${(end - start) * pixelsPerSecond}px`
      }
    }
}

/** Preview bars without touching history; commit the whole gesture once on release. */
export function startIntervalDrag(event: ReactPointerEvent, item: TimelineInterval, pixelsPerSecond: number,
  mode: 'move' | 'in' | 'out' = 'move'): void {
  event.stopPropagation()
  if (event.button !== 0 || !intervalBounds(useEditor.getState().project, item)) return
  event.preventDefault()
  const selection = useTimelineSelection.getState()
  selection.pick(item, event.ctrlKey || event.metaKey)
  useEditor.getState().selectLayer(item.layerId)
  if (event.ctrlKey || event.metaKey || pixelsPerSecond <= 0) return
  const items = selectedIntervals()
  const source = useEditor.getState().project
  const element = event.currentTarget as HTMLElement
  const startX = event.clientX
  let finished = false
  let pending = 0
  let moved = false
  const previews = [...document.querySelectorAll<HTMLElement>('[data-timeline-interval]')]
    .filter(el => items.some(i => intervalId(i) === el.dataset.timelineInterval))
  const geometry = previews.map(el => ({ el, left: el.style.left, width: el.style.width,
    item: items.find(i => intervalId(i) === el.dataset.timelineInterval)! }))
  const move = (e: PointerEvent): void => {
    if (e.pointerId !== event.pointerId) return
    if (!moved && Math.abs(e.clientX - startX) < 3) return
    moved = true
    pending = Math.round((e.clientX - startX) / pixelsPerSecond * source.comp.fps) / source.comp.fps
    pending = clampDragDelta(source, items, item, mode, pending)
    for (const el of previews) {
      if (mode === 'move') el.style.translate = `${pending * pixelsPerSecond}px 0`
      el.classList.add('is-retiming')
    }
    previewTrim(mode, pending, source, item, geometry, pixelsPerSecond)
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
    for (const g of geometry) { g.el.style.translate = ''; g.el.style.left = g.left; g.el.style.width = g.width; g.el.classList.remove('is-retiming') }
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
    if (commit && !moved) useTimelineSelection.setState({ intervals: [item] })
    if (!commit || !moved || source !== useEditor.getState().project) return
    try {
      const anchor = intervalBounds(source, item)!
      useEditor.getState().update(d => retimeTimelineIntervals(d, items, mode === 'move' ? 'shift' : mode,
        mode === 'move' ? pending : (mode === 'in' ? anchor.start : anchor.end) + pending))
    } catch (error) { toast(error instanceof Error ? error.message : String(error)) }
  }
  const up = (e: PointerEvent): void => { if (e.pointerId === event.pointerId) finish(true) }
  const cancel = (): void => finish(false)
  const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel() } }
  element.setPointerCapture(event.pointerId)
  element.addEventListener('pointermove', move)
  element.addEventListener('pointerup', up)
  element.addEventListener('pointercancel', cancel)
  element.addEventListener('lostpointercapture', cancel)
  window.addEventListener('keydown', key, true)
  window.addEventListener('blur', cancel)
}
