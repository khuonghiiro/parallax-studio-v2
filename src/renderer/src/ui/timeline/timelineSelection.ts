import { create } from 'zustand'
import { useEditor } from '../../store/editor'

export const useTimelineSelection = create<{ ids: string[]; toggle: (id: string) => void; clear: () => void }>((set) => ({
  ids: [], toggle: id => set(s => ({ ids: s.ids.includes(id) ? s.ids.filter(x => x !== id) : [...s.ids, id] })),
  clear: () => set({ ids: [] })
}))

export function timelineSelectedIds(): string[] {
  const project = useEditor.getState().project
  return useTimelineSelection.getState().ids.filter(id => project.layers.some(l => l.id === id && !l.locked))
}
