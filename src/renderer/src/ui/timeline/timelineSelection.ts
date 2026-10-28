import { create } from 'zustand'
import { useEditor } from '../../store/editor'
import { intervalBounds, intervalId, type TimelineInterval } from '../../project/timelineIntervals'

export const useTimelineSelection = create<{
  intervals: TimelineInterval[]
  pick: (item: TimelineInterval, toggle?: boolean) => void
  clear: () => void
}>((set) => ({
  intervals: [],
  pick: (item, toggle = false) => set(s => {
    const has = s.intervals.some(i => intervalId(i) === intervalId(item))
    return { intervals: toggle ? has ? s.intervals.filter(i => intervalId(i) !== intervalId(item)) : [...s.intervals, item]
      : has ? s.intervals : [item] }
  }),
  clear: () => set({ intervals: [] })
}))
export function selectedIntervals(): TimelineInterval[] {
  return useTimelineSelection.getState().intervals.filter(i => intervalBounds(useEditor.getState().project, i))
}
useEditor.subscribe((state, previous) => {
  if (state.epoch !== previous.epoch) useTimelineSelection.getState().clear()
})
