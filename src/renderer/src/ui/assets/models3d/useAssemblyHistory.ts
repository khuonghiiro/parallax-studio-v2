import { useCallback, useRef, useState } from 'react'
import type { Model3D } from './types'

/**
 * Local undo/redo history for the Assembly workshop (the workshop edits a draft model,
 * not the project store, so it keeps its own stack).
 *
 * - Rapid successive edits (slider scrubs, arrow-key holds, typing) within MERGE_MS are
 *   merged into one entry.
 * - While a gesture is active (gizmo / viewport drag) every update merges into the entry
 *   created by the first update of that gesture → one undo step per gesture.
 * - `{ discrete: true }` always creates its own entry (templates, delete, duplicate…).
 */
const MERGE_MS = 450
const MAX_HISTORY = 120

interface HistoryState {
  past: Model3D[]
  present: Model3D
  future: Model3D[]
}

export type ModelUpdate = Model3D | ((prev: Model3D) => Model3D)

export interface SetModelOptions {
  discrete?: boolean
}

export function useAssemblyHistory(initial: Model3D) {
  const [state, setState] = useState<HistoryState>({ past: [], present: initial, future: [] })
  const lastEditRef = useRef(0)
  const gestureRef = useRef<'idle' | 'start' | 'active'>('idle')

  const setModel = useCallback((update: ModelUpdate, opts: SetModelOptions = {}) => {
    const now = performance.now()
    let merge: boolean
    if (opts.discrete) {
      merge = false
    } else if (gestureRef.current === 'start') {
      merge = false
      gestureRef.current = 'active'
    } else if (gestureRef.current === 'active') {
      merge = true
    } else {
      merge = now - lastEditRef.current < MERGE_MS
    }
    lastEditRef.current = opts.discrete ? 0 : now
    setState((s) => {
      const next = typeof update === 'function' ? update(s.present) : update
      if (next === s.present) return s
      const past = merge && s.past.length > 0 ? s.past : [...s.past, s.present].slice(-MAX_HISTORY)
      return { past, present: next, future: [] }
    })
  }, [])

  const setGestureActive = useCallback((active: boolean) => {
    gestureRef.current = active ? 'start' : 'idle'
    lastEditRef.current = 0
  }, [])

  const undo = useCallback(() => {
    lastEditRef.current = 0
    setState((s) => {
      if (s.past.length === 0) return s
      const prev = s.past[s.past.length - 1]
      return { past: s.past.slice(0, -1), present: prev, future: [s.present, ...s.future] }
    })
  }, [])

  const redo = useCallback(() => {
    lastEditRef.current = 0
    setState((s) => {
      if (s.future.length === 0) return s
      const [next, ...rest] = s.future
      return { past: [...s.past, s.present], present: next, future: rest }
    })
  }, [])

  return {
    model: state.present,
    setModel,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    setGestureActive
  }
}
