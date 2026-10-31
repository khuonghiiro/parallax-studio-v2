import { useRef, useState, type PointerEvent } from 'react'
import type { RigAction } from './workshopRig'
import { sameKeyTime } from './workshopAnimation'
import { timelineTime } from './workshopTimeline'

export interface TimelineKey {
  boneId: string
  time: number
}

interface MultiKeyDragState {
  anchor: TimelineKey
  group: TimelineKey[]
  delta: number
  minDelta: number
  maxDelta: number
  startX: number
  moved: boolean
  left: number
  width: number
}

export interface MultiKeyDragGhost {
  anchor: TimelineKey
  group: TimelineKey[]
  delta: number
  targetAnchorTime: number
}

export function sameTimelineKey(a: TimelineKey, b: TimelineKey): boolean {
  return a.boneId === b.boneId && sameKeyTime(a.time, b.time)
}

export function dedupeTimelineKeys(keys: TimelineKey[]): TimelineKey[] {
  const out: TimelineKey[] = []
  for (const k of keys) {
    if (!out.some((x) => sameTimelineKey(x, k))) out.push(k)
  }
  return out
}

export function useWorkshopKeyDrag(
  duration: number,
  fps: number,
  seek: (time: number) => void,
  onCommitSelection: (nextSelection: TimelineKey[], primaryBoneId?: string) => void,
  run: (action: RigAction) => boolean
) {
  const ref = useRef<MultiKeyDragState | null>(null)
  const [ghost, setGhost] = useState<MultiKeyDragGhost | null>(null)

  const start = (
    event: PointerEvent<HTMLButtonElement>,
    anchor: TimelineKey,
    groupKeys: TimelineKey[],
    onClickWithoutDrag?: () => void
  ) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const lane = event.currentTarget.parentElement
    if (!lane) return
    const rect = lane.getBoundingClientRect()
    const cleanGroup = dedupeTimelineKeys(groupKeys.length ? groupKeys : [anchor])
    const minTime = Math.min(...cleanGroup.map((k) => k.time))
    const maxTime = Math.max(...cleanGroup.map((k) => k.time))

    ref.current = {
      anchor,
      group: cleanGroup,
      delta: 0,
      minDelta: -minTime,
      maxDelta: Math.max(0, duration - maxTime),
      startX: event.clientX,
      moved: false,
      left: rect.left,
      width: rect.width
    }
    ;(ref.current as MultiKeyDragState & { onClickWithoutDrag?: () => void }).onClickWithoutDrag = onClickWithoutDrag
    seek(anchor.time)
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const move = (event: PointerEvent) => {
    const drag = ref.current
    if (!drag) return
    if (Math.abs(event.clientX - drag.startX) > 3) drag.moved = true
    if (!drag.moved) return
    const originX = drag.left + (drag.anchor.time / Math.max(0.01, duration)) * drag.width
    const rawTarget = timelineTime(originX + event.clientX - drag.startX, drag.left, drag.width, duration, fps, !event.altKey)
    const rawDelta = rawTarget - drag.anchor.time
    const clampedDelta = Math.max(drag.minDelta, Math.min(drag.maxDelta, rawDelta))
    const snappedTarget = Number((drag.anchor.time + clampedDelta).toFixed(4))
    drag.delta = snappedTarget - drag.anchor.time
    setGhost({
      anchor: drag.anchor,
      group: drag.group,
      delta: drag.delta,
      targetAnchorTime: snappedTarget
    })
    seek(snappedTarget)
  }

  const cancel = () => {
    if (ref.current) seek(ref.current.anchor.time)
    ref.current = null
    setGhost(null)
  }

  const end = () => {
    const drag = ref.current as (MultiKeyDragState & { onClickWithoutDrag?: () => void }) | null
    ref.current = null
    setGhost(null)
    if (!drag) return
    if (!drag.moved) {
      drag.onClickWithoutDrag?.()
      return
    }
    if (Math.abs(drag.delta) <= 1e-4) return

    const moves = drag.group.map((k) => ({
      boneId: k.boneId,
      time: k.time,
      targetTime: Number(Math.max(0, Math.min(duration, k.time + drag.delta)).toFixed(4))
    }))

    const ok =
      moves.length === 1
        ? run({
            action: 'move-keys',
            overwrite: true,
            moves
          })
        : run({
            action: 'move-keys',
            overwrite: true,
            moves
          })

    if (ok) {
      const nextSelection = moves.map((m) => ({ boneId: m.boneId, time: m.targetTime }))
      onCommitSelection(nextSelection, drag.anchor.boneId)
      seek(Number((drag.anchor.time + drag.delta).toFixed(4)))
    } else {
      seek(drag.anchor.time)
    }
  }

  const ghostTimeFor = (boneId: string, time: number): number | null => {
    if (!ghost) return null
    const hit = ghost.group.some((k) => k.boneId === boneId && sameKeyTime(k.time, time))
    if (!hit) return null
    return Number(Math.max(0, Math.min(duration, time + ghost.delta)).toFixed(4))
  }

  return { ghost, ghostTimeFor, start, move, end, cancel }
}
