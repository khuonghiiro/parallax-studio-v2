import * as THREE from 'three'
import { faceGridSize, type Face3D } from './types'
import type { ResolvedTexture } from './textureResolver'
import { createAlphaSampler, type AlphaSampler } from './alphaMeshBuilder'
import { FACE_ALPHA_CUTOFF } from './assemblyMeshFactory'

export interface FaceHit {
  faceId: string
  /** Texture UV at the hit (v = 1 is the image top). */
  uv: THREE.Vector2
  /** Normalised grid coordinates on the face plane (x → right, y → down, 0..1). */
  grid: { x: number; y: number }
  point: THREE.Vector3
}

export interface PickContext {
  container: HTMLElement
  camera: THREE.Camera
  group: THREE.Group
  faces: Face3D[]
  textureMap: Map<string, ResolvedTexture>
}

const samplerCache = new WeakMap<object, AlphaSampler>()
const raycaster = new THREE.Raycaster()

function alphaAt(resolved: ResolvedTexture | undefined, uv: THREE.Vector2): number {
  const image = resolved?.image
  if (!image) return 255
  let sampler = samplerCache.get(image)
  if (!sampler) {
    sampler = createAlphaSampler(image, Math.min(512, image.naturalWidth || 256), Math.min(512, image.naturalHeight || 256))
    samplerCache.set(image, sampler)
  }
  return sampler(uv.x, uv.y)
}

function ownerFaceMesh(obj: THREE.Object3D, group: THREE.Group): THREE.Object3D | null {
  let cur: THREE.Object3D | null = obj
  while (cur && !cur.userData?.faceId && cur.parent !== group) cur = cur.parent
  return cur?.userData?.faceId ? cur : null
}

/**
 * Raycasts face meshes under a client point. With `ignoreTransparent`, hits on cut-out
 * (transparent) texels are skipped so clicks pass through to the face behind — the same
 * thing the eye sees.
 */
export function pickFace(ctx: PickContext, clientX: number, clientY: number, ignoreTransparent = true): FaceHit | null {
  const rect = ctx.container.getBoundingClientRect()
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
  raycaster.setFromCamera(ndc, ctx.camera)
  const hits = raycaster.intersectObjects(ctx.group.children, true)
  for (const hit of hits) {
    if (!(hit.object as THREE.Mesh).isMesh || !hit.uv) continue
    const owner = ownerFaceMesh(hit.object, ctx.group)
    if (!owner) continue
    const faceId = owner.userData.faceId as string
    const face = ctx.faces.find((f) => f.id === faceId)
    if (!face) continue
    if (ignoreTransparent && face.assetPath) {
      const resolved = ctx.textureMap.get(face.assetPath)
      const cutoff = face.alphaCutoff ?? FACE_ALPHA_CUTOFF
      if (alphaAt(resolved, hit.uv) < cutoff * 255) continue
    }
    const local = owner.worldToLocal(hit.point.clone())
    const [w, h] = (owner.userData.size as [number, number] | undefined) ?? [1, 1]
    return {
      faceId,
      uv: hit.uv,
      grid: { x: Math.min(0.9999, Math.max(0, local.x / w + 0.5)), y: Math.min(0.9999, Math.max(0, 0.5 - local.y / h)) },
      point: hit.point
    }
  }
  return null
}

/** Grid cell key ("r_c") under a hit for a face's mesh grid. */
export function cellKeyAt(hit: FaceHit, face: Face3D | undefined): string {
  const { cols, rows } = faceGridSize(face)
  return `${Math.floor(hit.grid.y * rows)}_${Math.floor(hit.grid.x * cols)}`
}

/** Extracts an image asset path from a drag-and-drop payload (files, sidebar JSON, text). */
export function droppedAssetPath(dt: DataTransfer): string {
  if (dt.files && dt.files.length > 0) {
    const file = dt.files[0]
    if (file.type.startsWith('image/')) {
      return (file as File & { path?: string }).path || URL.createObjectURL(file)
    }
  }
  try {
    const json = dt.getData('application/json')
    if (json) {
      const data = JSON.parse(json)
      if (data.assetPath) return String(data.assetPath)
    }
  } catch {
    /* not a JSON payload */
  }
  const text = dt.getData('text/plain').trim()
  if (text && /\.(png|jpe?g|webp)$/i.test(text)) return text
  if (text && text.includes('/')) return text
  return ''
}
