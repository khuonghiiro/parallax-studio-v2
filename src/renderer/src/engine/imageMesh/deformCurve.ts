/**
 * Spine Curve Deformation Module
 *
 * Deforms a mesh along a 3-5 point parametric curve with continuous tangent frames.
 */

import type { CurveModifier, BaseSurface } from '@shared/imageMeshDefinition'

interface SpineSample {
  pos: [number, number, number]
  tangent: [number, number, number]
  normal: [number, number, number]
  binormal: [number, number, number]
}

function normalize(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2])
  if (len < 1e-6) return [0, 1, 0]
  return [v[0] / len, v[1] / len, v[2] / len]
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ]
}

/**
 * Evaluates Catmull-Rom interpolation on control points at t in [0, 1].
 */
function sampleSpine(pts: [number, number, number][], t: number): SpineSample {
  const n = pts.length
  if (n < 2) {
    const p = pts[0] ?? [0, 0, 0]
    return { pos: p, tangent: [0, 1, 0], normal: [1, 0, 0], binormal: [0, 0, 1] }
  }

  const p = Math.max(0, Math.min(0.9999, t)) * (n - 1)
  const i = Math.floor(p)
  const f = p - i

  const p0 = pts[Math.max(0, i - 1)]
  const p1 = pts[i]
  const p2 = pts[Math.min(n - 1, i + 1)]
  const p3 = pts[Math.min(n - 1, i + 2)]

  // Standard Catmull-Rom spline formula
  const f2 = f * f
  const f3 = f2 * f

  const posX = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * f + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * f2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * f3)
  const posY = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * f + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * f2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * f3)
  const posZ = 0.5 * ((2 * p1[2]) + (-p0[2] + p2[2]) * f + (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * f2 + (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * f3)

  // Tangent is the derivative with respect to f
  const tanX = 0.5 * ((-p0[0] + p2[0]) + 2 * (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * f + 3 * (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * f2)
  const tanY = 0.5 * ((-p0[1] + p2[1]) + 2 * (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * f + 3 * (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * f2)
  const tanZ = 0.5 * ((-p0[2] + p2[2]) + 2 * (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * f + 3 * (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * f2)

  const tangent = normalize([tanX, tanY, tanZ])
  // Reference up vector for parallel frame transport
  const refUp: [number, number, number] = Math.abs(tangent[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const normal = normalize(cross(tangent, refUp))
  const binormal = normalize(cross(normal, tangent))

  return { pos: [posX, posY, posZ], tangent, normal, binormal }
}

export function applyCurvePrimitive(
  positions: Float32Array,
  uvs: Float32Array,
  count: number,
  mod: CurveModifier,
  surface: BaseSurface
): void {
  const { controlPoints } = mod
  if (!controlPoints || controlPoints.length < 2) return

  const h = surface.height
  // Convert normalized curve control points into local coordinates
  const pts: [number, number, number][] = controlPoints.map((cp) => [
    cp.position[0] * surface.width,
    (cp.position[1] - 0.5) * h,
    cp.position[2] * surface.width
  ])

  for (let i = 0; i < count; i++) {
    const idx = i * 3
    const v = uvs[i * 2 + 1] // 0 at base, 1 at tip
    const localX = positions[idx]
    const localZ = positions[idx + 2]

    const frame = sampleSpine(pts, v)

    // Project cross-section (localX, localZ) along the spine normal and binormal
    positions[idx] = frame.pos[0] + frame.normal[0] * localX + frame.binormal[0] * localZ
    positions[idx + 1] = frame.pos[1] + frame.normal[1] * localX + frame.binormal[1] * localZ
    positions[idx + 2] = frame.pos[2] + frame.normal[2] * localX + frame.binormal[2] * localZ
  }
}
