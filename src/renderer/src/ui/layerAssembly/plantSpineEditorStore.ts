import { useSyncExternalStore } from 'react'
import type { PlantSpinePresetId } from '@shared/plantSpine'
import type { PlantSpineTarget } from './workshopPlantSpines'
import type { PlantRecordEnd } from './plantMotionRecord'

/** record = nắm ngọn kéo để GHI chuyển động vẽ tay · learn = học thông số gió (biên độ / nghiêng / nhịp). */
export type PlantGrabMode = 'record' | 'learn'

/** Trạng thái giao diện tab "Thực vật": dùng chung giữa bảng điều khiển bên phải, lớp vẽ 2D và workspace. */
export interface PlantSpineEditorState {
  preset: PlantSpinePresetId
  target: PlantSpineTarget
  selectedSpineId: string | null
  /** Xem gió trực tiếp: cây tự đung đưa ngay trong tab Thực vật dù chưa bấm phát. */
  live: boolean
  /** Đang nắm ngọn kéo: cây uốn tĩnh theo tay (ghi đè tạm thời). elapsed = giây đã ghi khi đang ghi chuyển động. */
  grab: { spineId: string; angle: number; stretch?: number; elapsed?: number; recording?: boolean } | null
  /** Đang kéo chấm/xương: tạm dừng gió trực tiếp để dễ căn chỉnh. */
  dragging: boolean
  /** Hành vi của tay nắm ngọn. */
  grabMode: PlantGrabMode
  /** Bật "Vẽ quỹ đạo ngọn" (phím R): nhấn giữ bất kỳ đâu trên khung để ngọn bám theo bút và ghi chuyển động. */
  pathRecord: boolean
  /** Sau khi thả tay: lặp đúng cử chỉ, hay bật nảy tắt dần về nghỉ. */
  recordEnd: PlantRecordEnd
}

let state: PlantSpineEditorState = {
  preset: 'sapling',
  target: 'auto',
  selectedSpineId: null,
  live: true,
  grab: null,
  dragging: false,
  grabMode: 'record',
  pathRecord: false,
  recordEnd: 'loop'
}
const listeners = new Set<() => void>()

export function getPlantSpineEditorState(): PlantSpineEditorState {
  return state
}

export function setPlantSpineEditorState(patch: Partial<PlantSpineEditorState>): void {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePlantSpineEditor(): PlantSpineEditorState {
  return useSyncExternalStore(subscribe, getPlantSpineEditorState, getPlantSpineEditorState)
}
