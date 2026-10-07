import type { Face3D } from './types'
import { foldFromEdge, modelBounds, type FaceEdge, type Vec3 } from './assemblyGeometry'

/**
 * Pure face-list operations for the Assembly workshop (duplicate, delete, nudge, fold,
 * centre, reorder…). Kept free of React so they are easy to unit-test and to reuse from
 * keyboard shortcuts, the face list and the inspector.
 */
export function newFaceId(): string {
  return 'face-' + Math.random().toString(36).slice(2, 9)
}

export const EDGE_LABELS: Record<FaceEdge, string> = {
  top: 'trên',
  bottom: 'dưới',
  left: 'trái',
  right: 'phải'
}

export function patchFace(faces: Face3D[], id: string, patch: Partial<Face3D>): Face3D[] {
  return faces.map((f) => (f.id === id ? { ...f, ...patch } : f))
}

export function duplicateFace(faces: Face3D[], id: string): { faces: Face3D[]; newId: string | null } {
  const idx = faces.findIndex((f) => f.id === id)
  if (idx < 0) return { faces, newId: null }
  const src = faces[idx]
  const copy: Face3D = {
    ...structuredClone(src),
    id: newFaceId(),
    name: `${src.name} (bản sao)`,
    position: [src.position[0] + 40, src.position[1] - 40, src.position[2]],
    locked: false,
    hidden: false
  }
  const next = [...faces]
  next.splice(idx + 1, 0, copy)
  return { faces: next, newId: copy.id }
}

/** Removes a face (never the last one). Returns the face to select next. */
export function deleteFace(faces: Face3D[], id: string): { faces: Face3D[]; nextSelected: string | null } {
  const idx = faces.findIndex((f) => f.id === id)
  if (idx < 0 || faces.length <= 1) return { faces, nextSelected: id }
  const next = faces.filter((f) => f.id !== id)
  return { faces: next, nextSelected: next[Math.min(idx, next.length - 1)]?.id ?? null }
}

export function nudgeFace(faces: Face3D[], id: string, delta: Vec3): Face3D[] {
  return faces.map((f) =>
    f.id === id && !f.locked
      ? { ...f, position: [f.position[0] + delta[0], f.position[1] + delta[1], f.position[2] + delta[2]] as Vec3 }
      : f
  )
}

export function toggleFaceFlag(faces: Face3D[], id: string, flag: 'hidden' | 'locked'): Face3D[] {
  return faces.map((f) => (f.id === id ? { ...f, [flag]: !f[flag] } : f))
}

/** Moves a face one slot up/down in the list (order drives template slot mapping). */
export function reorderFace(faces: Face3D[], id: string, dir: -1 | 1): Face3D[] {
  const idx = faces.findIndex((f) => f.id === id)
  const to = idx + dir
  if (idx < 0 || to < 0 || to >= faces.length) return faces
  const next = [...faces]
  const [item] = next.splice(idx, 1)
  next.splice(to, 0, item)
  return next
}

/** Adds a new face hinged on an edge of `id`, folded backwards (90° by default). */
export function addFoldedFace(
  faces: Face3D[],
  id: string,
  edge: FaceEdge,
  angleDeg = 90
): { faces: Face3D[]; newId: string | null } {
  const idx = faces.findIndex((f) => f.id === id)
  if (idx < 0) return { faces, newId: null }
  const src = faces[idx]
  const pose = foldFromEdge(src, edge, angleDeg)
  const folded: Face3D = {
    id: newFaceId(),
    name: `Gập cạnh ${EDGE_LABELS[edge]} · ${src.name}`,
    color: src.color ?? '#94a3b8',
    width: pose.width,
    height: pose.height,
    position: pose.position,
    rotation: pose.rotation
  }
  const next = [...faces]
  next.splice(idx + 1, 0, folded)
  return { faces: next, newId: folded.id }
}

/** Moves every face so the model's bounding box is centred on the origin. */
export function centerFaces(faces: Face3D[]): Face3D[] {
  const b = modelBounds(faces.filter((f) => !f.hidden))
  if (!b) return faces
  const [cx, cy, cz] = b.center
  if (Math.abs(cx) < 0.5 && Math.abs(cy) < 0.5 && Math.abs(cz) < 0.5) return faces
  return faces.map((f) => ({
    ...f,
    position: [Math.round(f.position[0] - cx), Math.round(f.position[1] - cy), Math.round(f.position[2] - cz)] as Vec3
  }))
}

/** Height that keeps the face width but matches the image aspect ratio. */
export function aspectHeight(face: Face3D, imageWidth: number, imageHeight: number): number {
  if (!imageWidth || !imageHeight) return face.height
  return Math.max(1, Math.round((face.width * imageHeight) / imageWidth))
}
