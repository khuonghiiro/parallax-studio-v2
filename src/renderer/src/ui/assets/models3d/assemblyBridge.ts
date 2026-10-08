import type { Model3D } from './types'

export interface AssemblyCameraState {
  azimuth: number
  elevation: number
  radius: number
  target: [number, number, number]
}

export interface SetAssemblyCameraParams {
  preset?: 'front' | 'back' | 'left' | 'right' | 'top' | 'iso' | 'custom'
  azimuth?: number
  elevation?: number
  radius?: number
  target?: [number, number, number]
  frameFaceId?: string
  frameModel?: boolean
}

export interface AssemblyCaptureOptions {
  cameraPreset?: 'front' | 'back' | 'left' | 'right' | 'top' | 'iso' | 'custom'
  frameFaceId?: string
  autoFit?: boolean
  transparent?: boolean
}

export interface ActiveAssemblySession {
  getModel: () => Model3D
  setModel: (model: Model3D) => void
  getSelectedFaceId: () => string | null
  setSelectedFaceId: (id: string | null) => void
  save: () => Promise<void> | void
  insert: () => Promise<string[]>
  close: () => void
  captureScreenshot?: (opts?: AssemblyCaptureOptions) => string | null
  setCamera?: (params: SetAssemblyCameraParams) => AssemblyCameraState
  getCamera?: () => AssemblyCameraState
}

let activeSession: ActiveAssemblySession | null = null

export function registerAssemblySession(session: ActiveAssemblySession): () => void {
  activeSession = session
  return () => {
    if (activeSession === session) {
      activeSession = null
    }
  }
}

export function getActiveAssemblySession(): ActiveAssemblySession | null {
  return activeSession
}
