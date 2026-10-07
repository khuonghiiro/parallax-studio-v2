import * as THREE from 'three'
import type { Face3D } from './types'
import { faceMatrix, faceQuaternion, toThree } from './assemblyGeometry'

/**
 * Intersection rule ("cắt giao"): a face listed in `face.clipBy` cuts away the part of
 * `face` that pokes through its plane — e.g. a gable wall sticking out above a sloped
 * roof. The smaller part of the face (by area) is the one hidden, so the rule adapts to
 * the orientation of both faces. Planes are infinite; the viewport uses three.js clipping
 * planes and the scene insert bakes the cut into the image alpha.
 */

/** Grid of sample points used to measure how much of a face lies on each side. */
const SAMPLES = 9
/** Distances below this (model units) count as touching, not crossing. */
const TOUCH_EPS = 0.5

export interface ClipRule {
  clipperId: string
  /** Unit normal of the clipper's front side (three space, unscaled). */
  normal: THREE.Vector3
  /** A point on the clipper plane (three space, unscaled). */
  point: THREE.Vector3
  /** +1: hide the part in front of the clipper, -1: hide the part behind it. */
  hideSide: 1 | -1
}

/** Front normal (three space) of a face. */
export function faceNormal(face: Pick<Face3D, 'rotation'>): THREE.Vector3 {
  return new THREE.Vector3(0, 0, 1).applyQuaternion(faceQuaternion(face.rotation))
}

/** Sample points (three space, unscaled) spread over the face rectangle. */
export function faceSamplePoints(face: Face3D, n = SAMPLES): THREE.Vector3[] {
  const m = faceMatrix(face)
  const pts: THREE.Vector3[] = []
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n - 0.5) * face.width
      const y = ((j + 0.5) / n - 0.5) * face.height
      pts.push(new THREE.Vector3(x, y, 0).applyMatrix4(m))
    }
  }
  return pts
}

interface SideStats {
  front: number
  back: number
  total: number
}

function sideStats(face: Face3D, normal: THREE.Vector3, point: THREE.Vector3, within?: Face3D): SideStats {
  const pts = faceSamplePoints(face)
  const inv = within ? faceMatrix(within).invert() : null
  let front = 0
  let back = 0
  for (const p of pts) {
    if (inv && within) {
      const l = p.clone().applyMatrix4(inv)
      if (Math.abs(l.x) > within.width * 0.55 || Math.abs(l.y) > within.height * 0.55) continue
    }
    const d = normal.dot(p.clone().sub(point))
    if (d > TOUCH_EPS) front++
    else if (d < -TOUCH_EPS) back++
  }
  return { front, back, total: pts.length }
}

/** Clip rules of a face (clippers that no longer exist or are the face itself are skipped). */
export function faceClipRules(face: Face3D, faces: Face3D[]): ClipRule[] {
  const rules: ClipRule[] = []
  for (const id of face.clipBy || []) {
    const clipper = faces.find((f) => f.id === id)
    if (!clipper || clipper.id === face.id) continue
    const normal = faceNormal(clipper)
    const point = toThree(clipper.position)
    const s = sideStats(face, normal, point)
    rules.push({ clipperId: id, normal, point, hideSide: s.front <= s.back ? 1 : -1 })
  }
  return rules
}

/**
 * three.js clipping planes (world space, model scale applied). three keeps the positive
 * side of each plane, so the plane normal points away from the hidden side.
 */
export function faceClipPlanes(face: Face3D, faces: Face3D[], scale: number): THREE.Plane[] {
  return faceClipRules(face, faces).map((r) => {
    const n = r.normal.clone().multiplyScalar(-r.hideSide)
    return new THREE.Plane(n, -n.dot(r.point.clone().multiplyScalar(scale)))
  })
}

/**
 * Hidden region of a face image for one rule, as a polygon in image pixels (x → right,
 * y → down), or null when nothing is hidden.
 */
export function hiddenImagePolygon(face: Face3D, rule: ClipRule, imgW: number, imgH: number): Array<[number, number]> | null {
  const m = faceMatrix(face)
  // Signed distance as a linear function of the face-local point: a·x + b·y + c.
  const origin = new THREE.Vector3().applyMatrix4(m)
  const ex = new THREE.Vector3(1, 0, 0).applyMatrix4(m).sub(origin)
  const ey = new THREE.Vector3(0, 1, 0).applyMatrix4(m).sub(origin)
  const a = rule.normal.dot(ex) * rule.hideSide
  const b = rule.normal.dot(ey) * rule.hideSide
  const c = rule.normal.dot(origin.clone().sub(rule.point)) * rule.hideSide
  const toLocal = (px: number, py: number): [number, number] => [(px / imgW - 0.5) * face.width, (0.5 - py / imgH) * face.height]
  const hiddenAt = (px: number, py: number): number => {
    const [x, y] = toLocal(px, py)
    return a * x + b * y + c
  }
  const rect: Array<[number, number]> = [[0, 0], [imgW, 0], [imgW, imgH], [0, imgH]]
  const out: Array<[number, number]> = []
  for (let i = 0; i < 4; i++) {
    const p = rect[i]
    const q = rect[(i + 1) % 4]
    const dp = hiddenAt(p[0], p[1])
    const dq = hiddenAt(q[0], q[1])
    if (dp > 0) out.push(p)
    if (dp > 0 !== dq > 0) {
      const t = dp / (dp - dq)
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
    }
  }
  return out.length >= 3 ? out : null
}

export interface ClipSuggestion {
  faceId: string
  clipperId: string
  /** Share of the face that would be hidden (0..1). */
  hiddenShare: number
}

/**
 * Suggests clip rules: face F is cut by G when F crosses G's plane, only a minority of F
 * pokes through, and the poking part lies over G's extent. When two faces cut each other
 * the more roof-like one (normal closer to vertical) wins.
 */
export function suggestClipRules(faces: Face3D[]): ClipSuggestion[] {
  const visible = faces.filter((f) => !f.hidden)
  const found: ClipSuggestion[] = []
  for (const f of visible) {
    for (const g of visible) {
      if (f.id === g.id) continue
      const ng = faceNormal(g)
      if (Math.abs(faceNormal(f).dot(ng)) > 0.98) continue
      const near = sideStats(f, ng, toThree(g.position), g)
      if (near.front === 0 || near.back === 0) continue
      const all = sideStats(f, ng, toThree(g.position))
      const minority = Math.min(all.front, all.back)
      const share = minority / Math.max(1, all.total)
      if (share > 0 && share <= 0.35) found.push({ faceId: f.id, clipperId: g.id, hiddenShare: share })
    }
  }
  return found.filter((s) => {
    const mutual = found.find((o) => o.faceId === s.clipperId && o.clipperId === s.faceId)
    if (!mutual) return true
    const roofS = Math.abs(faceNormal(faces.find((x) => x.id === s.clipperId)!).y)
    const roofM = Math.abs(faceNormal(faces.find((x) => x.id === mutual.clipperId)!).y)
    if (Math.abs(roofS - roofM) > 1e-3) return roofS > roofM
    return s.hiddenShare < mutual.hiddenShare || (s.hiddenShare === mutual.hiddenShare && s.faceId < mutual.faceId)
  })
}

/** Applies suggestions to faces (merging with existing clipBy lists). */
export function applyClipSuggestions(faces: Face3D[], suggestions: ClipSuggestion[]): Face3D[] {
  return faces.map((f) => {
    const add = suggestions.filter((s) => s.faceId === f.id).map((s) => s.clipperId)
    if (add.length === 0) return f
    return { ...f, clipBy: Array.from(new Set([...(f.clipBy || []), ...add])) }
  })
}

/** Removes references to deleted faces from every clipBy list. */
export function pruneClipRefs(faces: Face3D[]): Face3D[] {
  const ids = new Set(faces.map((f) => f.id))
  return faces.map((f) => {
    if (!f.clipBy?.length) return f
    const kept = f.clipBy.filter((id) => ids.has(id) && id !== f.id)
    return kept.length === f.clipBy.length ? f : { ...f, clipBy: kept.length ? kept : undefined }
  })
}
