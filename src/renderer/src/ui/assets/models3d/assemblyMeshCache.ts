import * as THREE from 'three'
import type { Face3D } from './types'
import type { ResolvedTexture } from './textureResolver'
import { applyFaceTransform, createFaceMesh, faceGeometrySignature } from './assemblyMeshFactory'
import { faceClipPlanes } from './assemblyClip'
import type { AssemblySceneTheme } from './assemblyTheme'

interface CachedFace {
  mesh: THREE.Mesh
  key: string
  resolved: ResolvedTexture | null
}

export type FaceMeshCache = Map<string, CachedFace>

export interface SyncOptions {
  textureMap: Map<string, ResolvedTexture>
  selectedFaceId: string | null
  meshOnlyPixels: boolean
  showWireframe: boolean
  scale: number
  theme: AssemblySceneTheme
}

/** Frees GPU buffers of a face mesh and its wireframe / outline children. */
export function disposeFaceMesh(mesh: THREE.Object3D): void {
  mesh.traverse((obj) => {
    const o = obj as THREE.Mesh
    o.geometry?.dispose()
    const mat = o.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
    else mat?.dispose()
  })
}

/**
 * Reconciles the mesh group with the model faces. Meshes whose geometry inputs did not
 * change are reused and only re-positioned, so dragging / arrow-key editing of position
 * and rotation stays smooth even with heavy alpha-trimmed textures.
 */
export function syncFaceMeshes(group: THREE.Group, cache: FaceMeshCache, faces: Face3D[], opts: SyncOptions): void {
  const alive = new Set<string>()
  const themeKey = JSON.stringify(opts.theme)
  faces.forEach((face) => {
    if (face.hidden) return
    alive.add(face.id)
    const resolved = face.assetPath ? opts.textureMap.get(face.assetPath) || null : null
    const isSelected = face.id === opts.selectedFaceId
    const key = [faceGeometrySignature(face), opts.meshOnlyPixels, opts.showWireframe, opts.scale, isSelected, themeKey].join('|')
    let entry = cache.get(face.id)
    if (!entry || entry.key !== key || entry.resolved !== resolved) {
      if (entry) {
        group.remove(entry.mesh)
        disposeFaceMesh(entry.mesh)
      }
      const mesh = createFaceMesh(face, resolved, opts.meshOnlyPixels, opts.showWireframe, opts.scale, isSelected, opts.theme)
      entry = { mesh, key, resolved }
      cache.set(face.id, entry)
      group.add(mesh)
    } else {
      applyFaceTransform(entry.mesh, face, opts.scale)
    }
    const planes = faceClipPlanes(face, faces, opts.scale)
    const mat = entry.mesh.material
    if (mat && !Array.isArray(mat)) {
      mat.clippingPlanes = planes.length > 0 ? planes : null
      mat.clipShadows = true
    }
  })
  for (const [id, entry] of cache) {
    if (alive.has(id)) continue
    group.remove(entry.mesh)
    disposeFaceMesh(entry.mesh)
    cache.delete(id)
  }
}

export function clearFaceMeshes(group: THREE.Group | null, cache: FaceMeshCache): void {
  for (const entry of cache.values()) {
    group?.remove(entry.mesh)
    disposeFaceMesh(entry.mesh)
  }
  cache.clear()
}
