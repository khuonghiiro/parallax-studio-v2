import { create } from 'zustand'
import type { EaseName } from '@shared/types'
import { addKeyframe, evaluate, keyAt, removeKeyframe } from '../../animation/keyframes'
import { endTimelineRange, startTimelineRange, timelineSegmentAt } from '../../animation/timelineRange'
import { frameTolerance, getAnimatable, getDraftAnimatable, propRefKey, useEditor, type PropRef } from '../../store/editor'
import { toast } from '../../actions'

export const useTimelineProperty = create<{ ref: PropRef | null }>(() => ({ ref: null }))

export function sameTimelineRef(a: PropRef | null | undefined, b: PropRef | null | undefined) {
  return !!a && !!b && propRefKey(a) === propRefKey(b)
}

export function useActiveTimelineProperty(ref: PropRef) {
  const active = useTimelineProperty(s => s.ref)
  const selectedKey = useEditor(s => s.selectedKey?.ref)
  const layerId = useEditor(s => s.selectedLayerId)
  return ref.kind === 'layer' && layerId === ref.layerId &&
    sameTimelineRef(selectedKey ?? active, ref)
}

export function focusTimelineProperty(ref: PropRef) {
  const editor = useEditor.getState()
  if (ref.kind === 'layer' && editor.selectedLayerId !== ref.layerId) editor.selectLayer(ref.layerId)
  const selected = editor.selectedKey?.ref
  if (selected && !sameTimelineRef(selected, ref)) editor.selectKey(null)
  useTimelineProperty.setState({ ref })
}

function canEdit(ref: PropRef) {
  const project = useEditor.getState().project
  return !!getAnimatable(project, ref) && (ref.kind !== 'layer' ||
    project.layers.some(layer => layer.id === ref.layerId && !layer.locked))
}

export function jumpTimelineKey(ref: PropRef, id: string, time: number) {
  const editor = useEditor.getState()
  focusTimelineProperty(ref)
  editor.setPlaying(false)
  editor.setTime(time)
  editor.selectKey({ ref, keyId: id })
}

export function addTimelineKey(ref: PropRef, boundary?: 'start' | 'end') {
  if (!canEdit(ref)) return
  const editor = useEditor.getState()
  const time = editor.time
  const tolerance = frameTolerance(editor.project)
  const existing = keyAt(getAnimatable(editor.project, ref)!, time, tolerance)
  if (existing && !boundary) return jumpTimelineKey(ref, existing.id, existing.t)
  let id = ''
  try {
    editor.update(draft => {
      const a = getDraftAnimatable(draft, ref)!
      if (boundary === 'start' || !a.keyframes.length) id = startTimelineRange(a, time, tolerance).id
      else if (boundary === 'end') id = endTimelineRange(a, time, tolerance).id
      else if (time > a.keyframes.at(-1)!.t) {
        const last = a.keyframes.at(-1)!
        if (last.timelineBoundary === 'end') {
          last.ease = a.keyframes.at(-2)?.ease ?? 'easeInOut'
          last.easeOptions = a.keyframes.at(-2)?.easeOptions
          last.timelineBoundary = 'start'
        }
        id = endTimelineRange(a, time, tolerance).id
      }
      else {
        const previous = a.keyframes.filter(k => k.t < time).at(-1)
        const isSilentGuard = previous && previous.t === 0 && !previous.timelineBoundary && previous.ease === 'hold'
        const inheritedEase = isSilentGuard ? 'easeInOut' : (previous?.ease ?? 'easeInOut')
        const key = addKeyframe(a, time, evaluate(a, time), inheritedEase, tolerance)
        if (isSilentGuard) key.timelineBoundary = 'start'
        else if (previous?.easeOptions) key.easeOptions = { ...previous.easeOptions }
        id = key.id
      }
    })
    if (id) jumpTimelineKey(ref, id, time)
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Không thể tạo mốc tại thời điểm này')
  }
}

export function removeTimelineKeyAt(ref: PropRef, time = useEditor.getState().time): boolean {
  if (!canEdit(ref)) return false
  const editor = useEditor.getState()
  const tolerance = frameTolerance(editor.project)
  const anim = getAnimatable(editor.project, ref)
  const existing = anim ? keyAt(anim, time, tolerance) : undefined
  if (!existing) return false
  focusTimelineProperty(ref)
  editor.setPlaying(false)
  editor.update(draft => {
    const a = getDraftAnimatable(draft, ref)!
    removeKeyframe(a, existing.id)
    if (
      a.keyframes.length === 1 &&
      a.keyframes[0].t === 0 &&
      !a.keyframes[0].timelineBoundary &&
      a.keyframes[0].ease === 'hold'
    ) {
      a.keyframes = []
    }
  })
  if (editor.selectedKey?.keyId === existing.id) editor.selectKey(null)
  return true
}

export function toggleTimelineKey(ref: PropRef) {
  if (!canEdit(ref)) return
  const editor = useEditor.getState()
  const tolerance = frameTolerance(editor.project)
  const anim = getAnimatable(editor.project, ref)
  const existing = anim ? keyAt(anim, editor.time, tolerance) : undefined
  if (existing) {
    removeTimelineKeyAt(ref, editor.time)
    return
  }
  addTimelineKey(ref)
}

export function setTimelineEase(ref: PropRef, ease: EaseName) {
  if (!canEdit(ref)) return
  const editor = useEditor.getState()
  editor.setPlaying(false)
  editor.update(draft => {
    const a = getDraftAnimatable(draft, ref)!
    const { start } = timelineSegmentAt(a, editor.time)
    if (start) start.ease = ease
  })
}

export function navigateTimelineKey(ref: PropRef, direction: -1 | 1) {
  const editor = useEditor.getState()
  const a = getAnimatable(editor.project, ref)
  const tolerance = frameTolerance(editor.project)
  const key = direction < 0 ? a?.keyframes.filter(k => k.t < editor.time - tolerance).at(-1)
    : a?.keyframes.find(k => k.t > editor.time + tolerance)
  if (key) jumpTimelineKey(ref, key.id, key.t)
}

export function activeTimelineRef(): PropRef | null {
  const editor = useEditor.getState()
  const selected = editor.selectedKey?.ref
  const active = useTimelineProperty.getState().ref
  if (!editor.selectedLayerId) return null
  if (selected?.kind === 'layer' && selected.layerId === editor.selectedLayerId) return selected
  if (active?.kind === 'layer' && active.layerId === editor.selectedLayerId) return active
  return { kind: 'layer', layerId: editor.selectedLayerId, prop: 'position' }
}

/** Runs before generic shortcuts; never consumes text editing events. */
export function handleTimelineKeyShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.isComposing || event.repeat) return false
  const target = event.target as HTMLElement | null
  if (target?.matches('input, textarea, select') || target?.isContentEditable) return false
  const ref = activeTimelineRef()
  if (!ref) return false
  const key = event.key.toLowerCase()
  if (!event.altKey && !event.shiftKey && (key === 'arrowup' || key === 'arrowdown') &&
    target?.closest?.('.tl-property-controls') && ref.kind === 'layer') {
    const props = ['position', 'rotation', 'scale', 'opacity'] as const
    const index = props.indexOf(ref.prop as typeof props[number])
    const prop = props[Math.max(0, Math.min(props.length - 1, index + (key === 'arrowup' ? -1 : 1)))]
    focusTimelineProperty({ ...ref, prop })
    target.closest('.tl-layer-properties')?.querySelector<HTMLElement>(`[data-layer-property="${prop}"]`)?.focus()
  } else if (key === 'k') addTimelineKey(ref, event.altKey ? 'end' : event.shiftKey ? 'start' : undefined)
  else if (event.altKey && (key === 'arrowleft' || key === 'arrowright')) {
    navigateTimelineKey(ref, key === 'arrowleft' ? -1 : 1)
  } else return false
  event.preventDefault()
  return true
}
