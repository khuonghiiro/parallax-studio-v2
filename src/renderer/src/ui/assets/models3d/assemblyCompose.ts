import * as THREE from 'three'
import type { Face3D, Model3D } from './types'
import { faceMatrix, modelBounds, poseFromMatrix, type Vec3 } from './assemblyGeometry'

/**
 * Merging a saved 3D model (e.g. a window or chimney built as its own asset) into the
 * model being assembled. Faces keep their images and mesh work; ids are regenerated (and
 * `clipBy` references remapped) so the same part can be merged many times.
 */
export interface AppendModelOptions {
  /**
   * Where the part's local origin lands in the target model (depth space). Decor parts use
   * the wall-contact point as origin, so `at` = a point on a wall surface. Omitted → the
   * part is placed to the right of the current model, bottoms aligned.
   */
  at?: Vec3
  /** Extra uniform scale on top of the automatic model-scale matching (default 1). */
  scale?: number
  /** Gap used for automatic placement (default 80). */
  gap?: number
  /** Prefix face names with the part name (default true) so merged groups stay readable. */
  prefixNames?: boolean
}

export interface AppendModelResult {
  faces: Face3D[]
  addedIds: string[]
}

let seq = 0
const freshId = (): string => `face-${Date.now().toString(36)}-${(seq++).toString(36)}`
const round1 = (v: number): number => Math.round(v * 10) / 10

/** Scales the part so it looks the same size once it lives inside the target model. */
function relativeScale(part: Model3D, target: Pick<Model3D, 'scale'>, extra: number): number {
  const partScale = part.scale > 0 ? part.scale : 1
  const targetScale = target.scale > 0 ? target.scale : 1
  return (partScale / targetScale) * extra
}

function scaledCopies(part: Model3D, k: number, prefix: boolean): { faces: Face3D[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>()
  const faces = part.faces.map((f) => {
    const id = freshId()
    idMap.set(f.id, id)
    return {
      ...f,
      id,
      name: prefix ? `${part.name} · ${f.name}` : f.name,
      width: Math.round(f.width * k),
      height: Math.round(f.height * k),
      position: [round1(f.position[0] * k), round1(f.position[1] * k), round1(f.position[2] * k)] as Vec3,
      selectedCells: undefined
    }
  })
  return { faces, idMap }
}

function autoShift(current: Face3D[], added: Face3D[], gap: number): Vec3 {
  const cur = modelBounds(current.filter((f) => !f.hidden))
  const add = modelBounds(added)
  if (!cur || !add) return [0, 0, 0]
  return [cur.max[0] - add.min[0] + gap, cur.min[1] - add.min[1], cur.center[2] - add.center[2]]
}

export function appendModel(
  part: Model3D,
  target: Pick<Model3D, 'scale' | 'faces'>,
  opts: AppendModelOptions = {}
): AppendModelResult {
  if (part.faces.length === 0) return { faces: target.faces, addedIds: [] }
  const k = relativeScale(part, target, opts.scale ?? 1)
  const { faces: copies, idMap } = scaledCopies(part, k, opts.prefixNames !== false)
  const shift = opts.at ?? autoShift(target.faces, copies, opts.gap ?? 80)
  const moved = copies.map((f) => ({
    ...f,
    position: [round1(f.position[0] + shift[0]), round1(f.position[1] + shift[1]), round1(f.position[2] + shift[2])] as Vec3,
    clipBy: f.clipBy?.map((id) => idMap.get(id)).filter((id): id is string => !!id)
  }))
  return { faces: [...target.faces, ...moved], addedIds: moved.map((f) => f.id) }
}

export interface MountOnFaceOptions {
  /** Point on the host face, UV 0..1 with v pointing up (default centre [0.5, 0.5]). */
  uv?: [number, number]
  scale?: number
  prefixNames?: boolean
}

/**
 * Mounts a part on any face of the target (front wall, side wall, roof slope…): the part's
 * local frame is aligned with the host face, so a part authored facing the viewer ends up
 * facing outward from that face, its origin at `uv` on the face surface.
 */
export function appendModelOnFace(
  part: Model3D,
  target: Pick<Model3D, 'scale' | 'faces'>,
  host: Face3D,
  opts: MountOnFaceOptions = {}
): AppendModelResult {
  if (part.faces.length === 0) return { faces: target.faces, addedIds: [] }
  const k = relativeScale(part, target, opts.scale ?? 1)
  const { faces: copies, idMap } = scaledCopies(part, k, opts.prefixNames !== false)
  const [u, v] = opts.uv ?? [0.5, 0.5]
  const clamp = (x: number): number => Math.min(1, Math.max(0, x))
  const local = new THREE.Matrix4().makeTranslation((clamp(u) - 0.5) * host.width, (clamp(v) - 0.5) * host.height, 0)
  const mount = faceMatrix(host).multiply(local)
  const mounted = copies.map((f) => {
    const pose = poseFromMatrix(mount.clone().multiply(faceMatrix(f)))
    return {
      ...f,
      position: pose.position,
      rotation: pose.rotation,
      clipBy: f.clipBy?.map((id) => idMap.get(id)).filter((id): id is string => !!id)
    }
  })
  return { faces: [...target.faces, ...mounted], addedIds: mounted.map((f) => f.id) }
}
