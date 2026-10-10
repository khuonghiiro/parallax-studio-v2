import type { LayerComposite } from './types'

export interface ActiveLayerAssemblySession {
  getTab?: () => 'layers' | 'bones' | 'animation'
  setTab?: (tab: 'layers' | 'bones' | 'animation') => void
  getSelectedBoneId?: () => string | null
  setSelectedBoneId?: (id: string | null) => void
  getComposite: () => LayerComposite
  setComposite: (composite: LayerComposite | ((prev: LayerComposite) => LayerComposite)) => void
  getSelectedLayerId: () => string | null
  setSelectedLayerId: (id: string | null) => void
  getSelectedLayerIds?: () => string[]
  setSelectedLayerIds?: (ids: string[]) => void
  undo?: () => void
  redo?: () => void
  canUndo?: () => boolean
  canRedo?: () => boolean
  getIsPlaying: () => boolean
  setIsPlaying: (playing: boolean) => void
  getTime: () => number
  setTime: (time: number) => void
  save: () => Promise<void>
  insertToScene: () => Promise<void>
  close: () => void
}

let activeSession: ActiveLayerAssemblySession | null = null

export function registerLayerAssemblySession(session: ActiveLayerAssemblySession): () => void {
  activeSession = session
  return () => {
    if (activeSession === session) {
      activeSession = null
    }
  }
}

export function getActiveLayerAssemblySession(): ActiveLayerAssemblySession | null {
  return activeSession
}

let pendingOpenComposite: { compositeId?: string } | null = null

/**
 * Yêu cầu mở Xưởng Lắp Ráp Layer từ bên ngoài (qua MCP hoặc UI)
 */
export function requestOpenLayerAssembly(compositeId?: string): void {
  pendingOpenComposite = { compositeId }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('layerAssembly:open', {
        detail: { compositeId }
      })
    )
  }
}

export function consumePendingOpenLayerAssembly(): { compositeId?: string } | null {
  const pending = pendingOpenComposite
  pendingOpenComposite = null
  return pending
}

/**
 * Yêu cầu đóng Xưởng Lắp Ráp Layer
 */
export function requestCloseLayerAssembly(): void {
  if (activeSession) {
    activeSession.close()
  } else if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('layerAssembly:close'))
  }
}
