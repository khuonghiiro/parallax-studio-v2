import { create } from 'zustand'
import type { Animatable, AnimValue, EaseName, EaseOptions, Keyframe } from '@shared/types'
import { frameTolerance, getAnimatable, getDraftAnimatable, propRefKey, useEditor, type PropRef } from '../../store/editor'
import { startTimelineRange, timelineSegmentAt } from '../../animation/timelineRange'
import { addKeyframe, evaluate } from '../../animation/keyframes'
import { parseEaseOptions } from '../../animation/easeOptions'
import { focusTimelineProperty, jumpTimelineKey } from './timelineKeyEditing'
import { IconMotionBlink, IconMotionHold, IconMotionLinear, IconMotionPulse, IconMotionSmooth } from '../icons'

export const MOTION_MODES = [
  { value: 'easeInOut', label: 'Đi mượt (Bezier)', Icon: IconMotionSmooth },
  { value: 'linear', label: 'Đi đều (Tuyến tính)', Icon: IconMotionLinear },
  { value: 'hold', label: 'Giữ rồi nhảy (Bậc thang)', Icon: IconMotionHold },
  { value: 'pulse', label: 'Nhịp đập (Co giãn)', Icon: IconMotionPulse },
  { value: 'blink', label: 'Nhấp nháy (Chớp tắt)', Icon: IconMotionBlink }
] as const

/** True when a keyframe is the automatic 0s hold guard inserted before a delayed start keyframe. */
export function isSilentHoldGuard(
  animation: Animatable<AnimValue>,
  key: Keyframe<AnimValue> | undefined
): boolean {
  if (!key) return false
  return (
    key.t === 0 &&
    !key.timelineBoundary &&
    key.ease === 'hold' &&
    animation.keyframes.length > 1 &&
    animation.keyframes[0]?.id === key.id &&
    animation.keyframes[1]?.timelineBoundary === 'start'
  )
}

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
  if (!animation) return
  const tolerance = frameTolerance(editor.project)
  const parsed = options ? parseEaseOptions(options) : undefined
  let createdKeyId = ''
  let createdKeyTime = time
  editor.update(draft => {
    const a = getDraftAnimatable(draft, ref)!
    let start = timelineSegmentAt(a, time).start
    if (!start) {
      start = startTimelineRange(a, time, tolerance)
      createdKeyId = start.id
      createdKeyTime = start.t
    } else if (isSilentHoldGuard(a, start)) {
      const nextStart = a.keyframes[1]
      if (nextStart && time < nextStart.t - tolerance) {
        const key = addKeyframe(a, time, evaluate(a, time), mode, tolerance)
        key.timelineBoundary = 'start'
        start = key
        createdKeyId = key.id
        createdKeyTime = key.t
      } else if (nextStart) {
        start = nextStart
      }
    }
    start.ease = mode
    if (parsed) start.easeOptions = parsed
  })
  if (createdKeyId) jumpTimelineKey(ref, createdKeyId, createdKeyTime)
}

export function selectQuickTimelineMotion(
  ref: PropRef,
  time: number,
  mode: EaseName,
  openPopupPoint?: { clientX: number; clientY: number }
) {
  const editor = useEditor.getState()
  const layer = ref.kind === 'layer' ? editor.project.layers.find(l => l.id === ref.layerId) : null
  if (layer?.locked) return
  focusTimelineProperty(ref)
  const animation = getAnimatable(editor.project, ref)
  if (!animation) return
  const start = timelineSegmentAt(animation, time).start
  const effectiveStart = isSilentHoldGuard(animation, start) ? undefined : start
  const isAlreadyActive =
    !!effectiveStart &&
    (effectiveStart.ease === mode || (mode === 'easeInOut' && effectiveStart.ease.startsWith('ease')))
  if (isAlreadyActive && openPopupPoint) {
    openMotionPopup(ref, openPopupPoint, time)
    return
  }
  applyTimelineMotion(ref, time, mode)
}
