import { useState, useCallback } from 'react'
import type {
  MeshEditorTool,
  BrushSettings,
  CurveSettings,
  LatticeSettings
} from './meshEditorTypes'
import {
  createDefaultMeshEditorState,
  setEditorTool,
  updateBrush,
  updateCurve,
  updateLattice,
  type MeshEditorState
} from './meshEditorState'

export function useMeshSelection() {
  const [state, setState] = useState<MeshEditorState>(createDefaultMeshEditorState)

  const setActiveTool = useCallback((tool: MeshEditorTool) => {
    setState((prev) => setEditorTool(prev, tool))
  }, [])

  const updateBrushSettings = useCallback((patch: Partial<BrushSettings>) => {
    setState((prev) => updateBrush(prev, patch))
  }, [])

  const updateCurveSettings = useCallback((patch: Partial<CurveSettings>) => {
    setState((prev) => updateCurve(prev, patch))
  }, [])

  const updateLatticeSettings = useCallback((patch: Partial<LatticeSettings>) => {
    setState((prev) => updateLattice(prev, patch))
  }, [])

  const resetAllSettings = useCallback(() => {
    setState(createDefaultMeshEditorState())
  }, [])

  return {
    activeTool: state.activeTool,
    setActiveTool,
    brushSettings: state.brushSettings,
    updateBrushSettings,
    curveSettings: state.curveSettings,
    updateCurveSettings,
    latticeSettings: state.latticeSettings,
    updateLatticeSettings,
    resetAllSettings
  }
}
