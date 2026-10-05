import * as THREE from 'three'
import type { Animatable, Project, Vec3 } from '@shared/types'
import { addKeyframe } from './keyframes'

export interface Point2D {
  x: number
  z: number
}

export type LookTargetMode = 'forward' | 'shots' | 'blend'

export interface CameraSketchOptions {
  duration?: number
  heightY?: number
  lookMode?: LookTargetMode
  keyframeInterval?: number
  clearOldKeys?: boolean
}

/** Distance between 2D points */
function dist2D(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** Simplify points using distance threshold and Ramer-Douglas-Peucker algorithm */
export function simplifyPoints(points: Point2D[], tolerance = 60): Point2D[] {
  if (points.length <= 2) return points

  // First pass: remove consecutive duplicates that are too close
  const filtered: Point2D[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    if (dist2D(points[i], filtered[filtered.length - 1]) >= 15) {
      filtered.push(points[i])
    }
  }
  if (filtered.length <= 2) return filtered

  // Second pass: Ramer-Douglas-Peucker
  function rdp(pts: Point2D[], tol: number): Point2D[] {
    if (pts.length <= 2) return pts
    let maxDist = 0
    let index = 0
    const start = pts[0]
    const end = pts[pts.length - 1]
    const dx = end.x - start.x
    const dz = end.z - start.z
    const lineLen = Math.hypot(dx, dz)

    for (let i = 1; i < pts.length - 1; i++) {
      let d = 0
      if (lineLen === 0) {
        d = dist2D(pts[i], start)
      } else {
        d = Math.abs(dz * pts[i].x - dx * pts[i].z + end.x * start.z - end.z * start.x) / lineLen
      }
      if (d > maxDist) {
        maxDist = d
        index = i
      }
    }

    if (maxDist > tol) {
      const left = rdp(pts.slice(0, index + 1), tol)
      const right = rdp(pts.slice(index), tol)
      return left.slice(0, left.length - 1).concat(right)
    }
    return [start, end]
  }

  const simplified = rdp(filtered, tolerance)
  // Ensure we have at least 3 points if original had >= 3 points
  if (simplified.length < 3 && filtered.length >= 3) {
    const mid = filtered[Math.floor(filtered.length / 2)]
    return [filtered[0], mid, filtered[filtered.length - 1]]
  }
  return simplified
}

/** Get bounding box of all shots and layers in project on X-Z plane */
export function getScene2DBounds(project: Project): {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  centerX: number
  centerZ: number
  sizeX: number
  sizeZ: number
} {
  const xs: number[] = [0]
  const zs: number[] = [0]

  for (const s of project.shots) {
    const [x, , z] = s.position.value
    xs.push(x - project.comp.width / 2, x + project.comp.width / 2)
    zs.push(z - project.comp.width / 2, z + project.comp.width / 2)
  }

  // Also include camera current position
  const [camX, , camZ] = project.camera.position.value
  xs.push(camX)
  zs.push(camZ)

  const minX = Math.min(...xs) - 400
  const maxX = Math.max(...xs) + 400
  const minZ = Math.min(...zs) - 400
  const maxZ = Math.max(...zs) + 400

  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2
  const sizeX = Math.max(1200, maxX - minX)
  const sizeZ = Math.max(1200, maxZ - minZ)

  return { minX, maxX, minZ, maxZ, centerX, centerZ, sizeX, sizeZ }
}

function clearAnim<T extends number | Vec3>(a: Animatable<T>, value?: T): void {
  if (a.keyframes.length) a.value = a.keyframes[0].value
  a.keyframes = []
  if (value !== undefined) a.value = value
}

/**
 * Convert user drawn 2D points into 3D Camera Keyframes on the project.
 */
export function applyDrawnCameraPath(
  project: Project,
  rawPoints: Point2D[],
  options: CameraSketchOptions = {}
): { keyframeCount: number; duration: number } {
  const points = simplifyPoints(rawPoints)
  if (points.length < 2) return { keyframeCount: 0, duration: 0 }

  const comp = project.comp
  const duration = Math.max(1, options.duration ?? comp.duration)
  const heightY = options.heightY ?? 0
  const lookMode = options.lookMode ?? 'blend'
  const interval = options.keyframeInterval ?? (duration > 15 ? 1.0 : 0.5)

  // Build 3D curve
  const curvePoints = points.map((p) => new THREE.Vector3(p.x, heightY, p.z))
  const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.5)

  const cam = project.camera
  if (options.clearOldKeys !== false) {
    clearAnim(cam.position)
    clearAnim(cam.target)
    clearAnim(cam.focusDistance)
    clearAnim(cam.fade, 0)
  }

  const numKeys = Math.max(3, Math.ceil(duration / interval) + 1)
  const shotCenters = project.shots.map((s) => ({
    id: s.id,
    name: s.name,
    pos: new THREE.Vector3(s.position.value[0], s.position.value[1], s.position.value[2])
  }))

  const REACH = Math.max(1000, comp.width * 1.2)

  for (let i = 0; i < numKeys; i++) {
    const u = i / (numKeys - 1)
    const t = Math.round(u * duration * comp.fps) / comp.fps

    const pos = curve.getPointAt(u)
    const tangent = curve.getTangentAt(u).normalize()

    // 1. Forward look target
    const forwardTarget = pos.clone().add(tangent.clone().multiplyScalar(REACH))

    // 2. Shot target
    let target = forwardTarget
    if (shotCenters.length > 0 && lookMode !== 'forward') {
      // Find nearest shot
      let nearestDist = Infinity
      let nearestShot = shotCenters[0]
      for (const sc of shotCenters) {
        const d = pos.distanceTo(sc.pos)
        if (d < nearestDist) {
          nearestDist = d
          nearestShot = sc
        }
      }

      if (lookMode === 'shots') {
        target = nearestShot.pos.clone()
      } else {
        // blend mode: if close to a shot (within 2x framing distance), pull view towards it
        const blendRadius = comp.width * 1.8
        const factor = Math.max(0, Math.min(1, 1 - nearestDist / blendRadius))
        // Smoothstep factor
        const sFactor = factor * factor * (3 - 2 * factor)
        target = forwardTarget.clone().lerp(nearestShot.pos, sFactor * 0.85)
      }
    }

    const camPosVec: Vec3 = [Math.round(pos.x), Math.round(pos.y), Math.round(pos.z)]
    const camTgtVec: Vec3 = [Math.round(target.x), Math.round(target.y), Math.round(target.z)]
    const focusDist = Math.round(pos.distanceTo(target))

    addKeyframe(cam.position, t, camPosVec, 'easeInOut')
    addKeyframe(cam.target, t, camTgtVec, 'easeInOut')
    addKeyframe(cam.focusDistance, t, focusDist, 'easeInOut')
  }

  return { keyframeCount: numKeys, duration }
}
