import { useSyncExternalStore } from 'react'
import { type MotionSketchState, DEFAULT_SKETCH_STATE } from './workshopMotionSketch'

let state: MotionSketchState = { ...DEFAULT_SKETCH_STATE }
const listeners = new Set<() => void>()

export function getMotionSketchState(): MotionSketchState {
  return state
}

export function setMotionSketchState(
  patch: Partial<MotionSketchState> | ((prev: MotionSketchState) => MotionSketchState)
): void {
  if (typeof patch === 'function') {
    state = patch(state)
  } else {
    state = { ...state, ...patch }
  }
  listeners.forEach((l) => l())
}

export function resetMotionSketchState(): void {
  state = { ...DEFAULT_SKETCH_STATE }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useMotionSketch(): MotionSketchState {
  return useSyncExternalStore(subscribe, getMotionSketchState, getMotionSketchState)
}
