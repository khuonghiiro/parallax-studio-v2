import type { Model3D } from './types'

export interface ActiveAssemblySession {
  getModel: () => Model3D
  setModel: (model: Model3D) => void
  getSelectedFaceId: () => string | null
  setSelectedFaceId: (id: string | null) => void
  save: () => void
  insert: () => Promise<string[]>
  close: () => void
  captureScreenshot?: () => string | null
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
