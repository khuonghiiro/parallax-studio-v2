import * as THREE from 'three'
import type { Face3D } from './types'
import { faceMatrix, poseFromMatrix } from './assemblyGeometry'

/**
 * "Ghép hít" — two-point edge join.
 *
 * Each face provides a Start/End pair of points in its image (UV, v up): either the corners
 * of the opaque pixel area along an edge, or custom points picked in the 2D editor
 * (`face.joinPoints`). The source face is scaled, rotated and moved so its Start/End land
 * exactly on the target's Start/End: the seam is closed without gaps. By default the face
 * with the shorter segment grows to the longer one ("longest").
 */

export type JoinEdge = 'left' | 'right' | 'top' | 'bottom' | 'points'
export type JoinScaleMode = 'longest' | 'source' | 'none'

/** Opaque pixel bounds in texture UV: [uMin, vMin, uMax, vMax]. */
export type UVBounds = [number, number, number, number]

export interface JoinOptions {
  /** Face that stays in place (A). */
  targetId: string
  /** Face that moves onto the target (B). */
  sourceId: string
  targetEdge: JoinEdge
  sourceEdge: JoinEdge
  /**
   * Fold angle (degrees) of the source around the seam: 0 continues the target plane,
   * 90 folds behind it (box corner), negative values fold towards the front.
   */
  angle?: number
  /** Keep the source's current facing (projected around the seam) instead of `angle`. */
  keepOrientation?: boolean
  /** longest: the shorter face grows · source: only the source is resized · none. */
  scaleMode?: JoinScaleMode
  /** Swap the source Start/End (join reversed). */
  flip?: boolean
}

export interface JoinResult {
  faces: Face3D[]
  /** Uniform scale applied to the face that was resized (1 = none). */
  scale: number
  scaledFaceId: string | null
}

export const JOIN_EDGE_LABELS: Record<JoinEdge, string> = {
  left: 'Cạnh trái',
  right: 'Cạnh phải',
  top: 'Cạnh trên',
  bottom: 'Cạnh dưới',
  points: 'Điểm S/E tự chọn'
}

type UV = [number, number]

/** Start/End UV points of a face for an edge (or its custom join points). */
export function joinPointsUV(face: Face3D, edge: JoinEdge, bounds: UVBounds = [0, 0, 1, 1]): [UV, UV] {
  if (edge === 'points' && face.joinPoints) return [face.joinPoints[0], face.joinPoints[1]]
  const [u0, v0, u1, v1] = bounds
  switch (edge) {
    case 'right':
      return [[u1, v1], [u1, v0]]
    case 'top':
      return [[u0, v1], [u1, v1]]
    case 'bottom':
      return [[u0, v0], [u1, v0]]
    default:
      return [[u0, v1], [u0, v0]]
  }
}

const localPoint = (face: Pick<Face3D, 'width' | 'height'>, [u, v]: UV): THREE.Vector3 =>
  new THREE.Vector3((u - 0.5) * face.width, (v - 0.5) * face.height, 0)

const resized = (face: Face3D, s: number): Face3D =>
  s === 1 ? face : { ...face, width: Math.round(face.width * s * 100) / 100, height: Math.round(face.height * s * 100) / 100 }

/** World (three space, unscaled) Start/End of a face. */
function worldPoints(face: Face3D, uv: [UV, UV]): [THREE.Vector3, THREE.Vector3] {
  const m = faceMatrix(face)
  return [localPoint(face, uv[0]).applyMatrix4(m), localPoint(face, uv[1]).applyMatrix4(m)]
}

/** Desired front normal of the source for a fold angle (see `JoinOptions.angle`). */
function foldedNormal(target: Face3D, p1: THREE.Vector3, dir: THREE.Vector3, sideSign: number, angleDeg: number): THREE.Vector3 {
  const m = faceMatrix(target)
  const nA = new THREE.Vector3(0, 0, 1).transformDirection(m)
  const centerA = new THREE.Vector3().setFromMatrixPosition(m)
  const out = p1.clone().sub(centerA)
  out.addScaledVector(dir, -out.dot(dir))
  if (out.lengthSq() < 1e-9) out.crossVectors(dir, nA)
  out.normalize()
  const a = (angleDeg * Math.PI) / 180
  const bodyDir = out.multiplyScalar(Math.cos(a)).addScaledVector(nA, -Math.sin(a)).normalize()
  return new THREE.Vector3().crossVectors(dir, bodyDir).multiplyScalar(sideSign).normalize()
}

/**
 * Joins `sourceId` onto `targetId`. `bounds` gives the opaque-pixel UV bounds per face id
 * (defaults to the full image) so edge joins use only non-transparent pixels.
 */
export function joinFaces(faces: Face3D[], opts: JoinOptions, bounds: Map<string, UVBounds> = new Map()): JoinResult {
  let target = faces.find((f) => f.id === opts.targetId)
  let source = faces.find((f) => f.id === opts.sourceId)
  if (!target || !source) throw new Error('Không tìm thấy mặt cần ghép')
  if (target.id === source.id) throw new Error('Mặt nguồn và mặt đích phải khác nhau')
  const uvA = joinPointsUV(target, opts.targetEdge, bounds.get(target.id))
  let uvB = joinPointsUV(source, opts.sourceEdge, bounds.get(source.id))
  if (opts.flip) uvB = [uvB[1], uvB[0]]

  // 1. Match segment lengths.
  const lenOf = (f: Face3D, uv: [UV, UV]): number => localPoint(f, uv[0]).distanceTo(localPoint(f, uv[1]))
  const lenA = lenOf(target, uvA)
  const lenB = lenOf(source, uvB)
  if (lenA < 1e-6 || lenB < 1e-6) throw new Error('Điểm Start và End trùng nhau')
  const mode = opts.scaleMode ?? 'longest'
  let scale = 1
  let scaledFaceId: string | null = null
  if (mode === 'source' || (mode === 'longest' && lenB < lenA)) {
    scale = lenA / lenB
    source = resized(source, scale)
    scaledFaceId = source.id
  } else if (mode === 'longest' && lenA < lenB) {
    scale = lenB / lenA
    target = resized(target, scale)
    scaledFaceId = target.id
  }

  // 2. Orientation: source seam direction → target seam direction, normal from fold.
  const [p1, p2] = worldPoints(target, uvA)
  const dir = p2.clone().sub(p1).normalize()
  const q1 = localPoint(source, uvB[0])
  const q2 = localPoint(source, uvB[1])
  const l1 = q2.clone().sub(q1).normalize()
  const l3 = new THREE.Vector3(0, 0, 1)
  const l2 = new THREE.Vector3().crossVectors(l3, l1)
  const sideSign = q1.clone().negate().dot(l2) >= 0 ? 1 : -1
  let nB: THREE.Vector3 | null = null
  if (opts.keepOrientation) {
    const cur = new THREE.Vector3(0, 0, 1).transformDirection(faceMatrix(source))
    cur.addScaledVector(dir, -cur.dot(dir))
    if (cur.lengthSq() > 1e-6) nB = cur.normalize()
  }
  nB = nB ?? foldedNormal(target, p1, dir, sideSign, opts.angle ?? 90)
  const w2 = new THREE.Vector3().crossVectors(nB, dir)
  const W = new THREE.Matrix4().makeBasis(dir, w2, nB)
  const L = new THREE.Matrix4().makeBasis(l1, l2, l3)
  const R = W.multiply(L.transpose())

  // 3. Position: source Start lands on target Start.
  const center = p1.clone().sub(q1.clone().applyMatrix4(R))
  const pose = poseFromMatrix(new THREE.Matrix4().copy(R).setPosition(center))
  const moved: Face3D = { ...source, position: pose.position, rotation: pose.rotation }
  const nextFaces = faces.map((f) => (f.id === moved.id ? moved : f.id === target!.id ? target! : f))
  return { faces: nextFaces, scale, scaledFaceId }
}
