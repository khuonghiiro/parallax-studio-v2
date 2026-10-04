import * as THREE from 'three'
import type { Layer, Vec3 } from '@shared/types'

/**
 * Conversions between the authoring "depth space" (x right, y up, z = depth away from the
 * viewer) and three.js world space (z toward the viewer). Pure math — safe in unit tests.
 */

export const DEG = Math.PI / 180

export function depthToThree(v: Vec3, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(v[0], v[1], -v[2])
}

export function threeToDepth(v: THREE.Vector3): Vec3 {
  return [v.x, v.y, -v.z]
}

/** Rotation (degrees, depth space) → three.js Euler. Matches the v1 layer convention. */
export function depthEuler(r: Vec3, out = new THREE.Euler()): THREE.Euler {
  return out.set(r[0] * DEG, -r[1] * DEG, -r[2] * DEG, 'YXZ')
}

const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

export function composeDepthMatrix(position: Vec3, rotation: Vec3, scale: Vec3 = [1, 1, 1], out = new THREE.Matrix4()): THREE.Matrix4 {
  _q.setFromEuler(depthEuler(rotation, _e))
  return out.compose(depthToThree(position, _p), _q, _s.set(scale[0] || 1e-4, scale[1] || 1e-4, scale[2] || 1))
}

/** Nominal (unscaled) plane size of a layer in world units, used for bounds/culling/gizmos. */
export function layerNominalSize(layer: Layer): [number, number] {
  switch (layer.type) {
    case 'image':
    case 'solid':
      return [layer.props.width, layer.props.height]
    case 'particles':
      return [layer.props.area[0], layer.props.area[1]]
    case 'text': {
      const p = layer.props
      const lines = p.text.split('\n')
      const longest = Math.max(1, ...lines.map((l) => l.length))
      return [longest * (p.fontSize * 0.66 + p.letterSpacing) + p.fontSize, lines.length * p.fontSize * 1.4 + p.fontSize * 0.6]
    }
  }
}

const CORNERS: [number, number, number][] = [
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [-0.5, 0.5, -0.5],
  [0.5, 0.5, -0.5],
  [-0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5],
  [-0.5, 0.5, 0.5],
  [0.5, 0.5, 0.5]
]
const _c = new THREE.Vector3()

/** World-space AABB of a local box (w × h × d, centered) transformed by `matrix`. */
export function transformedBox(w: number, h: number, d: number, matrix: THREE.Matrix4, out = new THREE.Box3()): THREE.Box3 {
  out.makeEmpty()
  for (const [x, y, z] of CORNERS) out.expandByPoint(_c.set(x * w, y * h, z * d).applyMatrix4(matrix))
  return out
}
