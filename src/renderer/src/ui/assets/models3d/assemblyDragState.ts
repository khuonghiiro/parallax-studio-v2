/**
 * Shared state for dragged assets in Assembly 3D Studio.
 *
 * During HTML5 drag-and-drop, Chrome/Electron hides `dataTransfer.getData()`
 * during `dragover`/`dragenter` for security reasons. Storing the active asset
 * here allows FaceList to inspect the dragged asset in real-time, enabling
 * instant texture assignment when hovering with the Shift key held.
 */

export interface AssemblyDraggedAsset {
  assetPath: string
  name: string
  previewUrl?: string
}

let activeDraggedAsset: AssemblyDraggedAsset | null = null
const listeners = new Set<(asset: AssemblyDraggedAsset | null) => void>()

export function setAssemblyDraggedAsset(asset: AssemblyDraggedAsset | null): void {
  activeDraggedAsset = asset
  for (const listener of listeners) {
    try {
      listener(asset)
    } catch (err) {
      console.warn('[assemblyDragState] listener error:', err)
    }
  }
}

export function getAssemblyDraggedAsset(): AssemblyDraggedAsset | null {
  return activeDraggedAsset
}

export function subscribeAssemblyDraggedAsset(
  listener: (asset: AssemblyDraggedAsset | null) => void
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
