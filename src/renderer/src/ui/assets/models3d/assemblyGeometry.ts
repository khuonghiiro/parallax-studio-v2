import * as THREE from 'three'
import type { Face3D } from './types'

/**
 * Pure geometry helpers for the Assembly workshop.
 *
 * Faces are authored in *depth space*: x → right, y → up, z → away from the viewer, and
 * `rotation` is [rx, ry, rz] in degrees, applied in three.js as Euler(rx, -ry, -rz, 'YXZ')
 * after flipping z (see `applyFaceTransform`). These helpers convert both ways so tools
 * like templates, "fold from edge" and framing can work with real 3D frames.
 */
export type Vec3 = [number, number, number]

export interface FacePose {
  position: Vec3
  rotation: Vec3
}

export type FaceEdge = 'top' | 'bottom' | 'left' | 'right'

const DEG = Math.PI / 180
const round = (v: number, digits = 2): number => {
  const k = 10 ** digits
  const r = Math.round(v * k) / k
  return Object.is(r, -0) ? 0 : r
}

export const toThree = (v: Vec3): THREE.Vector3 => new THREE.Vector3(v[0], v[1], -v[2])
export const fromThree = (v: THREE.Vector3): Vec3 => [v.x, v.y, -v.z]

/** three.js orientation of a face rotation (same convention as the mesh factory). */
export function faceQuaternion(rotation: Vec3): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rotation[0] * DEG, -rotation[1] * DEG, -rotation[2] * DEG, 'YXZ')
  )
}

/** Inverse of `faceQuaternion`: face rotation [rx, ry, rz] in degrees. */
export function rotationFromQuaternion(q: THREE.Quaternion): Vec3 {
  const e = new THREE.Euler().setFromQuaternion(q, 'YXZ')
  return [round(e.x / DEG), round(-e.y / DEG), round(-e.z / DEG)]
}

/** World matrix (three space, unscaled) of a face. */
export function faceMatrix(face: Pick<Face3D, 'position' | 'rotation'>): THREE.Matrix4 {
  return new THREE.Matrix4().compose(toThree(face.position), faceQuaternion(face.rotation), new THREE.Vector3(1, 1, 1))
}

export function poseFromMatrix(m: THREE.Matrix4): FacePose {
  const p = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  m.decompose(p, q, s)
  const pos = fromThree(p)
  return { position: [round(pos[0]), round(pos[1]), round(pos[2])], rotation: rotationFromQuaternion(q) }
}

/**
 * Pose of a plane centred at `center` whose front side faces `normal` and whose image
 * top points along `up` (all in depth space).
 */
export function poseFromFrame(center: Vec3, normal: Vec3, up: Vec3 = [0, 1, 0]): FacePose {
  const n = toThree(normal).normalize()
  const orthoUp = (v: THREE.Vector3): THREE.Vector3 => v.addScaledVector(n, -v.dot(n))
  let u = orthoUp(toThree(up))
  // `up` parallel to the normal (e.g. floor facing up): fall back to "away from viewer", then +Y.
  if (u.lengthSq() < 1e-9) u = orthoUp(new THREE.Vector3(0, 0, -1))
  if (u.lengthSq() < 1e-9) u = orthoUp(new THREE.Vector3(0, 1, 0))
  u.normalize()
  const x = new THREE.Vector3().crossVectors(u, n).normalize()
  const m = new THREE.Matrix4().makeBasis(x, u, n)
  m.setPosition(toThree(center))
  return poseFromMatrix(m)
}

/** Corners TL, TR, BR, BL of a face in three space (optionally scaled by the model scale). */
export function faceCornersThree(face: Face3D, scale = 1): THREE.Vector3[] {
  const m = faceMatrix(face)
  const hw = face.width / 2
  const hh = face.height / 2
  return [
    [-hw, hh],
    [hw, hh],
    [hw, -hh],
    [-hw, -hh]
  ].map(([x, y]) => new THREE.Vector3(x, y, 0).applyMatrix4(m).multiplyScalar(scale))
}

/** Axis-aligned bounds of faces in depth space. */
export function modelBounds(faces: Face3D[]): { min: Vec3; max: Vec3; center: Vec3; size: Vec3 } | null {
  const pts = faces.flatMap((f) => faceCornersThree(f).map(fromThree))
  if (pts.length === 0) return null
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const p of pts) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p[i])
      max[i] = Math.max(max[i], p[i])
    }
  }
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  return { min, max, center, size }
}

/**
 * Pose and size of a new face hinged on `edge` of `face`, folded `angleDeg` towards the
 * back of the face (90° builds a box corner, like folding paper behind the image).
 */
export function foldFromEdge(
  face: Face3D,
  edge: FaceEdge,
  angleDeg = 90,
  depth = Math.min(face.width, face.height)
): FacePose & { width: number; height: number } {
  const a = angleDeg * DEG
  const hw = face.width / 2
  const hh = face.height / 2
  const local = new THREE.Matrix4()
  const t = (x: number, y: number) => new THREE.Matrix4().makeTranslation(x, y, 0)
  let width = face.width
  let height = depth
  if (edge === 'top') {
    local.multiply(t(0, hh)).multiply(new THREE.Matrix4().makeRotationX(-a)).multiply(t(0, depth / 2))
  } else if (edge === 'bottom') {
    local.multiply(t(0, -hh)).multiply(new THREE.Matrix4().makeRotationX(a)).multiply(t(0, -depth / 2))
  } else {
    width = depth
    height = face.height
    const sign = edge === 'right' ? 1 : -1
    local.multiply(t(sign * hw, 0)).multiply(new THREE.Matrix4().makeRotationY(sign * a)).multiply(t((sign * depth) / 2, 0))
  }
  const world = faceMatrix(face).multiply(local)
  return { ...poseFromMatrix(world), width: Math.round(width), height: Math.round(height) }
}
