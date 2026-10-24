import { create } from 'zustand'
import type { EaseName, EaseOptions } from '@shared/types'
import { getAnimatable, getDraftAnimatable, propRefKey, useEditor, type PropRef } from '../../store/editor'
import { timelineSegmentAt } from '../../animation/timelineRange'
import { parseEaseOptions } from '../../animation/easeOptions'
import { focusTimelineProperty } from './timelineKeyEditing'
import { IconMotionBlink, IconMotionHold, IconMotionLinear, IconMotionPulse, IconMotionSmooth } from '../icons'

export const MOTION_MODES = [
  { value: 'easeInOut', label: 'Đi mượt', Icon: IconMotionSmooth },
  { value: 'linear', label: 'Đi đều', Icon: IconMotionLinear },
  { value: 'hold', label: 'Giữ rồi nhảy', Icon: IconMotionHold },
  { value: 'pulse', label: 'Nhịp đập', Icon: IconMotionPulse },
  { value: 'blink', label: 'Nhấp nháy', Icon: IconMotionBlink }
] as const

type MotionPopup = { ref: PropRef; time: number; x: number; y: number; id: string }
export const useMotionPopup = create<{ popup: MotionPopup | null }>(() => ({ popup: null }))
export const closeMotionPopup = () => useMotionPopup.setState({ popup: null })
export function openMotionPopup(ref: PropRef, point: { clientX: number; clientY: number }, time = useEditor.getState().time) {
  focusTimelineProperty(ref)
  useEditor.getState().setPlaying(false)
  useEditor.getState().setTime(time)
  useMotionPopup.setState({ popup: { ref, time, x: point.clientX, y: point.clientY, id: `${propRefKey(ref)}-${time}` } })
}

export function applyTimelineMotion(ref: PropRef, time: number, mode: EaseName, options?: EaseOptions) {
  const editor = useEditor.getState()
  const layer = ref.kind === 'layer' ? editor.project.layers.find(l => l.id === ref.layerId) : null
  if (layer?.locked) return
  const animation = getAnimatable(editor.project, ref)
  if (!animation || !timelineSegmentAt(animation, time).start) return
  const parsed = options ? parseEaseOptions(options) : undefined
  editor.update(draft => {
    const a = getDraftAnimatable(draft, ref)!
    const start = timelineSegmentAt(a, time).start!
    start.ease = mode
    if (parsed) start.easeOptions = parsed
  })
}
