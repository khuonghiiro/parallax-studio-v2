import { useSyncExternalStore } from 'react'
import type { PlantSpinePresetId } from '@shared/plantSpine'
import type { PlantSpineTarget } from './workshopPlantSpines'

/** Trạng thái giao diện tab "Thực vật": dùng chung giữa bảng điều khiển bên phải và lớp vẽ 2D. */
export interface PlantSpineEditorState {
  preset: PlantSpinePresetId
  target: PlantSpineTarget
  selectedSpineId: string | null
}

let state: PlantSpineEditorState = { preset: 'sapling', target: 'selected', selectedSpineId: null }
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
