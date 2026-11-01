import { create } from 'zustand'
import { useEditor } from '../../store/editor'

/**
 * Chọn nhiều Node trên sơ đồ Workflow V2 (Ctrl/⌘ + nhấp, Shift + kéo khung, hoặc bật chế độ "Chọn nhiều" trên cảm ứng).
 * Dùng để gom nhanh nhiều Node vào một nhóm Time chung, nối vào nhóm có sẵn hoặc kéo dời cùng lúc.
 */
export const useWorkflowMultiSelect = create<{
  ids: string[]
  /** Chế độ chạm để chọn nhiều (điện thoại / máy tính bảng không có phím Ctrl/Shift) */
  mode: boolean
  toggle: (id: string, seed?: string | null) => void
  set: (ids: string[]) => void
  add: (ids: string[]) => void
  clear: () => void
  setMode: (on: boolean) => void
}>((set) => ({
  ids: [],
  mode: false,
  toggle: (id, seed) =>
    set((s) => {
      const base = s.ids.length === 0 && seed && seed !== id ? [seed] : s.ids
      return { ids: base.includes(id) ? base.filter((x) => x !== id) : [...base, id] }
    }),
  set: (ids) => set({ ids: [...new Set(ids)] }),
  add: (ids) => set((s) => ({ ids: [...new Set([...s.ids, ...ids])] })),
  clear: () => set({ ids: [] }),
  setMode: (on) => set((s) => ({ mode: on, ids: on ? s.ids : [] }))
}))

// Mở dự án khác / tải lại → bỏ chọn để không giữ id Node không còn tồn tại
useEditor.subscribe((state, previous) => {
  if (state.epoch !== previous.epoch) useWorkflowMultiSelect.getState().clear()
})
