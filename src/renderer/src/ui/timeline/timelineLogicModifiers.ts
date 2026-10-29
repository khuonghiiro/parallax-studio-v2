import type { TimelineInterval } from '../../project/timelineIntervals'
import { useTimelineSelection } from './timelineSelection'

type LogicEvent = { ctrlKey: boolean; metaKey: boolean; detail: number; preventDefault(): void; stopPropagation(): void }
export function logicPointerDown(event: LogicEvent, item?: TimelineInterval): void {
  event.stopPropagation()
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  if (item) useTimelineSelection.getState().pick(item, true)
}
export function canOpenTimelineLogic(event: LogicEvent, item?: TimelineInterval): boolean {
  event.stopPropagation()
  if (!event.ctrlKey && !event.metaKey) return true
  event.preventDefault()
  // Keyboard/MCP clicks have no preceding pointerdown; physical clicks already toggled there.
  if (event.detail === 0 && item) useTimelineSelection.getState().pick(item, true)
  return false
}
