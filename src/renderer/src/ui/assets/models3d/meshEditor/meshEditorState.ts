import type { Face3D } from '../types'
import type {
  MeshEditorTool,
  BrushSettings,
  CurveSettings,
  LatticeSettings
} from './meshEditorTypes'

export interface MeshEditorState {
  activeTool: MeshEditorTool
  brushSettings: BrushSettings
  curveSettings: CurveSettings
  latticeSettings: LatticeSettings
}

export function createDefaultMeshEditorState(): MeshEditorState {
  return {
    activeTool: 'bend',
    brushSettings: {
      radius: 50,
      strength: 50,
      falloff: 'smooth',
      pinRoot: true,
      frontFacingOnly: true
    },
    curveSettings: {
      preset: 'c-curve',
      numPoints: 4,
      tension: 0.5
    },
    latticeSettings: {
      pinnedBottomRow: true,
      activePointIndex: null
    }
  }
}

export function setEditorTool(state: MeshEditorState, tool: MeshEditorTool): MeshEditorState {
  return { ...state, activeTool: tool }
}

export function updateBrush(
  state: MeshEditorState,
  patch: Partial<BrushSettings>
): MeshEditorState {
  return { ...state, brushSettings: { ...state.brushSettings, ...patch } }
}

export function updateCurve(
  state: MeshEditorState,
  patch: Partial<CurveSettings>
): MeshEditorState {
  return { ...state, curveSettings: { ...state.curveSettings, ...patch } }
}

export function updateLattice(
  state: MeshEditorState,
  patch: Partial<LatticeSettings>
): MeshEditorState {
  return { ...state, latticeSettings: { ...state.latticeSettings, ...patch } }
}

export interface MeshGestureSession {
  faceId: string
  initialFace: Face3D
  currentPatch: Partial<Face3D>
  isDragging: boolean
}

export function startMeshGestureSession(face: Face3D): MeshGestureSession {
  return {
    faceId: face.id,
    initialFace: { ...face },
    currentPatch: {},
    isDragging: true
  }
}

export function applyMeshGestureDelta(
  session: MeshGestureSession,
  patch: Partial<Face3D>
): { session: MeshGestureSession; updatedFace: Face3D } {
  const newPatch = { ...session.currentPatch, ...patch }
  const newSession: MeshGestureSession = { ...session, currentPatch: newPatch }
  const updatedFace: Face3D = { ...session.initialFace, ...newPatch }
  return { session: newSession, updatedFace }
}

export function commitMeshGestureSession(
  session: MeshGestureSession
): { finalFace: Face3D; hasChanges: boolean } {
  const hasChanges = Object.keys(session.currentPatch).length > 0
  const finalFace: Face3D = { ...session.initialFace, ...session.currentPatch }
  return { finalFace, hasChanges }
}

export function cancelMeshGestureSession(
  session: MeshGestureSession
): Face3D {
  return { ...session.initialFace }
}
