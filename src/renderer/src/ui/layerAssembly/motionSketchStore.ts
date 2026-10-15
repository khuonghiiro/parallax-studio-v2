import { useSyncExternalStore } from 'react'
import { DEFAULT_SKETCH_SETTINGS, type MotionSketchSettings, type Point2D } from './workshopMotionSketch'

/** Kết quả nét vẽ gần nhất (để hiển thị tóm tắt & vệt mờ trên Bố cục 2D). */
export interface MotionSketchLast {
  boneId: string
  boneName: string
  keyCount: number
  startTime: number
  endTime: number
  stroke: Point2D[]
}

/** Trạng thái giao diện "Vẽ động tác": dùng chung giữa thẻ bên phải, nút nổi trên khung 2D và lớp vẽ. */
export interface MotionSketchUiState {
  /** Bút vẽ động tác đang bật (chuột trái trên Bố cục 2D sẽ vẽ thay vì kéo xương). */
  armed: boolean
  settings: MotionSketchSettings
  last: MotionSketchLast | null
  status: string
}

const INITIAL: MotionSketchUiState = { armed: false, settings: { ...DEFAULT_SKETCH_SETTINGS }, last: null, status: '' }
let state: MotionSketchUiState = INITIAL
const listeners = new Set<() => void>()

export function getMotionSketchState(): MotionSketchUiState {
  return state
}

export function setMotionSketchState(patch: Partial<MotionSketchUiState>): void {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function setMotionSketchSettings(patch: Partial<MotionSketchSettings>): void {
  setMotionSketchState({ settings: { ...state.settings, ...patch } })
}

export function toggleMotionSketchArmed(force?: boolean): void {
  const armed = force ?? !state.armed
  setMotionSketchState({
    armed,
    status: armed ? 'Nhấn gần một xương rồi vẽ đường đi của ngọn xương' : ''
  })
}

export function resetMotionSketchState(): void {
  state = { ...INITIAL, settings: state.settings }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useMotionSketch(): MotionSketchUiState {
  return useSyncExternalStore(subscribe, getMotionSketchState, getMotionSketchState)
}
