import * as THREE from 'three'
import type { Vec3 } from '@shared/types'
import type { EvaluatedLayer, EvaluatedScene } from './evaluateScene'
import { composeDepthMatrix } from './spatial'

export interface GizmoRect { x: number; y: number; w: number; h: number }
export type Point = [number, number]
export const BOX_HANDLES: Point[] = [[-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0]]

export function projectPoint(p: THREE.Vector3, camera: THREE.Camera, rect: GizmoRect): Point {
  const v = p.clone().project(camera)
  return [rect.x + (v.x + 1) * rect.w / 2, rect.y + (1 - v.y) * rect.h / 2]
}

export function parentMatrix(el: EvaluatedLayer, scene: EvaluatedScene): THREE.Matrix4 {
  const parent = scene.layers.find((l) => l.layer.id === el.layer.parentId && l.index < el.index)
  return parent?.world.clone() ?? el.shot?.matrix.clone() ?? new THREE.Matrix4()
}

export function layerPivot(el: EvaluatedLayer, anchor: Vec3): THREE.Vector3 {
  return new THREE.Vector3(anchor[0] * el.size[0], anchor[1] * el.size[1], -anchor[2]).applyMatrix4(el.world)
}

export function localPlaneHit(point: Point, camera: THREE.Camera, rect: GizmoRect, world: THREE.Matrix4): THREE.Vector3 | null {
  if (Math.abs(world.determinant()) < 1e-12) return null
  const ray = new THREE.Raycaster()
  ray.setFromCamera(new THREE.Vector2((point[0] - rect.x) / rect.w * 2 - 1, 1 - (point[1] - rect.y) / rect.h * 2), camera)
  const local = ray.ray.clone().applyMatrix4(world.clone().invert())
  return local.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Vector3())
}

/** Resize about the authored anchor; ratios operate before depth auto-scale. */
export function resizedScale(start: Vec3, from: THREE.Vector3, to: THREE.Vector3, anchor: THREE.Vector3, handle: Point, uniform: boolean): Vec3 {
  const a = from.clone().sub(anchor)
  const b = to.clone().sub(anchor)
  let x = handle[0] && Math.abs(a.x) > 1e-6 ? b.x / a.x : 1
  let y = handle[1] && Math.abs(a.y) > 1e-6 ? b.y / a.y : 1
  if (uniform) {
    const ratio = handle[0] && handle[1] ? (a.x * b.x + a.y * b.y) / Math.max(1e-6, a.x * a.x + a.y * a.y) : handle[0] ? x : y
    x = y = ratio
  }
  const safe = (v: number): number => Math.abs(v) < 0.001 ? (v < 0 ? -0.001 : 0.001) : v
  return [safe(start[0] * x), safe(start[1] * y), start[2]]
}

/** Euler YXZ derivative axes, including the application's depth-space signs. */
export function rotationBasis(rotation: Vec3, axis: number, parent: THREE.Matrix4): THREE.Matrix4 {
  const preceding: Vec3 = axis === 1 ? [0, 0, 0] : axis === 0 ? [0, rotation[1], 0] : [rotation[0], rotation[1], 0]
  return parent.clone().multiply(composeDepthMatrix([0, 0, 0], preceding))
}

export function ringPoint(axis: number, angle: number): THREE.Vector3 {
  const c = Math.cos(angle), s = Math.sin(angle)
  return axis === 0 ? new THREE.Vector3(0, c, s) : axis === 1 ? new THREE.Vector3(c, 0, -s) : new THREE.Vector3(c, s, 0)
}

/** Intersect the projected ring plane so oblique views rotate without screen-angle distortion. */
export function rotationAngle(point: Point, camera: THREE.Camera, rect: GizmoRect, pivot: THREE.Vector3, basis: THREE.Matrix4, axis: number): number | null {
  const u = ringPoint(axis, 0).transformDirection(basis)
  const v = ringPoint(axis, Math.PI / 2).transformDirection(basis)
  const normal = u.clone().cross(v).normalize()
  const ray = new THREE.Raycaster()
  ray.setFromCamera(new THREE.Vector2((point[0] - rect.x) / rect.w * 2 - 1, 1 - (point[1] - rect.y) / rect.h * 2), camera)
  if (Math.abs(ray.ray.direction.dot(normal)) < 0.15) return null
  const hit = ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal, pivot), new THREE.Vector3())
  if (!hit) return null
  hit.sub(pivot)
  return Math.atan2(hit.dot(v), hit.dot(u))
}
