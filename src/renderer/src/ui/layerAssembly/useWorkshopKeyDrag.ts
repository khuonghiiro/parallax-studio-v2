import { useRef, useState, type PointerEvent } from 'react'
import type { RigAction } from './workshopRig'
import { sameKeyTime } from './workshopAnimation'
import { timelineTime } from './workshopTimeline'

export interface TimelineKey { boneId: string; time: number }
interface Drag extends TimelineKey { target: number; startX: number; moved: boolean; left: number; width: number }

export function useWorkshopKeyDrag(duration: number, fps: number, seek: (time: number) => void,
  select: (key: TimelineKey) => void, run: (action: RigAction) => boolean) {
  const ref = useRef<Drag | null>(null)
  const [ghost, setGhost] = useState<(TimelineKey & { target: number }) | null>(null)
  const start = (event: PointerEvent<HTMLButtonElement>, key: TimelineKey) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const rect = event.currentTarget.parentElement!.getBoundingClientRect()
    ref.current = { ...key, target: key.time, startX: event.clientX, moved: false, left: rect.left, width: rect.width }
    select(key); seek(key.time)
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent) => {
    const drag = ref.current
    if (!drag) return
    if (Math.abs(event.clientX - drag.startX) > 3) drag.moved = true
    if (!drag.moved) return
    const originX = drag.left + drag.time / duration * drag.width
    drag.target = timelineTime(originX + event.clientX - drag.startX, drag.left, drag.width, duration, fps, !event.altKey)
    setGhost({ boneId: drag.boneId, time: drag.time, target: drag.target }); seek(drag.target)
  }
  const cancel = () => {
    if (ref.current) seek(ref.current.time)
    ref.current = null; setGhost(null)
  }
  const end = () => {
    const drag = ref.current
    ref.current = null; setGhost(null)
    if (!drag?.moved || sameKeyTime(drag.time, drag.target)) return
    if (run({ action: 'move-key', boneId: drag.boneId, time: drag.time, targetTime: drag.target })) {
      select({ boneId: drag.boneId, time: drag.target })
    } else seek(drag.time)
  }
  return { ghost, start, move, end, cancel }
}
